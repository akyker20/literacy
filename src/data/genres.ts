import * as monk from 'monk';

export interface IGenre {
  _id?: string;
  title: string;
  description: string;
}

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
    return this.genres.insert(genre);
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
