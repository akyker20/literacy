import * as joi from 'joi';
import { QuestionSchema } from '.';
import { Models as M } from 'reading_rewards';

export const LongAnswerQuestionSchema = QuestionSchema.keys({
  type: joi.string().valid([M.QuestionTypes.LongAnswer]).required(),
}).required()