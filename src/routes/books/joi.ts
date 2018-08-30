import * as joi from 'joi';
import { shortidSchema, genFieldErr, lexileMeasureSchema } from '../extensions';

export namespace BodyValidators {

  export const InputBookReview = joi.object({
    interest: joi.number().integer().strict().valid([1, 2, 3, 4, 5]).required(),
    comprehension: joi.number().integer().strict().valid([1, 2, 3, 4, 5]).required(),
    review: joi.string().max(500).optional(),
    book_id: shortidSchema.required(),
    student_id: shortidSchema.required()
  }).required()

  export const sharedBookSchema = joi.object({
    cover_photo_url: joi.string().required().error(genFieldErr('cover_photo_url')),
    amazon_popularity: joi.number().min(0).max(5).required().error(genFieldErr('amazon_popularity')),
    title: joi.string().required().error(genFieldErr('title')),
    summary: joi.string().min(100).max(1000).required().error(genFieldErr('summary')),
    lexile_measure: lexileMeasureSchema.error(genFieldErr('lexile_measure')),
    num_pages: joi.number().min(40).max(3000).required().error(genFieldErr('num_pages')),
    isbn: joi.string().regex(/^(97(8|9))?\d{9}(\d|X)$/).required().error(genFieldErr('isbn')),
    genres: joi.array().items(joi.string()).min(1).max(5).unique().required().error(genFieldErr('genres')),
    series: joi.object({
      book_num: joi.number().integer().min(1).max(20).required(),
      id: shortidSchema,
      series_title: joi.string().required()
    }).optional(),
  }).strict().required();

  export const InputBookSchema = sharedBookSchema.keys({
    author_ids: joi.array().items(shortidSchema).required().error(genFieldErr('author_ids'))
  }).strict().required();

  export const CreatedBookSchema = sharedBookSchema.keys({
    _id: shortidSchema.required().error(genFieldErr('_id')),
    authors: joi.array().items(joi.object({
      id: shortidSchema,
      name: joi.string().required()
    }).min(1).max(4).required())
  }).required();

  export const InputGenreSchema = joi.object({
    title: joi.string().required().error(genFieldErr('title')),
    description: joi.string().max(200).required().error(genFieldErr('description'))
  }).required();

  export const CreatedGenreSchema = InputGenreSchema.keys({
    _id: shortidSchema.required().error(genFieldErr('_id'))
  }).required();

}
