import * as _ from 'lodash';
import { assert } from 'chai';
import * as joi from 'joi';

import { QuestionTypes, IQuiz, IQuestion } from "../data/quizzes";
import { LongAnswerQuestionSchema } from './question_schemas/long_answer';
import { LongAnswerAnswerSchema } from './answer_schemas/long_answer';
import { MultipleChoiceQuestionSchema } from './question_schemas/multiple_choice';
import { MultipleChoiceAnswerSchema } from './answer_schemas/multiple_choice';
import { IQuestionGradingStrategy } from './grading';
import { LongAnswerQuestionGradingStrategy } from './grading/LongAnswer';
import { MultipleChoiceQuestionGradingStrategy } from './grading/MultipleChoiceGradingStrategy';

type QuestionStrategyMap = Map<QuestionTypes, {
  gradingStrategy: IQuestionGradingStrategy,
  questionSchema: joi.JoiObject,
  answerSchema: joi.JoiObject
}>

class QuizGrader {

  private strategyMap: QuestionStrategyMap = new Map();

  register(
    type: QuestionTypes,
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
  isQuestionSchemaValid(question: IQuestion): string {
    assert.isTrue(this.strategyMap.has(question.type), `Question type ${question.type} not accounted for.`)
    const schema = this.strategyMap.get(question.type).questionSchema;
    const { error } = joi.validate(question, schema);
    if (_.isEmpty(error)) {
      return null;
    }
    return error.message;
  }

  isAnswerSchemaValid(questionType: QuestionTypes, answer: any): string {
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

  gradeQuiz(quiz: IQuiz, answers: any[]): number {

    assert.isTrue(quiz.questions.length === answers.length, 'Must be the same amount of answers as questions');
    const maxPossiblePoints = _.chain(quiz.questions).map('points').sum().value();
    console.log(quiz.questions.map(q => q.points));

    let pointsEarned = 0;
    
    for (let i = 0; i < quiz.questions.length; i++) {
      const question = quiz.questions[i];
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
  QuestionTypes.LongAnswer, 
  new LongAnswerQuestionGradingStrategy(),
  LongAnswerQuestionSchema,
  LongAnswerAnswerSchema
);

QuizGraderInstance.register(
  QuestionTypes.MultipleChoice,
  new MultipleChoiceQuestionGradingStrategy(),
  MultipleChoiceQuestionSchema,
  MultipleChoiceAnswerSchema
);