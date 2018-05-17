import * as joi from 'joi';
import * as C from '../../constants';
import { QuestionSchema } from '.';
import { QuestionTypes, IQuestion } from '../../models/quiz';

export const MultipleChoiceQuestionSchema = QuestionSchema.keys({
  type: joi.string().valid([QuestionTypes.MultipleChoice]).required(),
  options: joi.array().items(joi.string().max(C.MaxQuestionPromptChars)).min(C.NumMultipleChoiceOptions).max(C.NumMultipleChoiceOptions).required(),
  answer_index: joi.number().integer().min(0).max(C.NumMultipleChoiceOptions - 1).required()
}).required()

export interface IMultipleChoiceQuestion extends IQuestion {
  type: QuestionTypes.MultipleChoice;
  options: string[];
  answer_index: number;
}