import * as joi from 'joi';
import { Models as M, Constants as SC } from 'reading_rewards';

export const QuestionSchema = joi.object({
  type: joi.string().valid([
    M.QuestionTypes.MultipleChoice,
    M.QuestionTypes.LongAnswer
  ]).required(),
  points: joi.number().integer().strict().min(SC.MinNumPointsPerQuestion).max(SC.MaxNumPointsPerQuestion).required(),
  prompt: joi.string().max(SC.MaxQuestionPromptChars).required()
}).required();