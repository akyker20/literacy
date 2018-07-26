import { Models as M, Constants as SC, Helpers } from 'reading_rewards';
import * as joi from 'joi';
import * as shortid from 'shortid';
import * as _ from 'lodash';

import { IRequest, shortidSchema } from '../extensions';
import * as Middle from '../middleware';
import { ResourceNotFoundError, BadRequestError, ForbiddenError } from 'restify-errors';
import { IPrizeData } from '../data/prizes';
import { unwrapData } from '../helpers';
import { IUserData } from '../data/users';
import { IPrizeOrderData } from '../data/prize_orders';
import { Next, Response } from 'restify';
import { INotificationSys } from '../notifications';

const inputPrizeOrderSchema = joi.object({
  student_id: shortidSchema,
  prize_id: shortidSchema
}).strict().required();

const inputPrizeSchema = joi.object({
  title: joi.string().max(100).required(),
  description: joi.array().items(joi.string()).required(),
  price_usd: joi.number().max(1000).required(),
  photo_urls: joi.array().items(joi.string().uri()).required(),
  amazon_url: joi.string().uri().optional()
}).strict().required();

const createdPrizeSchema = inputPrizeSchema.keys({
  _id: shortidSchema.required()
}).required();

export function PrizeRoutes(
  prizeData: IPrizeData,
  prizeOrderData: IPrizeOrderData,
  userData: IUserData,
  notifications: INotificationSys
) {

  return {

    orderPrize: [
      Middle.authenticate,
      Middle.authorize([M.UserType.ADMIN, M.UserType.STUDENT]),
      Middle.valBody<M.IPrizeOrderBody>(inputPrizeOrderSchema),
      (req: IRequest<M.IBookReviewBody>, res: Response, next: Next) => {
        const { type, _id: userId } = req.authToken;
        if ((type !== M.UserType.ADMIN) && (userId !== req.body.student_id)) {
          return next(new ForbiddenError(`Only admin can submit prize order for another student.`));
        }
        next();
      },
      unwrapData(async (req: IRequest<M.IPrizeOrderBody>) => {
        const { prize_id, student_id } = req.body;

        const student = await userData.getUserById(student_id);

        if (_.isNull(student)) {
          return new BadRequestError(`Student ${student_id} does not exist.`);
        }

        if (student.type !== M.UserType.STUDENT) {
          return new BadRequestError(`User ${student._id} is not a student`)
        }

        const prize = await prizeData.getPrizeById(prize_id);
        
        if (_.isNull(prize)) {
          return new BadRequestError(`Prize ${prize_id} does not exist.`);
        }
  
        const slackMessage = `*${Helpers.getFullName(student)}* ordered *${prize.title}*`;
        notifications.sendMessage(slackMessage);

        const prizeOrder: M.IPrizeOrder = {
          ...req.body,
          _id: shortid.generate(),
          status: M.PrizeOrderStatus.Pending,
          prize_price_usd: prize.price_usd,
          prize_point_cost: _.round(prize.price_usd * SC.PrizePointsPerDollar),
          date_created: new Date().toISOString(),
          date_ordered: null
        }

        return prizeOrderData.createPrizeOrder(prizeOrder);


      }),
      Middle.handlePromise
    ],

    getPrizes: [
      Middle.authenticate,
      unwrapData(async (req: IRequest<M.IBook>) => prizeData.getPrizes()),
      Middle.handlePromise
    ],

    createPrize: [
      Middle.authenticate,
      Middle.authorize([M.UserType.ADMIN]),
      Middle.valBody<M.IPrize>(inputPrizeSchema),
      unwrapData(async (req: IRequest<M.IPrize>) => {

        const newPrize: M.IPrize = {
          ... req.body,
          _id: shortid.generate()
        }
        
        return prizeData.createPrize(newPrize);

      }),
      Middle.handlePromise
    ],

    updatePrize: [
      Middle.authenticate,
      Middle.authorize([M.UserType.ADMIN]),
      Middle.valBody<M.IBook>(createdPrizeSchema),
      Middle.valIdsSame({ paramKey: 'prizeId', bodyKey: '_id' }),
      unwrapData(async (req: IRequest<M.IPrize>) => {

        const updatedPrize = await prizeData.updatePrize(req.body);

        if (_.isNull(updatedPrize)) {
          throw new ResourceNotFoundError('No book was updated');
        }

        return { updatedPrize };

      }),
      Middle.handlePromise
    ],

    deletePrize: [
      Middle.authenticate,
      Middle.authorize([M.UserType.ADMIN]),
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