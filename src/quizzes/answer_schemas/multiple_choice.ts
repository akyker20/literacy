import * as joi from 'joi';
import { NumMultipleChoiceOptions } from '../../constants';

export const MultipleChoiceAnswerSchema = joi.object({
  answer_index: joi.number().integer().min(0).max(NumMultipleChoiceOptions - 1).required()
}).required()

export interface IMultipleChoiceAnswer {
  answer_index: number;
}