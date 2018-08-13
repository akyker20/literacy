import * as monk from 'monk';
import { Models as M } from 'reading_rewards';

export interface IAuthorData {
  getAllAuthors: () => Promise<M.IAuthor[]>;
  getAuthorById: (id: string) => Promise<M.IAuthor>;
}

export interface IBookQuery {
  genres?: string[];
  lexile_range?: M.ILexileRange;
}

export class MongoAuthorData implements IAuthorData {

  private authors: monk.ICollection;

  constructor(mongoConnectionStr: string) {
    let db = monk.default(mongoConnectionStr);
    this.authors = db.get('authors', { castIds: false });
  }

  public getAllAuthors() {
    return this.authors.find({});
  }

  public getAuthorById(id: string) {
    return this.authors.findOne({ _id: id })
  }

}
