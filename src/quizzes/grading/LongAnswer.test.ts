import { ILongAnswerQuestion } from "../question_schemas/long_answer";
import { assert } from 'chai';

import { QuestionTypes } from "../../models/quiz";
import { ILongAnswerAnswer } from "../answer_schemas/long_answer";
import { LongAnswerQuestionGradingStrategy } from './LongAnswer';

describe('Grading Long Answer', function () {

  const question: ILongAnswerQuestion = {
    type: QuestionTypes.LongAnswer,
    points: 5,
    prompt: 'Some prompt'
  }

  const answer: ILongAnswerAnswer = {
    response: 'Some response'
  }

  const grader = new LongAnswerQuestionGradingStrategy();

  it ('should grade question', function() {
    const result = grader.grade(question, answer);
    assert.isTrue(result);
  })

})