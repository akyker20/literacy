import { Models } from 'reading_rewards';

import { IQuestionGradingStrategy } from ".";
import { ILongAnswerAnswer } from "../answer_schemas/long_answer";

export class LongAnswerQuestionGradingStrategy implements IQuestionGradingStrategy {
  grade(question: Models.ILongAnswerQuestion, answer: ILongAnswerAnswer): boolean {
    return true;
  }
}