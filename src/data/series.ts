import * as monk from 'monk';
import { Models as M } from 'reading_rewards';

export interface ISeriesData {
  getAllSeries: () => Promise<M.ISeries[]>;
  getSeriesById: (id: string) => Promise<M.ISeries>;
}

export interface IBookQuery {
  genres?: string[];
  lexile_range?: M.ILexileRange;
}

export class MongoSeriesData implements ISeriesData {

  private series: monk.ICollection;

  constructor(mongoConnectionStr: string) {
    let db = monk.default(mongoConnectionStr);
    this.series = db.get('series', { castIds: false });
  }

  public getAllSeries() {
    return this.series.find({});
  }

  public getSeriesById(id: string) {
    return this.series.findOne({ _id: id })
  }

}
