import * as monk from 'monk';
import * as shortid from 'shortid';
import * as _ from 'lodash';
import * as fuse from 'fuse.js';
import { ILexileRange } from '../models';

const searchBooksOptions = {
  shouldSort: true,
  threshold: 0.6,
  location: 0,
  maxPatternLength: 64,
  minMatchCharLength: 1,
  keys: [
    "title",
    "author"
  ]
};

export interface IBook {
  _id?: string;
  title: string;
  author: string;
  isbn: string;
  lexile_measure: number;
  amazon_popularity: number;
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
  searchBooks: (query: string) => Promise<IBook[]>
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
    const copy = _.cloneDeep(book);
    copy._id = shortid.generate();
    return this.books.insert(copy);
  }

  async searchBooks(query: string): Promise<IBook[]> {
    const allBooks = await this.getAllBooks();
    const fuseUnit = new fuse(allBooks, searchBooksOptions);
    return _.slice(fuseUnit.search(query), 0, 30);
  }

  getAllBooks(): Promise<IBook[]> {
    return this.books.find({});
  }

  getMatchingBooks(query: IBookQuery): Promise<IBook[]> {
    const queryObj: any = {};
    if (!_.isEmpty(query.lexile_range)) {
      const { min, max } = query.lexile_range;
      queryObj.lexile_measure = { $gte: min, $lte: max };
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
