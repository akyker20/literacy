import * as joi from 'joi';
import { QuestionSchema } from '.';
import { QuestionTypes, IQuestion } from '../../models/quiz';

export const LongAnswerQuestionSchema = QuestionSchema.keys({
  type: joi.string().valid([QuestionTypes.LongAnswer]).required(),
}).required()

export interface ILongAnswerQuestion extends IQuestion {
  type: QuestionTypes.LongAnswer;
}