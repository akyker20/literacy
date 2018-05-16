import { IQuestion } from "../../data/quizzes";

export interface IQuestionGradingStrategy {
  grade: (question: IQuestion, answer: any) => boolean;
}