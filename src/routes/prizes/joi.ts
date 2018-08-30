import * as joi from 'joi';
import * as _ from 'lodash';
import { Models } from 'reading_rewards';
import { shortidSchema } from '../extensions';

export namespace BodyValidators {

  export const InputPrizeOrderSchema = joi.object({
    student_id: shortidSchema,
    prize_id: shortidSchema
  }).strict().required();

  export const UpdatePrizeOrderStatus = joi.object({
    status: joi.string().valid([_.values(Models.PrizeOrderStatus.Ordered)])
  }).strict().required();

  export const InputPrizeSchema = joi.object({
    title: joi.string().max(100).required(),
    description: joi.array().items(joi.string()).required(),
    price_usd: joi.number().max(1000).required(),
    photo_urls: joi.array().items(joi.string().uri()).required(),
    amazon_url: joi.string().uri().optional()
  }).strict().required();

  export const CreatedPrizeSchema = InputPrizeSchema.keys({
    _id: shortidSchema.required()
  }).required();

}
