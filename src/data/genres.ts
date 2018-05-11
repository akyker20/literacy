import * as monk from 'monk';

export interface IGenre {
  _id?: string;
  title: string;
}

export interface IGenreData {
  createGenre: (genre: IGenre) => Promise<IGenre>;
  getGenres: () => Promise<IGenre[]>;
  deleteGenre: (genreId: string) => Promise<IGenre>;
}

export class MongoGenreData implements IGenreData {

  private genres: monk.ICollection; 

  constructor(mongoConnectionStr: string) {
    let db = monk.default(mongoConnectionStr);
    this.genres = db.get('genres');
  }

  createGenre(genre: IGenre): Promise<IGenre> {
    return this.genres.insert(genre);
  }

  getGenres(): Promise<IGenre[]> {
    return this.genres.find({}, { castIds: false });
  }

  deleteGenre(genreId: string): Promise<IGenre> {
    return this.genres.findOneAndDelete({ _id: genreId });
  }

}
