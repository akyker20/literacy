import * as monk from 'monk';
import * as _ from 'lodash';
import { Models as M } from 'reading_rewards';

export interface IClassInitiativeData {
  getInitiativeForClass: (classId: string) => Promise<M.IInitiative>;
}

export class MongoClassInitiativeData implements IClassInitiativeData {

  private initiatives: monk.ICollection;
  private classInitiatives: monk.ICollection;

  constructor(mongoConnectionStr: string) {
    let db = monk.default(mongoConnectionStr);
    this.initiatives = db.get('initiatives', { castIds: false });
    this.classInitiatives = db.get('class_initiatives', { castIds: false });
  }

  public async getInitiativeForClass(classId: string) {
    const activeClassInitiative: M.IClassInitiative = await this.classInitiatives.findOne({ 
      classId: classId,
      date_ended: null 
    });
    if (_.isNull(activeClassInitiative)) {
      return null;
    }
    return this.initiatives.findOne({ _id: activeClassInitiative.initiative_id });
  }

}
