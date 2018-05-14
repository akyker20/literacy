import { Response, Next } from 'restify';
import { IRequest } from '../Extensions';
import * as Middle from '../middleware';
import * as joi from 'joi';
import { genFieldErr } from '../helpers';
import { UserType } from '../data/users';
import { IQuizData, IQuiz } from '../data/quizzes';
import _ = require('lodash');

export const quizSchema = joi.object({
  questions: joi.array().items(joi.string().max(200)).min(5).max(10).required().error(genFieldErr('questions')),
  book: joi.string().optional().error(genFieldErr('book')),
  date_created: joi.string().isoDate().required().error(genFieldErr('date_created')),
}).required()

export function QuizService(
  quizData: IQuizData
) {

  return {
    createQuiz: [
      Middle.authenticate,
      Middle.authorize([UserType.ADMIN]),
      Middle.valBody(quizSchema),
      (req: IRequest<IQuiz>, res: Response, next: Next) => {
        quizData.createQuiz(req.body)
          .then(createdQuiz => res.send(201, createdQuiz))
          .catch(err => next(err))
      }
    ],
    updateQuiz: [
      Middle.authenticate,
      Middle.authorize([UserType.ADMIN]),
      Middle.valBody(quizSchema),
      (req: IRequest<IQuiz>, res: Response, next: Next) => {
        quizData.updateQuiz(req.body)
          .then(update => res.send(update))
          .catch(err => next(err))
      }
    ],
    deleteQuiz: [
      Middle.authenticate,
      Middle.authorize([UserType.ADMIN]),
      Middle.valBody(quizSchema),
      (req: IRequest<IQuiz>, res: Response, next: Next) => {
        quizData.deleteQuiz(req.params.quizId)
          .then(deleted_quiz => res.send({ deleted_quiz }))
          .catch(err => next(err))
      }
    ],
    getQuizForBook: [
      Middle.authenticate,
      (req: IRequest<IQuiz>, res: Response, next: Next) => {
        const { bookId } = req.params;
        quizData.getQuizForBook(bookId)
          .then(bookQuiz => {
            if (!_.isNull(bookQuiz)) {
              return res.send(bookQuiz);
            }
            return quizData.getGenericQuiz()
          })
          .then(genericQuiz => res.send(genericQuiz))
          .catch(err => next(err))
      }
    ]
  }

}