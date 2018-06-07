import * as joi from 'joi';
import * as _ from 'lodash';
import * as moment from 'moment';
import { Next, Response } from 'restify';
import { ForbiddenError, ResourceNotFoundError, BadRequestError } from 'restify-errors';
import { Models as M, Constants as SC } from 'reading_rewards';

import { IRequest, shortidSchema } from '../Extensions';
import * as Middle from '../middleware';
import { genFieldErr, unwrapData } from '../helpers';
import { IUserData } from '../data/users';
import { IQuizData } from '../data/quizzes';
import { IBookData } from '../data/books';
import { QuizGraderInstance } from '../quizzes';
import { QuestionSchema } from '../quizzes/question_schemas';

export const inputQuizSchema = joi.object({
  questions: joi.array().items(QuestionSchema.unknown(true)).min(SC.MinQuestionsInQuiz).max(SC.MaxQuestionsInQuiz).required(),
  book_id: shortidSchema.optional().error(genFieldErr('book'))
}).required()

const createdQuizSchema = inputQuizSchema.keys({
  _id: shortidSchema.required().error(genFieldErr('_id')),
  date_created: joi.string().isoDate().required().error(genFieldErr('date_created')),
}).required();

export const quizSubmissionSchema = joi.object({
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

export function QuizRoutes(
  userData: IUserData,
  quizData: IQuizData,
  bookData: IBookData
) {

  async function isBookValid(quiz: M.IQuizBody): Promise<boolean> {
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
      Middle.authorize([M.UserType.ADMIN]),
      Middle.valBody<M.IQuizBody>(inputQuizSchema),
      unwrapData(async (req: IRequest<M.IQuizBody>) => {

        const candidateQuiz = req.body;

        // ensure book is valid

        if (!(await isBookValid(candidateQuiz))) {
          throw new BadRequestError(`No book with id ${candidateQuiz.book_id} exists`);
        }

        // validate question schemas

        for (let i = 0; i < candidateQuiz.questions.length; i++) {
          const question = candidateQuiz.questions[i];
          const errorMsg = QuizGraderInstance.isQuestionSchemaValid(question);
          if (!_.isNull(errorMsg)) {
            throw new BadRequestError(`Question with prompt '${question.prompt}' is not a valid ${question.type} question. Error: ${errorMsg}`);
          }
        }

        const newQuiz: M.IQuiz = _.assign({}, candidateQuiz, {
          date_created: new Date().toISOString()
        }) 

        return await quizData.createQuiz(newQuiz);

      }),
      Middle.handlePromise
    ],
    updateQuiz: [
      Middle.authenticate,
      Middle.authorize([M.UserType.ADMIN]),
      Middle.valBody(createdQuizSchema),
      Middle.valIdsSame('quizId'),
      unwrapData(async (req: IRequest<M.IQuiz>) => {

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
      Middle.authorize([M.UserType.ADMIN]),
      unwrapData(async (req: IRequest<M.IQuiz>) => {

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
      Middle.authorize([M.UserType.ADMIN]),
      (req: IRequest<null>, res: Response, next: Next) => {
        req.promise = quizData.getAllQuizzes();
        next();
      },
      Middle.handlePromise
    ],

    // Quiz Submission Related Routes

    submitQuiz: [
      Middle.authenticate,
      Middle.valBody<M.IQuizSubmissionBody>(quizSubmissionSchema),
      (req: IRequest<M.IQuizSubmissionBody>, res: Response, next: Next) => {
        if ((req.authToken.type === M.UserType.STUDENT) && (req.authToken._id !== req.body.student_id)) {
          return next(new ForbiddenError(`Students cannot submit quizzes for other students`))
        }
        next();
      },
      unwrapData(async (req: IRequest<M.IQuizSubmissionBody>) => {

        // verify user exists

        const user = await userData.getUserById(req.body.student_id);

        if (_.isNull(user)) {
          throw new BadRequestError(`User ${req.body.student_id} does not exist.`)
        } else if (user.type !== M.UserType.STUDENT) {
          throw new BadRequestError(`User ${req.body.student_id} is not a student.`)
        }

        const submissions = await quizData.getSubmissionsForStudent(req.body.student_id);

        // check user did not recently submit a quiz.
        
        if (submissions.length) {

          const mostRecentSubmission = _.orderBy(submissions, 'date_created', 'desc')[0];

          const mustWaitTill = moment(mostRecentSubmission.date_created).add(SC.MinHoursBetweenBookQuizAttempt, 'h');

          if (moment().isBefore(mustWaitTill)) {
            throw new ForbiddenError(`User must wait till ${mustWaitTill.toISOString()} to attempt another quiz.`);
          }

        }

        // verify user has not already passed quiz for book

        const prevSubmissionsForBook = submissions.filter(s => s.book_id === req.body.book_id);

        // verification if there are previous submissions

        if (prevSubmissionsForBook.length) {

          const prevPassedSubmissions = _.find(prevSubmissionsForBook, { passed: true });

          if (!_.isUndefined(prevPassedSubmissions)) {
            throw new ForbiddenError(`User has already passed quiz for book ${req.body.book_id}`);
          }

          if (prevSubmissionsForBook.length >= SC.MaxNumQuizAttempts) {
            throw new ForbiddenError(`User has exhausted all attempts to pass quiz for book ${req.body.book_id}`);
          }

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
          const errorMsg = QuizGraderInstance.isAnswerSchemaValid(question.type, answer);
          if (!_.isNull(errorMsg)) {
            throw new BadRequestError(`The answer to question '${question.prompt}' of type ${question.type} has invalid schema. Error: ${errorMsg}`)
          }
        }

        // build submission and save to database

        const quizScore = QuizGraderInstance.gradeQuiz(quiz, req.body.answers);

        const quizSubmission: M.IQuizSubmission = _.assign({}, req.body, {
          date_created: new Date().toISOString(),
          score: quizScore,
          passed: quizScore >= SC.PassingQuizGrade
        })

        return quizData.submitQuiz(quizSubmission);

      }),
      Middle.handlePromise
    ],

    getQuizForBook: [
      Middle.authenticate,
      unwrapData(async (req: IRequest<M.IQuiz>) => {

        const { bookId } = req.params;

        const book = await bookData.getBook(bookId);
        if (_.isNull(book)) {
          throw new ResourceNotFoundError(`Book ${bookId} does not exist.`)
        }

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

        if ((req.authToken.type === M.UserType.STUDENT) && (req.authToken._id !== submission.student_id)) {
          throw new BadRequestError(`Students cannot update comprehension for submissions by other students`)
        }

        const updatedSubmission: M.IQuizSubmission = _.assign({}, submission, {
          comprehension
        })

        return await quizData.updateQuizSubmission(updatedSubmission);

      }),
      Middle.handlePromise

    ]

  }

}