import * as joi from 'joi';
import { QuestionSchema } from '.';
import { Models as M, Constants as C } from 'reading_rewards';

export const MultipleChoiceQuestionSchema = QuestionSchema.keys({
  type: joi.string().valid([M.QuestionTypes.MultipleChoice]).required(),
  options: joi.array().items(joi.string().max(C.MaxQuestionPromptChars)).min(C.NumMultipleChoiceOptions).max(C.NumMultipleChoiceOptions).required(),
  answer_index: joi.number().integer().min(0).max(C.NumMultipleChoiceOptions - 1).required()
}).required()

export interface IMultipleChoiceQuestion extends M.IQuestion {
  type: M.QuestionTypes.MultipleChoice;
  options: string[];
  answer_index: number;
}