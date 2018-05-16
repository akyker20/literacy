import * as joi from 'joi';
import { QuestionTypes, IQuestion } from '../../data/quizzes';
import { QuestionSchema } from '.';

export const LongAnswerQuestionSchema = QuestionSchema.keys({
  type: joi.string().valid([QuestionTypes.LongAnswer]).required(),
}).required()

export interface ILongAnswerQuestion extends IQuestion {
  type: QuestionTypes.LongAnswer;
}