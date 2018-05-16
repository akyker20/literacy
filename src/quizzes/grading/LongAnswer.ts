import { IQuestionGradingStrategy } from ".";
import { ILongAnswerQuestion } from "../question_schemas/long_answer";
import { ILongAnswerAnswer } from "../answer_schemas/long_answer";

export class LongAnswerQuestionGradingStrategy implements IQuestionGradingStrategy {
  grade(question: ILongAnswerQuestion, answer: ILongAnswerAnswer): boolean {
    return true;
  }
}