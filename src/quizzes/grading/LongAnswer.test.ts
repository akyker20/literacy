import { assert } from 'chai';
import { Models as M } from 'reading_rewards';

import { ILongAnswerAnswer } from "../answer_schemas/long_answer";
import { LongAnswerQuestionGradingStrategy } from './LongAnswer';

describe('Grading Long Answer', function () {

  const question: M.ILongAnswerQuestion = {
    type: M.QuestionTypes.LongAnswer,
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