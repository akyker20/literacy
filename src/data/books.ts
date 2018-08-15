import * as monk from 'monk';
import * as shortid from 'shortid';
import * as _ from 'lodash';
import { Models as M } from 'reading_rewards';

export interface IBookData {
  createBook: (book: M.IBook) => Promise<M.IBook>;
  getAllBooks: () => Promise<M.IBook[]>;
  getBook: (bookId: string) => Promise<M.IBook>;
  getBooksWithIds: (ids: string[]) => Promise<M.IBook[]>;
  updateBook: (book: M.IBook) => Promise<M.IBook>;
  deleteBook: (bookId: string) => Promise<M.IBook>;
  getBooksByAuthor: (authorId: string) => Promise<M.IBook[]>;
}

export class MongoBookData implements IBookData {

  private books: monk.ICollection;

  constructor(mongoConnectionStr: string) {
    let db = monk.default(mongoConnectionStr);
    this.books = db.get('books', { castIds: false });
  }

  createBook(book: M.IBook): Promise<M.IBook> {
    const copy = _.cloneDeep(book);
    copy._id = shortid.generate();
    return this.books.insert(copy);
  }

  getBooksByAuthor(authorId: string) {
    return this.books.find({ authors: { $elemMatch: { id: authorId } }})
  }

  getAllBooks(): Promise<M.IBook[]> {
    return this.books.find({});
  }

  getBooksWithIds(ids: string[]): Promise<M.IBook[]> {
    return this.books.find({ _id: { $in: ids }});
  }

  getBook(bookId: string): Promise<M.IBook> {
    return this.books.findOne({ _id: bookId })
  }

  updateBook(book: M.IBook): Promise<M.IBook> {
    return this.books.findOneAndUpdate({ _id: book._id }, book);
  }

  deleteBook(bookId: string): Promise<M.IBook> {
    return this.books.findOneAndDelete({ _id: bookId });
  }

}
