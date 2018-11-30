import * as joi from 'joi';
import { shortidSchema, lexileMeasureSchema } from '../extensions';
import { QuestionSchema } from '../../quizzes/question_schemas';

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

  export const ArticleVersionBody = joi.object({
    lexile_measure: lexileMeasureSchema,
    article_id: shortidSchema,
    article_text: joi.string().required(),
    questions: joi.array().items(QuestionSchema.unknown(true)).required(),
  }).required()

  export const CreatedArticleVersion = ArticleVersionBody.keys({
    _id: shortidSchema,
  }).required();

}
