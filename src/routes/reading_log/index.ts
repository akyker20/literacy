import { Models as M, Helpers, Models } from 'reading_rewards';
import * as _ from 'lodash';
import {
  ResourceNotFoundError,
  BadRequestError
} from 'restify-errors';

import { IRequest, unwrapData, validateUser } from '../extensions';
import * as Middle from '../../middleware';
import { IBookData } from '../../data/books';
import { IUserData } from '../../data/users';
import { INotificationSys } from '../../notifications';
import { IReadingLogData } from '../../data/reading_log';
import { IEmailContent, IEmail } from '../../email';
import { EmailTemplates } from '../../email/templates';
import { BodyValidators as Val } from './joi';

export function ReadingLogRoutes(
  userData: IUserData,
  bookData: IBookData,
  readingLogData: IReadingLogData,
  notifications: INotificationSys,
  email: IEmail
) {

  return {

    createLog: [
      Middle.authenticate,
      Middle.authorize([M.UserType.Admin, M.UserType.Student]),
      Middle.authorizeAgents([M.UserType.Admin]),
      Middle.valBody<M.IReadingLog>(Val.ReadingLogSchema),
      Middle.valIdsSame({ paramKey: 'userId', bodyKey: 'student_id' }),
      unwrapData(async (req: IRequest<M.IReadingLogBody>) => {

        const { student_id, book_id } = req.body;

        const student = await userData.getUserById(student_id) as Models.IStudent;
        validateUser(student_id, student)

        const book = await bookData.getBook(book_id);

        if (_.isNull(book)) {
          return new ResourceNotFoundError(`Book ${book_id} does not exist`)
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
          ...req.body,
          date: new Date().toISOString(),
          book_title: book.title,
          points_earned: req.body.final_page - req.body.start_page
        }

        // send slack message

        const slackMessage = `*${Helpers.getFullName(student)}* submitted reading log.\n${JSON.stringify(log)}`;
        notifications.sendMessage(slackMessage);

        // send email notification

        const emailContent: IEmailContent = EmailTemplates.buildReadingLogEmail(student, log);

        const educator = await userData.getEducatorOfStudent(student_id);

        if (!_.isNull(educator) && educator.notification_settings.reading_logs) {
          email.sendMail(educator.email, emailContent);
        }

        email.sendAdminEmail(emailContent);

        return await readingLogData.createLog(log);

      }),
      Middle.handlePromise
    ],

    deleteLog: [
      Middle.authenticate,
      Middle.authorize([M.UserType.Admin, M.UserType.Student]),
      Middle.authorizeAgents([M.UserType.Admin]),
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
      Middle.authorize([M.UserType.Admin, M.UserType.Student]),
      Middle.authorizeAgents([M.UserType.Admin]),
      unwrapData(async (req: IRequest<null>) => {

        const { userId } = req.params;

        const user = await userData.getUserById(userId);
        validateUser(userId, user);

        return await readingLogData.getLogsForStudent(userId)

      }),
      Middle.handlePromise
    ]

  }

}