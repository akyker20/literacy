import * as monk from 'monk';
import * as _ from 'lodash';
import * as shortid from 'shortid';
import { Models as M, Models } from 'reading_rewards';

export interface IBookRequestData {
  createBookRequest: (request: Models.IBookRequest) => Promise<M.IBookRequest>;
  getRequestById: (id: string) => Promise<M.IBookRequest>;
  getBookRequestsByStudent: (studentId: string) => Promise<M.IBookRequest[]>;
  getAllBookRequests: () => Promise<M.IBookRequest[]>;
  updateRequest: (req: M.IBookRequest) => Promise<M.IBookRequest>;
  deleteRequest: (id: string) => Promise<M.IBookRequest>;
}

export class MongoBookRequestData implements IBookRequestData {

  private bookRequests: monk.ICollection;

  constructor(mongoConnectionStr: string) {
    let db = monk.default(mongoConnectionStr);
    this.bookRequests = db.get('book_requests', { castIds: false });
  }

  public createBookRequest(request: Models.IBookRequest) {
    const copy = _.cloneDeep(request);
    copy._id = shortid.generate();
    return this.bookRequests.insert(copy);
  }

  public updateRequest(req: M.IBookRequest) {
    return this.bookRequests.findOneAndUpdate({ _id: req._id }, req);
  }

  public getRequestById(id: string) {
    return this.bookRequests.findOne({ _id: id })
  }

  public getBookRequestsByStudent(studentId: string) {
    return this.bookRequests.find({ student_id: studentId });
  }

  public getAllBookRequests() {
    return this.bookRequests.find({})
  }

  public deleteRequest(id: string) {
    return this.bookRequests.findOneAndDelete({ _id: id })
  }

}
