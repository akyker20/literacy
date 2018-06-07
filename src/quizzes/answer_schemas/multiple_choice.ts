import * as joi from 'joi';
import { Constants } from 'reading_rewards';

export const MultipleChoiceAnswerSchema = joi.object({
  answer_index: joi.number().integer().min(0).max(Constants.NumMultipleChoiceOptions - 1).required()
}).required()

export interface IMultipleChoiceAnswer {
  answer_index: number;
}