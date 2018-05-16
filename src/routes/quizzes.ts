import * as joi from 'joi';
import * as _ from 'lodash';
import { Next, Response } from 'restify';
import { ForbiddenError, ResourceNotFoundError, BadRequestError } from 'restify-errors';

import { IRequest, shortidSchema } from '../Extensions';
import * as Middle from '../middleware';
import { genFieldErr, unwrapData } from '../helpers';
import { UserType } from '../data/users';
import { IQuizData, IQuiz, IQuizSubmissionBody, IQuizSubmission, IQuizBody } from '../data/quizzes';
import { IBookData } from '../data/books';
import { QuizGraderInstance } from '../quizzes';
import { QuizGraderInstance } from '../quizzes/index';

export const inputQuizSchema = joi.object({
  questions: joi.array().items(joi.any()).min(5).max(10).required().error(genFieldErr('questions')),
  book_id: shortidSchema.optional().error(genFieldErr('book'))
}).required()

const createdQuizSchema = inputQuizSchema.keys({
  _id: shortidSchema.required().error(genFieldErr('_id')),
  date_created: joi.string().isoDate().required().error(genFieldErr('date_created')),
}).required();

export const quizSubmissionSchema = joi.object({
  date_submitted: joi.string().isoDate().required().error(genFieldErr('date_submitted')),
  quiz_id: shortidSchema.required().error(genFieldErr('quiz_id')),
  student_id: shortidSchema.required().error(genFieldErr('student_id')),
  book_id: shortidSchema.required().error(genFieldErr('book_id')),
  answers: joi.any()
}).required();

export const quizSubmissionComprehensionSchema = joi.object({
  comprehension: joi.number().integer().valid([1, 2, 3, 4, 5]).required().error(genFieldErr('comprehension'))
}).required()

interface IQuizSubmissionComprehensionBody {
  comprehension: 1|2|3|4|5;
}

