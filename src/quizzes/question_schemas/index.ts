import * as joi from 'joi';
import { QuestionTypes } from '../../data/quizzes';
import * as C from '../../constants';

export const QuestionSchema = joi.object({
  type: joi.string().valid([QuestionTypes.MultipleChoice]).required(),
  points: joi.number().integer().min(C.MinNumPointsPerQuestion).max(C.MaxNumPointsPerQuestion).required(),
  prompt: joi.string().max(C.MaxQuestionPromptChars).required()
}).required()