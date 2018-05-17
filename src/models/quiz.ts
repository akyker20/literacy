export enum QuestionTypes {
  MultipleChoice = 'mc',
  LongAnswer = 'la'
}

export interface IQuestion {
  type: QuestionTypes;
  points: number;
  prompt: string;
}

export interface IQuizBody {
  questions: IQuestion[];
  book_id?: string;
}

export interface IQuiz extends IQuizBody {
  _id?: string;
  date_created: string;
}