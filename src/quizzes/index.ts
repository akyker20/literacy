/**
 * For each type of question, there is a grading strategy, answer schema, and question schema
 * The question and answer schema is used to validate quizzes during creation
 * The grading strategy is used to grade the quiz during quiz submission.
 */

import * as _ from 'lodash';
import { assert } from 'chai';
import * as joi from 'joi';
import { Models as M } from 'reading_rewards';

import { LongAnswerQuestionSchema } from './question_schemas/long_answer';
import { LongAnswerAnswerSchema } from './answer_schemas/long_answer';
import { MultipleChoiceQuestionSchema } from './question_schemas/multiple_choice';
import { MultipleChoiceAnswerSchema } from './answer_schemas/multiple_choice';
import { IQuestionGradingStrategy } from './grading';
import { LongAnswerQuestionGradingStrategy } from './grading/LongAnswer';
import { MultipleChoiceQuestionGradingStrategy } from './grading/MultipleChoice';

type QuestionStrategyMap = Map<M.QuestionTypes, {
  gradingStrategy: IQuestionGradingStrategy,
  questionSchema: joi.JoiObject,
  answerSchema: joi.JoiObject
}>

export class QuizGrader {

  private strategyMap: QuestionStrategyMap = new Map();

  register(
    type: M.QuestionTypes,
    gradingStrategy: IQuestionGradingStrategy,
    questionSchema: joi.JoiObject,
    answerSchema: joi.JoiObject
  ) {
    this.strategyMap.set(type, {
      gradingStrategy,
      questionSchema,
      answerSchema
    });
  }

  /**
   * Returns an error message, null if no error exists.
   * @param question 
   */
  isQuestionSchemaValid(question: M.IQuestion): string {
    assert.isTrue(this.strategyMap.has(question.type), `Question type ${question.type} not accounted for.`)
    const schema = this.strategyMap.get(question.type).questionSchema;
    const { error } = joi.validate(question, schema);
    if (_.isEmpty(error)) {
      return null;
    }
    return error.message;
  }

  isAnswerSchemaValid(questionType: M.QuestionTypes, answer: any): string {
    const schema = this.strategyMap.get(questionType).answerSchema;
    const { error } = joi.validate(answer, schema);
    if (_.isEmpty(error)) {
      return null;
    }
    return error.message;
  }

  /**
   * Assumptions: the number of quiz questions and answers are the same.
   */

  gradeQuiz(questions: M.IQuestion[], answers: any[]): number {

    assert.isTrue(questions.length === answers.length, 'Must be the same amount of answers as questions');
    const maxPossiblePoints = _.chain(questions).map('points').sum().value();

    let pointsEarned = 0;
    
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const answer = answers[i];
      const { gradingStrategy } = this.strategyMap.get(question.type);
      const isCorrect = gradingStrategy.grade(question, answer);
      if (isCorrect) pointsEarned += question.points;
    }

    return (pointsEarned / maxPossiblePoints) * 100.0;

  }

}

export const QuizGraderInstance = new QuizGrader();

QuizGraderInstance.register(
  M.QuestionTypes.LongAnswer, 
  new LongAnswerQuestionGradingStrategy(),
  LongAnswerQuestionSchema,
  LongAnswerAnswerSchema
);

QuizGraderInstance.register(
  M.QuestionTypes.MultipleChoice,
  new MultipleChoiceQuestionGradingStrategy(),
  MultipleChoiceQuestionSchema,
  MultipleChoiceAnswerSchema
);