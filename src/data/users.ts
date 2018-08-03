import * as monk from 'monk';
import * as shortid from 'shortid';
import * as _ from 'lodash';
import { Models as M } from 'reading_rewards';

type IUser = M.IUser;

export interface IUserData {
  createUser: (user: IUser) => Promise<IUser>;
  updateUser: (user: IUser) => Promise<IUser>;
  getUserById: (id: string) => Promise<IUser>;
  getUsersWithIds: (ids: string[]) => Promise<IUser[]>;
  getUserByEmail: (email: string) => Promise<IUser>;
  getAllUsers: () => Promise<IUser[]>;
  deleteUser: (userId: string) => Promise<IUser>;
  getEducatorOfStudent: (studentId: string) => Promise<M.IEducator>;
}

export class MongoUserData implements IUserData {

  private users: monk.ICollection; 

  constructor(mongoConnectionStr: string) {
    let db = monk.default(mongoConnectionStr);
    this.users = db.get('users', { castIds: false });
  }

  getEducatorOfStudent(studentId: string): Promise<M.IEducator> {
    return this.users.findOne({ type: M.UserType.EDUCATOR, student_ids: studentId })
  }

  getUsersWithIds(ids: string[]): Promise<IUser[]> {
    return this.users.find({ _id: { $in: ids }});
  }

  getUserById(userId: string): Promise<IUser> {
    return this.users.findOne({ _id: userId });
  }

  getUserByEmail(email: string): Promise<IUser> {
    return this.users.findOne({ email });
  }

  createUser(user: IUser): Promise<IUser> {
    const copy = _.cloneDeep(user);
    copy._id = shortid.generate();
    return this.users.insert(copy);
  }

  updateUser(user: IUser): Promise<IUser> {
    return this.users.findOneAndUpdate({ _id: user._id }, user)
  }

  getAllUsers(): Promise<IUser[]> {
    return this.users.find({});
  }

  deleteUser(userId: string) {
    return this.users.findOneAndDelete({ _id: userId })
  }

}