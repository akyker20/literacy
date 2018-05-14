import * as monk from 'monk';
import _ = require('lodash');
import { ILexileRange } from '../models';

export enum QuestionTypes {
  MultipleChoice = 'mc',
  LongAnswer = 'la'
}

export interface IQuestion {
  type: QuestionTypes;
  question: string;
}

export interface IMultipleChoiceQuestion extends IQuestion {
  type: QuestionTypes.MultipleChoice;
  correct_answer_index: number;
  possible_answers: string[];
}

export interface ILongAnswerQuestion extends IQuestion {
  type: QuestionTypes.LongAnswer;
}

export interface IQuiz {
  _id?: string;
  book?: string;
  date_created: string;
  questions: IQuestion[];
}

export interface IQuizData {
  createQuiz: (quiz: IQuiz) => Promise<IQuiz>;
  getQuizForBook: (bookId: string) => Promise<IQuiz>;
  getGenericQuiz: () => Promise<IQuiz>;
  deleteQuiz: (quizId: string) => Promise<IQuiz>;
  updateQuiz: (quiz: IQuiz) => Promise<IQuiz>;
}

export class MongoQuizData implements IQuizData {

  private quizzes: monk.ICollection; 

  constructor(mongoConnectionStr: string) {
    let db = monk.default(mongoConnectionStr);
    this.quizzes = db.get('quizzes', { castIds: false });
  }

  createQuiz(quiz: IQuiz): Promise<IQuiz> {
    return this.quizzes.insert(quiz);
  }

  getQuizForBook(bookId: string): Promise<IQuiz> {
    return this.quizzes.findOne({ book: bookId })
  }
  
  async getGenericQuiz (): Promise<IQuiz> {
    const genericQuizzes = this.quizzes.find({ book: { $exists: false }});
    return _.sample(genericQuizzes);
  }
  
  deleteQuiz(quizId: string): Promise<IQuiz> {
    return this.quizzes.findOneAndDelete({ _id: quizId })
  }

  updateQuiz(quiz: IQuiz): Promise<IQuiz> {
    return this.quizzes.findOneAndUpdate({ _id: quiz._id }, quiz)
  }

}
