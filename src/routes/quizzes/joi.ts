import * as joi from 'joi';
import { shortidSchema, genFieldErr } from '../extensions';
import { QuestionSchema } from '../../quizzes/question_schemas';
import { Constants as SC } from 'reading_rewards';

export namespace BodyValidators {

  export const InputQuizSchema = joi.object({
    questions: joi.array().items(QuestionSchema.unknown(true)).min(SC.MinQuestionsInQuiz).max(SC.MaxQuestionsInQuiz).required(),
    book_id: shortidSchema.optional().error(genFieldErr('book'))
  }).required()

  export const CreatedQuizSchema = InputQuizSchema.keys({
    _id: shortidSchema.required().error(genFieldErr('_id')),
    date_created: joi.string().isoDate().required().error(genFieldErr('date_created')),
  }).required();

  export const QuizSubmissionSchema = joi.object({
    quiz_id: shortidSchema.required().error(genFieldErr('quiz_id')),
    student_id: shortidSchema.required().error(genFieldErr('student_id')),
    book_id: shortidSchema.required().error(genFieldErr('book_id')),
    answers: joi.any()
  }).required();

}
