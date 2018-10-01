import * as monk from 'monk';
import * as _ from 'lodash';
import * as shortid from 'shortid';
import { Models as M } from 'reading_rewards';

type IPrizeOrder = M.IPrizeOrder;

export interface IPrizeOrderData {
  getOrdersForPrize: (prizeId: string) => Promise<IPrizeOrder[]>;
  getPrizeOrderById: (orderId: string) => Promise<IPrizeOrder>;
  createPrizeOrder: (prizeOrder: IPrizeOrder) => Promise<IPrizeOrder>;
  getPrizeOrdersForStudent: (studentId: string) => Promise<IPrizeOrder[]>;
  updatePrizeOrder(prizeOrder: IPrizeOrder): Promise<IPrizeOrder>;
}

export class MongoPrizeOrderData implements IPrizeOrderData {

  private prizeOrders: monk.ICollection; 

  constructor(mongoConnectionStr: string) {
    let db = monk.default(mongoConnectionStr);
    this.prizeOrders = db.get('prize_orders', { castIds: false });
  }

  getOrdersForPrize(prizeId: string): Promise<IPrizeOrder[]> {
    return this.prizeOrders.find({ prize_id: prizeId }) 
  }

  getPrizeOrderById(orderId: string): Promise<IPrizeOrder> {
    return this.prizeOrders.findOne({ _id: orderId })
  }

  createPrizeOrder(prizeOrder: IPrizeOrder): Promise<IPrizeOrder> {
    const copy = _.cloneDeep(prizeOrder);
    copy._id = shortid.generate();
    return this.prizeOrders.insert(copy);
  }

  getPrizeOrdersForStudent(studentId: string): Promise<IPrizeOrder[]> {
    return this.prizeOrders.find({ student_id: studentId });
  }

  updatePrizeOrder(prizeOrder: IPrizeOrder): Promise<IPrizeOrder> {
    return this.prizeOrders.findOneAndUpdate({ _id: prizeOrder._id }, prizeOrder);
  }

}
