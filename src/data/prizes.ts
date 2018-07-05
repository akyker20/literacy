import * as monk from 'monk';
import * as _ from 'lodash';
import * as shortid from 'shortid';
import { Models as M } from 'reading_rewards';

type IPrize = M.IPrize;

export interface IPrizeData {
  createPrize: (prize: IPrize) => Promise<IPrize>;
  getPrizes: () => Promise<IPrize[]>;
  getPrizesWithIds: (prizeIds: string[]) => Promise<IPrize[]>;
  getPrizeById: (prizeId: string) => Promise<IPrize>;
  updatePrize(prize: IPrize): Promise<IPrize>;
  deletePrize: (prizeId: string) => Promise<IPrize>;
}

export class MongoPrizeData implements IPrizeData {

  private prizes: monk.ICollection; 

  constructor(mongoConnectionStr: string) {
    let db = monk.default(mongoConnectionStr);
    this.prizes = db.get('prizes', { castIds: false });
  }

  createPrize(prize: IPrize): Promise<IPrize> {
    const copy = _.cloneDeep(prize);
    copy._id = shortid.generate();
    return this.prizes.insert(copy);
  }

  getPrizeById(prizeId: string): Promise<IPrize> {
    return this.prizes.findOne({ _id: prizeId });
  }

  getPrizesWithIds(ids: string[]): Promise<M.IPrize[]> {
    return this.prizes.find({ _id: { $in: ids }});
  }

  getPrizes(): Promise<IPrize[]> {
    return this.prizes.find({});
  }

  updatePrize(prize: IPrize): Promise<IPrize> {
    return this.prizes.findOneAndUpdate({ _id: prize._id }, prize);
  }

  deletePrize(prizeId: string): Promise<IPrize> {
    return this.prizes.findOneAndDelete({ _id: prizeId });
  }

}
