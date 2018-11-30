import { assert } from 'chai';
import * as faker from 'faker';
import { Models as M, Mockers } from 'reading_rewards';

import { QuizGrader } from '.';
import { LongAnswerQuestionSchema } from './question_schemas/long_answer';
import { LongAnswerAnswerSchema, ILongAnswerAnswer } from './answer_schemas/long_answer';
import { MultipleChoiceQuestionSchema, IMultipleChoiceQuestion } from './question_schemas/multiple_choice';
import { MultipleChoiceAnswerSchema, IMultipleChoiceAnswer } from './answer_schemas/multiple_choice';
import { MultipleChoiceQuestionGradingStrategy } from './grading/MultipleChoice';
import { LongAnswerQuestionGradingStrategy } from './grading/LongAnswer';

// setup grader

const quizGrader = new QuizGrader();

quizGrader.register(
  M.QuestionTypes.LongAnswer, 
  new LongAnswerQuestionGradingStrategy(),
  LongAnswerQuestionSchema,
  LongAnswerAnswerSchema
);

quizGrader.register(
  M.QuestionTypes.MultipleChoice,
  new MultipleChoiceQuestionGradingStrategy(),
  MultipleChoiceQuestionSchema,
  MultipleChoiceAnswerSchema
);

// create some data

const quiz: M.IQuiz = Mockers.mockQuiz({
  questions: [
    {
      type: M.QuestionTypes.LongAnswer,
      points: 4,
      prompt: faker.lorem.sentence(20)
    },
    {
      type: M.QuestionTypes.LongAnswer,
      points: 4,
      prompt: faker.lorem.sentence(20)
    },
    {
      type: M.QuestionTypes.MultipleChoice,
      points: 2,
      prompt: faker.lorem.sentence(20),
      options: ['option a', 'option b', 'option c', 'option d', 'option e'],
      answer_index: 1
    } as M.IQuestion,
    {
      type: M.QuestionTypes.MultipleChoice,
      points: 2,
      prompt: faker.lorem.sentence(20),
      options: ['option a', 'option b', 'option c', 'option d', 'option e'],
      answer_index: 2
    } as M.IQuestion,
    {
      type: M.QuestionTypes.MultipleChoice,
      points: 2,
      prompt: faker.lorem.sentence(20),
      options: ['option a', 'option b', 'option c', 'option d', 'option e'],
      answer_index: 2
    } as M.IQuestion
  ]
})

const answers1: (ILongAnswerAnswer | IMultipleChoiceAnswer)[] = [
  {
    response: 'Some response' // correct
  },
  {
    response: 'Some response' // correct
  },
  {
    answer_index: 1 // correct
  },
  {
    answer_index: 2 // correct
  },
  {
    answer_index: 3 // incorrect
  }
];

const answers2: (ILongAnswerAnswer | IMultipleChoiceAnswer)[] = [
  {
    response: 'Some response' // correct
  },
  {
    response: 'Some response' // correct
  },
  {
    answer_index: 4 // incorrect
  },
  {
    answer_index: 3 // incorrect
  },
  {
    answer_index: 3 // incorrect
  }
];


describe('QuizGrader', function() {

  describe('#isQuestionSchemaValid', function() {

    it ('should return error for invalid MC', function() {
      const invalidMCQuestion = {
        type: M.QuestionTypes.MultipleChoice,
        prompt: 'Some Prompt',
        points: 4
      }
      assert.isNotEmpty(quizGrader.isQuestionSchemaValid(invalidMCQuestion));
    })

    it ('should return error for invalid MC', function() {
      const invalidLAQuestion = {
        type: M.QuestionTypes.LongAnswer,
        prompt: 'Some Prompt',
        points: 4,
        options: ['option a', 'option b', 'option c', 'option d', 'option e'],
        answer_index: 2
      }
      assert.isNotEmpty(quizGrader.isQuestionSchemaValid(invalidLAQuestion));
    })

    it ('should return no error for valid mc question', function() {
      const validMCQuestion: IMultipleChoiceQuestion = {
        type: M.QuestionTypes.MultipleChoice,
        prompt: 'Some Prompt',
        points: 4,
        options: ['option a', 'option b', 'option c', 'option d', 'option e'],
        answer_index: 2
      }
      assert.isNull(quizGrader.isQuestionSchemaValid(validMCQuestion));
    })

    it ('should return no error for valid la question', function() {
      const validLAQuestion: M.ILongAnswerQuestion = {
        type: M.QuestionTypes.LongAnswer,
        prompt: 'Some Prompt',
        points: 4
      }
      assert.isNull(quizGrader.isQuestionSchemaValid(validLAQuestion));
    })

  })


  describe('#isAnswerSchemaValid', function() {

    it ('should return error for invalid MC answer', function() {
      assert.isNotEmpty(quizGrader.isAnswerSchemaValid(M.QuestionTypes.MultipleChoice, {
        response: 'some response'
      }));
    })

    it ('should return error for invalid LA answer', function() {
      assert.isNotEmpty(quizGrader.isAnswerSchemaValid(M.QuestionTypes.LongAnswer, {
        answer_index: 2
      }));
    })

    it ('should return no error for valid LA answer', function() {
      assert.isNull(quizGrader.isAnswerSchemaValid(M.QuestionTypes.LongAnswer, {
        response: 'Some response'
      }));
    });

    it ('should return no error for valid MC answer', function() {
      assert.isNull(quizGrader.isAnswerSchemaValid(M.QuestionTypes.MultipleChoice, {
        answer_index: 4
      }));
    });

  })

  describe('#gradeQuiz', function() {

    it('should grade first set of answers correctly', function() {
      const expectedScore = 12/14 * 100.0;
      const actualScore = quizGrader.gradeQuiz(quiz.questions, answers1);
      assert.equal(actualScore, expectedScore);
    })
  
    it('should grade second set of questions correctly', function() {
      const expectedScore = 8/14 * 100.0;
      const actualScore = quizGrader.gradeQuiz(quiz.questions, answers2);
      assert.equal(actualScore, expectedScore);
    })

  })

})