import * as shortid from 'shortid';
import * as _ from 'lodash';

export interface IQuizSubmissionBody {
  quiz_id: string;
  student_id: string;
  book_id: string;
  answers: any[];
}

export interface IQuizSubmission extends IQuizSubmissionBody {
  _id?: string;
  score: number;
  passed: boolean;
  date_created: string;
}

export function mockQuizSubmission(options: {
  _id?: string;
  score?: number;
  passed?: boolean;
  date_created?: string;
  quiz_id: string;
  student_id: string;
  book_id: string;
  answers: any[];
}): IQuizSubmission {
  return {
    _id: options._id || shortid.generate(),
    score: _.isNumber(options.score) ? options.score : _.random(20, 100),
    passed: _.isUndefined(options.passed) ? (_.random(0, 1) === 1) : options.passed,
    date_created: options.date_created || new Date().toISOString(),
    quiz_id: options.quiz_id,
    student_id: options.student_id,
    book_id: options.book_id,
    answers: options.answers
  }
}