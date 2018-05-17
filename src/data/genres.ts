import * as monk from 'monk';
import * as _ from 'lodash';
import * as shortid from 'shortid';

import { IGenre } from '../models/genre';

export interface IGenreData {
  createGenre: (genre: IGenre) => Promise<IGenre>;
  getGenres: () => Promise<IGenre[]>;
  getGenreById: (genreId: string) => Promise<IGenre>;
  updateGenre(genre: IGenre): Promise<IGenre>;
  deleteGenre: (genreId: string) => Promise<IGenre>;
}

export class MongoGenreData implements IGenreData {

  private genres: monk.ICollection; 

  constructor(mongoConnectionStr: string) {
    let db = monk.default(mongoConnectionStr);
    this.genres = db.get('genres', { castIds: false });
  }

  createGenre(genre: IGenre): Promise<IGenre> {
    const copy = _.cloneDeep(genre);
    copy._id = shortid.generate();
    return this.genres.insert(copy);
  }

  getGenreById(genreId: string): Promise<IGenre> {
    return this.genres.findOne({ _id: genreId });
  }

  getGenres(): Promise<IGenre[]> {
    return this.genres.find({});
  }

  updateGenre(genre: IGenre): Promise<IGenre> {
    return this.genres.findOneAndUpdate({ _id: genre._id }, genre);
  }

  deleteGenre(genreId: string): Promise<IGenre> {
    return this.genres.findOneAndDelete({ _id: genreId });
  }

}
