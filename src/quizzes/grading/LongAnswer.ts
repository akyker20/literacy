import { IQuestion } from "../../data/quizzes";
import { IQuestionGradingStrategy } from ".";

export class LongAnswerQuestionGradingStrategy implements IQuestionGradingStrategy {
  grade(question: IQuestion, answer: any): boolean {
    return true;
  }
}