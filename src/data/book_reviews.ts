import * as monk from 'monk';
import * as _ from 'lodash';
import * as shortid from 'shortid';

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

export interface IBookReviewData {
  createBookReview: (review: IBookReview) => Promise<IBookReview>;
  getBookReviewsForStudent: (studentId: string) => Promise<IBookReview[]>;
  getBookReview: (studentId: string, bookId: string) => Promise<IBookReview>;
}

export class MongoBookReviewData implements IBookReviewData {

  private bookReviews: monk.ICollection; 

  constructor(mongoConnectionStr: string) {
    let db = monk.default(mongoConnectionStr);
    this.bookReviews = db.get('book_reviews', { castIds: false });
  }

  createBookReview(review: IBookReview): Promise<IBookReview> {
    const copy = _.cloneDeep(review);
    copy._id = shortid.generate();
    return this.bookReviews.insert(copy);
  }

  getBookReviewsForStudent(studentId: string): Promise<IBookReview[]> {
    return this.bookReviews.find({ student_id: studentId });
  }

  getBookReview(studentId: string, bookId: string): Promise<IBookReview> {
    return this.bookReviews.findOne({ 
      student_id: studentId,
      book_id: bookId
    })
  }

}
