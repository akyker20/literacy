import { IMultipleChoiceQuestion, IQuestion } from "../../data/quizzes";
import { IQuestionGradingStrategy } from ".";

export class MultipleChoiceQuestionGradingStrategy implements IQuestionGradingStrategy {
  grade(question: IQuestion, answer: number): boolean {
    const mcQuestion = question as IMultipleChoiceQuestion;
    return answer === mcQuestion.correct_answer_index;
  }
}