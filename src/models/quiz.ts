import * as shortid from 'shortid';

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

export function mockQuizQuestion(): IQuestion {
  return {
    points: 5,
    type: QuestionTypes.LongAnswer,
    prompt: 'Here is a question'
  }
}

export function mockQuiz(options: {
  _id?: string,
  questions: IQuestion[],
  book_id?: string,
  date_created?: string
}): IQuiz {
  let quiz: IQuiz = {
    _id: options._id || shortid.generate(),
    date_created: options.date_created || new Date().toISOString(),
    questions: options.questions
  }
  if (options.book_id) {
    quiz.book_id = options.book_id;
  }
  return quiz;
}