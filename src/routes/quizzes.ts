import { IRequest } from '../Extensions';
import * as Middle from '../middleware';
import * as joi from 'joi';
import { genFieldErr, unwrapData } from '../helpers';
import { UserType } from '../data/users';
import { IQuizData, IQuiz, IQuizSubmissionBody, IQuizSubmission } from '../data/quizzes';
import _ = require('lodash');
import { ForbiddenError, ResourceNotFoundError, BadRequestError } from 'restify-errors';
import { IBookData } from '../data/books';

export const quizSchema = joi.object({
  questions: joi.array().items(joi.any()).min(5).max(10).required().error(genFieldErr('questions')),
  book: joi.string().optional().error(genFieldErr('book')),
  date_created: joi.string().isoDate().required().error(genFieldErr('date_created')),
}).required()

export const quizSubmissionSchema = joi.object({
  date_submitted: joi.string().isoDate().required().error(genFieldErr('date_submitted')),
  quiz_id: joi.string().required().error(genFieldErr('quiz_id')),
  student_id: joi.string().required().error(genFieldErr('quiz_id')),
  book_id: joi.string().optional().error(genFieldErr('book_id')),
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

  return {

    // Quiz Related Routes

    createQuiz: [
      Middle.authenticate,
      Middle.authorize([UserType.ADMIN]),
      Middle.valBody(quizSchema),
      (req: IRequest<IQuiz>) => {
        req.promise = quizData.createQuiz(req.body)
      },
      Middle.handlePromise
    ],
    updateQuiz: [
      Middle.authenticate,
      Middle.authorize([UserType.ADMIN]),
      Middle.valBody(quizSchema),
      (req: IRequest<IQuiz>) => {
        req.promise = quizData.updateQuiz(req.body)
      },
      Middle.handlePromise
    ],
    deleteQuiz: [
      Middle.authenticate,
      Middle.authorize([UserType.ADMIN]),
      Middle.valBody(quizSchema),
      (req: IRequest<null>) => {
        req.promise = quizData.deleteQuiz(req.params.quizId);
      },
      Middle.handlePromise
    ],

    // Quiz Submission Related Routes

    submitQuiz: [
      Middle.authenticate,
      Middle.valBody<IQuizSubmissionBody>(quizSubmissionSchema),
      unwrapData(async (req: IRequest<IQuizSubmissionBody>) => {

        const submissions = await quizData.getSubmissionsForUser(req.authToken._id);

        const booksAlreadyRead = submissions.map(s => s.book_id);
        
        if (_.includes(booksAlreadyRead, req.body.book_id)) {
          throw new ForbiddenError(`User has already taken quiz for book ${req.body.book_id}`)
        }

        const book = await bookData.getBook(req.body.book_id);

        if (book === null) {
          throw new BadRequestError(`No book with id ${req.body.book_id} exists`)
        }

        const quizSubmission: IQuizSubmission = _.assign({}, req.body, {
          date_submitted: new Date().toISOString(),
          book_lexile_score: book.lexile_measure,
          passed: true // TODO: have grading system
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

        const updatedSubmission: IQuizSubmission = _.assign({}, submission, {
          comprehension
        })

        return await quizData.updateQuizSubmission(updatedSubmission);

      }),
      Middle.handlePromise

    ]

  }

}