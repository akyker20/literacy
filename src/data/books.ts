import * as monk from 'monk';

export interface IBook {
  title: string;
  author: string;
  isbn: string;
  lexile_measure: number;
  num_pages: number;
  genres: string[];
}

export interface IBookData {
  createBook: (book: IBook) => Promise<IBook>;
  getBooksOfGenre: (genreId: string) => Promise<IBook[]>;
  getBooks: () => Promise<IBook[]>;
  getBook: (isbn: string) => Promise<IBook>;
  deleteBook: (isbn: string) => Promise<IBook>;
}

export class MongoBookData implements IBookData {

  private books: monk.ICollection; 

  constructor(mongoConnectionStr: string) {
    let db = monk.default(mongoConnectionStr);
    this.books = db.get('books');
  }

  createBook(book: IBook): Promise<IBook> {
    return this.books.insert(book);
  }

  getBooks(): Promise<IBook[]> {
    return this.books.find({}, { castIds: false });
  }

  getBooksOfGenre(genreId: string): Promise<IBook[]> {
    return this.books.find({ genres: genreId });
  }

  getBook(isbn: string): Promise<IBook> {
    return this.books.findOne({ isbn }, { castIds: false })
  }

  deleteBook(isbn: string): Promise<IBook> {
    return this.books.findOneAndDelete({ isbn });
  }

}
