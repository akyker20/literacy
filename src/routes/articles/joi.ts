import * as joi from 'joi';
import { shortidSchema } from '../extensions';

export namespace BodyValidators {

  export const ArticleBody = joi.object({
    title: joi.string().required(),
    cover_photo_url: joi.string().uri().required(),
    num_pts: joi.number().integer().required()
  }).required()

  export const CreatedArticle = ArticleBody.keys({
    _id: shortidSchema,
    date_created: joi.string().isoDate().required()
  }).required();

}
