import { IQuestionGradingStrategy } from ".";
import { IMultipleChoiceAnswer } from "../answer_schemas/multiple_choice";
import { IMultipleChoiceQuestion } from "../question_schemas/multiple_choice";

export class MultipleChoiceQuestionGradingStrategy implements IQuestionGradingStrategy {
  grade(question: IMultipleChoiceQuestion, answer: IMultipleChoiceAnswer): boolean {
    return question.answer_index === answer.answer_index;
  }
}