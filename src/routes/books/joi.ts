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

  export const InputBookSchema = joi.object({
    cover_photo_url: joi.string().required(),
    goodreads_rating: joi.number().min(0).max(5).required(),
    title: joi.string().required(),
    summary: joi.string().min(100).max(1000).required(),
    lexile_measure: lexileMeasureSchema,
    num_pages: joi.number().min(40).max(3000).required(),
    isbn: joi.string().regex(/^(97(8|9))?\d{9}(\d|X)$/).required(),
    genres: joi.array().items(shortidSchema).min(1).max(5).unique().required().error(genFieldErr('genres')),
    series: joi.object({
      book_num: joi.number().integer().min(1).max(20).required(),
      id: shortidSchema,
      series_title: joi.string().required()
    }).optional(),
    authors: joi.array().items(shortidSchema).min(1).max(5).unique().required()
  }).strict().required();
  
  export const CreatedBookSchema = InputBookSchema.keys({
    _id: shortidSchema
  }).required();

  export const InputGenreSchema = joi.object({
    title: joi.string().required().error(genFieldErr('title')),
    description: joi.string().max(200).required().error(genFieldErr('description'))
  }).required();

  export const CreatedGenreSchema = InputGenreSchema.keys({
    _id: shortidSchema
  }).required();

}
