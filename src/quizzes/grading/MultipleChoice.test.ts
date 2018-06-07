import { assert } from 'chai';
import { Models as M } from 'reading_rewards';

import { IMultipleChoiceQuestion } from "../question_schemas/multiple_choice";
import { IMultipleChoiceAnswer } from "../answer_schemas/multiple_choice";
import { MultipleChoiceQuestionGradingStrategy } from './MultipleChoice';

describe('Grading Long Answer', function () {

  const question: IMultipleChoiceQuestion = {
    type: M.QuestionTypes.MultipleChoice,
    points: 5,
    prompt: 'Some prompt',
    options: ['option a', 'option b', 'option c', 'option d', 'option e'],
    answer_index: 2
  }

  const correctAnswer: IMultipleChoiceAnswer = {
    answer_index: 2
  }

  const incorrectAnswer: IMultipleChoiceAnswer = {
    answer_index: 3
  }

  const grader = new MultipleChoiceQuestionGradingStrategy();

  it ('should grade question correct', function() {
    const isCorrect = grader.grade(question, correctAnswer);
    assert.isTrue(isCorrect);
  })

  it ('should grade question incorrect', function() {
    const isCorrect = grader.grade(question, incorrectAnswer);
    assert.isFalse(isCorrect);
  })

})