import * as monk from 'monk';
import * as shortid from 'shortid';
import * as _ from 'lodash';
import * as fuse from 'fuse.js';
import { Models as M } from 'reading_rewards';

const searchBooksOptions: fuse.FuseOptions = {
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

export interface IBookData {
  createBook: (book: M.IBook) => Promise<M.IBook>;
  getMatchingBooks: (query: IBookQuery) => Promise<M.IBook[]>;
  getAllBooks: () => Promise<M.IBook[]>;
  getBook: (bookId: string) => Promise<M.IBook>;
  getBooksWithIds: (ids: string[]) => Promise<M.IBook[]>;
  updateBook: (book: M.IBook) => Promise<M.IBook>;
  deleteBook: (bookId: string) => Promise<M.IBook>;
  searchBooks: (query: string) => Promise<M.IBook[]>;
  getBooksByAuthor: (authorId: string) => Promise<M.IBook[]>;
}

export interface IBookQuery {
  genres?: string[];
  lexile_range?: M.ILexileRange;
}

export class MongoBookData implements IBookData {

  private books: monk.ICollection;

  constructor(mongoConnectionStr: string) {
    let db = monk.default(mongoConnectionStr);
    this.books = db.get('books', { castIds: false });
  }

  getBooksByAuthor(authorId: string) {
    return this.books.find({ authors: { $elemMatch: { id: authorId } }})
  }

  createBook(book: M.IBook): Promise<M.IBook> {
    const copy = _.cloneDeep(book);
    copy._id = shortid.generate();
    return this.books.insert(copy);
  }

  async searchBooks(query: string): Promise<M.IBook[]> {
    const allBooks = await this.getAllBooks();
    const fuseUnit = new fuse(allBooks, searchBooksOptions);
    return _.slice(fuseUnit.search(query), 0, 30);
  }

  getAllBooks(): Promise<M.IBook[]> {
    return this.books.find({});
  }

  getBooksWithIds(ids: string[]): Promise<M.IBook[]> {
    return this.books.find({ _id: { $in: ids }});
  }

  getMatchingBooks(query: IBookQuery): Promise<M.IBook[]> {
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
