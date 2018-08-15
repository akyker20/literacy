import * as monk from 'monk';
import { Models as M } from 'reading_rewards';

export interface ISeriesData {
  getSeriesById: (id: string) => Promise<M.ISeries>;
  getAllSeries: () => Promise<M.ISeries[]>;
}

export class MongoSeriesData implements ISeriesData {

  private series: monk.ICollection;

  constructor(mongoConnectionStr: string) {
    let db = monk.default(mongoConnectionStr);
    this.series = db.get('series', { castIds: false });
  }

  public getSeriesById(id: string) {
    return this.series.findOne({ _id: id })
  }

  public getAllSeries() {
    return this.series.find({});
  }

}
