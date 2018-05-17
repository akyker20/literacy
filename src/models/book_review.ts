import * as shortid from 'shortid';
import * as _ from 'lodash';
import * as faker from 'faker';

export interface IBookReviewBody {
  _id?: string;
  review?: string;
  student_id: string;
  book_id: string;
  comprehension: 1|2|3|4|5;
}

export interface IBookReview extends IBookReviewBody {
  date_created: string;
  book_lexile_measure: number;
}

export function mockBookReview(options: {
  _id?: string,
  book_id: string,
  student_id: string,
  date_created?: string,
  comprehension?: 1|2|3|4|5,
  review?: string,
}): IBookReview {
  return {
    _id: options._id || shortid.generate(),
    book_id: options.book_id,
    student_id: options.student_id,
    date_created: options.date_created || new Date().toISOString(),
    review: options.review || faker.lorem.paragraph(1),
    comprehension: _.isNumber(options.comprehension) ? options.comprehension : _.random(1, 5) as 1|2|3|4|5,
    book_lexile_measure: _.random(300, 1800)
  }
}