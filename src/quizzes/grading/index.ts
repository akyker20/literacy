import { Models as M } from 'reading_rewards';

export interface IQuestionGradingStrategy {
  grade: (question: M.IQuestion, answer: any) => boolean;
}