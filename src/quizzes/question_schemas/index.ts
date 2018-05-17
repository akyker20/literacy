import * as joi from 'joi';
import * as C from '../../constants';
import { QuestionTypes } from '../../models/quiz';

export const QuestionSchema = joi.object({
  type: joi.string().valid([
    QuestionTypes.MultipleChoice,
    QuestionTypes.LongAnswer
  ]).required(),
  points: joi.number().integer().strict().min(C.MinNumPointsPerQuestion).max(C.MaxNumPointsPerQuestion).required(),
  prompt: joi.string().max(C.MaxQuestionPromptChars).required()
}).required();