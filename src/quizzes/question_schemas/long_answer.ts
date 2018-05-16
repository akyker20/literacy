import * as joi from 'joi';
import { QuestionTypes } from '../../data/quizzes';
import { QuestionSchema } from '.';

export const LongAnswerQuestionSchema = QuestionSchema.keys({
  type: joi.string().valid([QuestionTypes.LongAnswer]).required(),
}).required()