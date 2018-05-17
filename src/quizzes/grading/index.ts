import { IQuestion } from "../../models/quiz";

export interface IQuestionGradingStrategy {
  grade: (question: IQuestion, answer: any) => boolean;
}