import { Models as M, Helpers } from 'reading_rewards';
import * as joi from 'joi';
import * as _ from 'lodash';
import { Next, Response } from 'restify';

import { IRequest, shortidSchema } from '../extensions';
import * as Middle from '../middleware';
import { ResourceNotFoundError, BadRequestError, ForbiddenError } from 'restify-errors';
import { IBookData } from '../data/books';
import { unwrapData } from '../helpers';
import { IUserData } from '../data/users';
import { INotificationSys } from '../notifications';
import { IReadingLogData } from '../data/reading_log';

const readingLogSchema = joi.object({
  student_id: shortidSchema,
  book_id: shortidSchema,
  read_with: joi.string().valid(_.values(M.ReadingWith)).required(),
  start_page: joi.number().integer().required(),
  final_page: joi.number().integer().required(),
  duration_min: joi.number().integer().min(0).max(60 * 10).required(),
  is_last_log_for_book: joi.boolean().required(),
  summary: joi.string().required()
}).strict().required();

export function ReadingLogRoutes(
  userData: IUserData,
  bookData: IBookData,
  readingLogData: IReadingLogData,
  notifications: INotificationSys
) {

  return {

    createLog: [
      Middle.authenticate,
      Middle.authorize([M.UserType.ADMIN, M.UserType.STUDENT]),
      Middle.authorizeAgents([M.UserType.ADMIN]),
      Middle.valBody<M.IReadingLog>(readingLogSchema),
      Middle.valIdsSame({ paramKey: 'userId', bodyKey: 'student_id' }),
      (req: IRequest<M.IBookReviewBody>, res: Response, next: Next) => {
        const { type, _id: userId } = req.authToken;
        if ((type !== M.UserType.ADMIN) && (userId !== req.body.student_id)) {
          return next(new ForbiddenError(`Only admin can submit reading log for another student.`));
        }
        next();
      },
      unwrapData(async (req: IRequest<M.IReadingLogBody>) => {

        const { student_id, book_id } = req.body;

        const user = await userData.getUserById(student_id);

        if (_.isNull(user)) {
          return new ResourceNotFoundError(`User ${student_id} does not exist`)
        }

        if (user.type !== M.UserType.STUDENT ) {
          return new BadRequestError(`User ${student_id} is not a student`)
        }

        const book = await bookData.getBook(book_id);
        
        if (_.isNull(book)) {
          return new BadRequestError(`Book ${book_id} does not exist`)
        }

        // Validate log

        const errorMsg = Helpers.validateReadingLogBody(req.body, book);

        if (!_.isNull(errorMsg)) {
          return new BadRequestError(errorMsg)
        }

        // Now check this log against pre-existing logs

        const studentLogs = await readingLogData.getLogsForStudent(student_id);

        const studentLogsForBook = _.filter(studentLogs, { book_id });

        if (_.isEmpty(studentLogsForBook)) {
          
          if (req.body.start_page !== 0) {
            throw new BadRequestError(`First log for book ${book.title} must have start_page = 0`);
          }

        } else {

          const mostRecentLog = _.orderBy(studentLogsForBook, 'date', 'desc')[0];

          if (mostRecentLog.is_last_log_for_book) {
            throw new BadRequestError(`You have already logged that you finished ${book.title}`)
          }

          if (mostRecentLog.final_page !== req.body.start_page) {
            throw new BadRequestError(`Your last log for ${book.title} ended on ${mostRecentLog.final_page}. This next log must start on that page.`)
          }

        }

        const log: M.IReadingLog = {
          ... req.body,
          date: new Date().toISOString(),
          book_title: book.title,
          points_earned: req.body.final_page - req.body.start_page
        }

        const slackMessage = `*${Helpers.getFullName(user)}* submitted reading log.\n${JSON.stringify(log)}`;
        notifications.sendMessage(slackMessage);

        return await readingLogData.createLog(log);

      }),
      Middle.handlePromise
    ],

    deleteLog: [
      Middle.authenticate,
      Middle.authorize([M.UserType.ADMIN, M.UserType.STUDENT]),
      Middle.authorizeAgents([M.UserType.ADMIN]),
      unwrapData(async (req: IRequest<null>) => {
        const { logId } = req.params;
        const deletedLog = await readingLogData.deleteLog(logId);
        if (_.isNull(deletedLog)) {
          throw new ResourceNotFoundError(`Reading log ${logId} does not exist`)
        }
        return { deletedLog }
      }),
      Middle.handlePromise
    ],

    getLogsForStudent: [
      Middle.authenticate,
      Middle.authorize([M.UserType.ADMIN, M.UserType.STUDENT]),
      Middle.authorizeAgents([M.UserType.ADMIN]),
      unwrapData(async (req: IRequest<null>) => {

        const { userId } = req.params;
        
        const user = await userData.getUserById(userId);

        if (_.isNull(user)) {
          return new ResourceNotFoundError(`User ${userId} does not exist`)
        }

        if (user.type !== M.UserType.STUDENT ) {
          return new BadRequestError(`User ${userId} is not a student`)
        }

        return await readingLogData.getLogsForStudent(userId)

      }),
      Middle.handlePromise
    ]

  }

}