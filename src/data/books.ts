import * as monk from 'monk';
import _ = require('lodash');
import { ILexileRange } from '../models';

export interface IBook {
  _id?: string;
  title: string;
  author: string;
  isbn: string;
  lexile_measure: number;
  num_pages: number;
  genres: string[];
}

export interface IBookData {
  createBook: (book: IBook) => Promise<IBook>;
  getMatchingBooks: (query: IBookQuery) => Promise<IBook[]>;
  getAllBooks: () => Promise<IBook[]>;
  getBook: (bookId: string) => Promise<IBook>;
  updateBook: (book: IBook) => Promise<IBook>;
  deleteBook: (bookId: string) => Promise<IBook>;
}

export interface IBookQuery {
  genres?: string[];
  lexile_range?: ILexileRange;
}

export class MongoBookData implements IBookData {

  private books: monk.ICollection; 

  constructor(mongoConnectionStr: string) {
    let db = monk.default(mongoConnectionStr);
    this.books = db.get('books', { castIds: false });
  }

  createBook(book: IBook): Promise<IBook> {
    return this.books.insert(book);
  }

  getAllBooks(): Promise<IBook[]> {
    return this.books.find({});
  }

  getMatchingBooks(query: IBookQuery): Promise<IBook[]> {
    const queryObj: any = {};
    if (!_.isEmpty(query.lexile_range)) {
      const { min, max } = query.lexile_range;
      queryObj.lexile_measure = { $gt: min, $lt: max };
    }
    if (!_.isEmpty(query.genres)) {
      queryObj.genres = { $in: query.genres };
    }
    return this.books.find(queryObj)
  }

  getBook(bookId: string): Promise<IBook> {
    return this.books.findOne({ _id: bookId })
  }

  updateBook(book: IBook): Promise<IBook> {
    return this.books.findOneAndUpdate({ _id: book._id }, book);
  }

  deleteBook(bookId: string): Promise<IBook> {
    return this.books.findOneAndDelete({ _id: bookId });
  }

}