export function QuizService(
  quizData: IQuizData,
  bookData: IBookData
) {

  async function isBookValid(quiz: IQuizBody): Promise<boolean> {
    if (quiz.book_id) {
      const book = await bookData.getBook(quiz.book_id);
      return !_.isNull(book);
    }
    return true;
  }

  return {

    // Quiz Related Routes

    createQuiz: [
      Middle.authenticate,
      Middle.authorize([UserType.ADMIN]),
      Middle.valBody(inputQuizSchema),
      unwrapData(async (req: IRequest<IQuizBody>) => {

        const candidateQuiz = req.body;

        // ensure book is valid

        if (!(await isBookValid(candidateQuiz))) {
          throw new BadRequestError(`No book with id ${candidateQuiz.book_id} exists`);
        }

        // validate question schemas

        for (let i = 0; i < candidateQuiz.questions.length; i++) {
          const question = candidateQuiz.questions[i];
          if (!QuizGraderInstance.isQuestionSchemaValid(question)) {
            throw new BadRequestError(`Question with prompt '${question.prompt}' is not a valid ${question.type} question.`);
          }
        }

        return await quizData.createQuiz(candidateQuiz);

      }),
      Middle.handlePromise
    ],
    updateQuiz: [
      Middle.authenticate,
      Middle.authorize([UserType.ADMIN]),
      Middle.valBody(createdQuizSchema),
      Middle.valIdsSame('quizId'),
      unwrapData(async (req: IRequest<IQuiz>) => {

        if (!(await isBookValid(req.body))) {
          throw new BadRequestError(`No book with id ${req.body.book_id} exists`);
        }

        const updatedQuiz = await quizData.updateQuiz(req.body);

        if (_.isEmpty(updatedQuiz)) {
          throw new ResourceNotFoundError('No quiz was updated') 
        }
        
        return { updatedQuiz };

      }),
      Middle.handlePromise
    ],
    deleteQuiz: [
      Middle.authenticate,
      Middle.authorize([UserType.ADMIN]),
      unwrapData(async (req: IRequest<IQuiz>) => {

        const deletedQuiz = await quizData.deleteQuiz(req.params.quizId);

        if (_.isNull(deletedQuiz)) {
          throw new ResourceNotFoundError('No quiz was deleted')
        }

        return { deletedQuiz };

      }),
      Middle.handlePromise
    ],

    getAllQuizzes: [
      Middle.authenticate,
      Middle.authorize([UserType.ADMIN]),
      (req: IRequest<null>, res: Response, next: Next) => {
        req.promise = quizData.getAllQuizzes();
        next();
      },
      Middle.handlePromise
    ],

    // Quiz Submission Related Routes

    submitQuiz: [
      Middle.authenticate,
      Middle.valBody<IQuizSubmissionBody>(quizSubmissionSchema),
      (req: IRequest<IQuizSubmissionBody>, res: Response, next: Next) => {
        if ((req.authToken.type === UserType.STUDENT) && (req.authToken._id !== req.body.student_id)) {
          return next(new BadRequestError(`Students cannot submit quizzes for other students`))
        }
        next();
      },
      unwrapData(async (req: IRequest<IQuizSubmissionBody>) => {

        const submissions = await quizData.getSubmissionsForStudent(req.body.student_id);

        // verify user has not already submitted quiz for book
        
        const booksAlreadyRead = submissions.map(s => s.book_id);
        
        if (_.includes(booksAlreadyRead, req.body.book_id)) {
          throw new ForbiddenError(`User has already taken quiz for book ${req.body.book_id}`)
        }

        // verify book actually exists

        const book = await bookData.getBook(req.body.book_id);

        if (book === null) {
          throw new BadRequestError(`No book with id ${req.body.book_id} exists`)
        }

        // verify quiz actually exists

        const quiz = await quizData.getQuizById(req.body.quiz_id);

        if (quiz === null) {
          throw new BadRequestError(`No quiz with id ${req.body.quiz_id} exists`)
        }

        // should be the same number of questions as answers

        if (quiz.questions.length !== req.body.answers.length) {
          throw new BadRequestError(
            `There are ${quiz.questions.length} quiz questions, 
            yet ${req.body.answers.length} answers were submitted`
          );
        }

        // verify answer schema based on question types

        for (let i = 0; i < quiz.questions.length; i++) {
          const question = quiz.questions[i];
          const answer = req.body.answers[i];
          if (!QuizGraderInstance.isAnswerSchemaValid(question.type, answer)) {
            throw new BadRequestError(`The answer to question '${question.prompt}' of type ${question.type} has invalid schema`)
          }
        }

        // build submission and save to database

        const quizSubmission: IQuizSubmission = _.assign({}, req.body, {
          date_submitted: new Date().toISOString(),
          book_lexile_score: book.lexile_measure,
          passed: QuizGraderInstance.gradeQuiz(quiz, req.body.answers)
        })

        return await quizData.submitQuiz(quizSubmission);


      }),
      Middle.handlePromise
    ],

    getQuizForBook: [
      Middle.authenticate,
      unwrapData(async (req: IRequest<IQuiz>) => {

        const { bookId } = req.params;
        const bookQuiz = await quizData.getQuizForBook(bookId);

        if (!_.isNull(bookQuiz)) {
          return bookQuiz;
        }

        return await quizData.getGenericQuiz();

      }),
      Middle.handlePromise
    ],

    setComprehensionForSubmission: [
      Middle.authenticate,
      Middle.valBody(quizSubmissionComprehensionSchema),
      unwrapData(async (req: IRequest<IQuizSubmissionComprehensionBody>) => {
        
        const { comprehension } = req.body;
        const { submissionId } = req.params;

        const submission = await quizData.getSubmissionById(submissionId);

        if (_.isNull(submission)) {
          throw new ResourceNotFoundError(`Quiz submission with id ${submissionId} does not exist.`)
        }

        if ((req.authToken.type === UserType.STUDENT) && (req.authToken._id !== submission.student_id)) {
          throw new BadRequestError(`Students cannot update comprehension for submissions by other students`)
        }

        const updatedSubmission: IQuizSubmission = _.assign({}, submission, {
          comprehension
        })

        return await quizData.updateQuizSubmission(updatedSubmission);

      }),
      Middle.handlePromise

    ]

  }

}