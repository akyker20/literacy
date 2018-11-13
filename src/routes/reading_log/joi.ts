import * as joi from 'joi';
import { shortidSchema } from '../extensions';
import { Models as M } from 'reading_rewards';
import * as _ from 'lodash';

export namespace BodyValidators {

  export const ReadingLogSchema = joi.object({
    student_id: shortidSchema,
    book_id: shortidSchema,
    read_with: joi.string().valid(_.values(M.ReadingWith)).required(),
    start_page: joi.number().integer().required(),
    final_page: joi.number().integer().required(),
    duration_min: joi.number().integer().min(0).max(60 * 10).required(),
    is_last_log_for_book: joi.boolean().required(),
    summary: joi.string().max(2000).required(),
    interest: joi.number().integer().strict().valid([1, 2, 3, 4, 5]).required(),
    comprehension: joi.number().integer().strict().valid([1, 2, 3, 4, 5]).required(),
  }).strict().required();

}
