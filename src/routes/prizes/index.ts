// 3rd party dependencies

import { Models as M, Constants as SC, Helpers, Models } from 'reading_rewards';
import * as _ from 'lodash';
import { ResourceNotFoundError } from 'restify-errors';


// internal dependencies

import { BodyValidators as Val } from './joi';
import { IRequest, unwrapData, validateUser } from '../extensions';
import * as Middle from '../../middleware';
import { IPrizeData } from '../../data/prizes';
import { IUserData } from '../../data/users';
import { IPrizeOrderData } from '../../data/prize_orders';
import { INotificationSys } from '../../notifications';
import { IEmailContent, IEmail } from '../../email';
import { EmailTemplates } from '../../email/templates';

export function PrizeRoutes(
  prizeData: IPrizeData,
  prizeOrderData: IPrizeOrderData,
  userData: IUserData,
  notifications: INotificationSys,
  email: IEmail
) {

  return {

    orderPrize: [
      Middle.authenticate,
      Middle.authorize([M.UserType.Admin, M.UserType.Student]),
      Middle.authorizeAgents([M.UserType.Admin]),
      Middle.valBody<M.IPrizeOrderBody>(Val.InputPrizeOrderSchema),
      Middle.valIdsSame({ paramKey: 'userId', bodyKey: 'student_id' }),
      unwrapData(async (req: IRequest<M.IPrizeOrderBody>) => {

        const { prize_id, student_id } = req.body;

        const student = await userData.getUserById(student_id) as Models.IStudent;
        validateUser(student_id, student)

        const prize = await prizeData.getPrizeById(prize_id);

        if (_.isNull(prize)) {
          return new ResourceNotFoundError(`Prize ${prize_id} does not exist.`);
        }

        const prizeOrder: M.IPrizeOrder = {
          ...req.body,
          status: M.PrizeOrderStatus.Pending,
          prize_price_usd: prize.price_usd,
          prize_point_cost: _.round(prize.price_usd * SC.PrizePointsPerDollar),
          date_created: new Date().toISOString(),
          date_ordered: null
        }

        // slack notification

        const slackMessage = `*${Helpers.getFullName(student)}* ordered *${prize.title}*`;
        notifications.sendMessage(slackMessage);

        // email notifications

        const emailContent: IEmailContent = EmailTemplates.buildOrderedPrizeEmail(student, prize, prizeOrder);

        const educator = await userData.getEducatorOfStudent(student_id);
        if (!_.isNull(educator) && educator.notification_settings.prizes_ordered) {
          email.sendMail(educator.email, emailContent)
        }

        email.sendAdminEmail(emailContent);

        // create prize order

        return prizeOrderData.createPrizeOrder(prizeOrder);


      }),
      Middle.handlePromise
    ],

    getAllPrizes: [
      Middle.authenticate,
      unwrapData(async () => prizeData.getAllPrizes()),
      Middle.handlePromise
    ],

    createPrize: [
      Middle.authenticate,
      Middle.authorize([M.UserType.Admin]),
      Middle.valBody<M.IPrize>(Val.InputPrizeSchema),
      unwrapData(async ({ body }: IRequest<M.IPrize>) => prizeData.createPrize(body)),
      Middle.handlePromise
    ],

    updatePrize: [
      Middle.authenticate,
      Middle.authorize([M.UserType.Admin]),
      Middle.valBody<M.IBook>(Val.CreatedPrizeSchema),
      Middle.valIdsSame({ paramKey: 'prizeId', bodyKey: '_id' }),
      unwrapData(async (req: IRequest<M.IPrize>) => {

        const updatedPrize = await prizeData.updatePrize(req.body);

        if (_.isNull(updatedPrize)) {
          throw new ResourceNotFoundError('No prize was updated');
        }

        return { updatedPrize };

      }),
      Middle.handlePromise
    ],

    deletePrize: [
      Middle.authenticate,
      Middle.authorize([M.UserType.Admin]),
      unwrapData(async (req: IRequest<null>) => {

        const deletedPrize = await prizeData.deletePrize(req.params.prizeId);

        if (_.isEmpty(deletedPrize)) {
          throw new ResourceNotFoundError('No prize was deleted')
        }

        return { deletedPrize };

      }),
      Middle.handlePromise
    ]

  }

}