import * as joi from 'joi';
import { QuestionTypes } from '../../data/quizzes';
import * as C from '../../constants';

export const QuestionSchema = joi.object({
  type: joi.string().valid([
    QuestionTypes.MultipleChoice,
    QuestionTypes.LongAnswer
  ]).required(),
  points: joi.number().integer().strict().min(C.MinNumPointsPerQuestion).max(C.MaxNumPointsPerQuestion).required(),
  prompt: joi.string().max(C.MaxQuestionPromptChars).required()
}).required();