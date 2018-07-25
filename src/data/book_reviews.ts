import * as monk from 'monk';
import * as _ from 'lodash';
import * as shortid from 'shortid';
import { Models as M } from 'reading_rewards';

export interface IBookReviewData {
  createBookReview: (review: M.IBookReview) => Promise<M.IBookReview>;
  getBookReviewsForStudent: (studentId: string) => Promise<M.IBookReview[]>;
  getReviewsForBook: (bookId: string) => Promise<M.IBookReview[]>
  getBookReview: (studentId: string, bookId: string) => Promise<M.IBookReview>;
}

export class MongoBookReviewData implements IBookReviewData {

  private bookReviews: monk.ICollection; 

  constructor(mongoConnectionStr: string) {
    let db = monk.default(mongoConnectionStr);
    this.bookReviews = db.get('book_reviews', { castIds: false });
  }

  createBookReview(review: M.IBookReview): Promise<M.IBookReview> {
    const copy = _.cloneDeep(review);
    copy._id = shortid.generate();
    return this.bookReviews.insert(copy);
  }

  getReviewsForBook(bookId: string): Promise<M.IBookReview[]> {
    return this.bookReviews.find({ book_id: bookId});
  }

  getBookReviewsForStudent(studentId: string): Promise<M.IBookReview[]> {
    return this.bookReviews.find({ student_id: studentId });
  }

  getBookReview(studentId: string, bookId: string): Promise<M.IBookReview> {
    return this.bookReviews.findOne({ 
      student_id: studentId,
      book_id: bookId
    })
  }

}
