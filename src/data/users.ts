import * as monk from 'monk';
import * as shortid from 'shortid';
import * as _ from 'lodash';
import { Models as M } from 'reading_rewards';

type IUser = M.IUser;

export interface IUserData {
  createUser: (user: IUser) => Promise<IUser>;
  getUserById: (id: string) => Promise<IUser>;
  getUsersWithIds: (ids: string[]) => Promise<IUser[]>;
  getUserByUsername: (username: string) => Promise<IUser>;
  getAllUsers: () => Promise<IUser[]>;
  updateUser: (user: IUser) => Promise<IUser>;
  deleteUser: (userId: string) => Promise<IUser>;

  getEducatorOfStudent: (studentId: string) => Promise<M.IEducator>;

  getClassTaughtByTeacher: (teacherId: string) => Promise<M.IClass>;
  getClassWithStudent: (studentId: string) => Promise<M.IClass>;

  getClassById: (classId: string) => Promise<M.IClass>;
  updateClass: (update: M.IClass) => Promise<M.IClass>;
}

export class MongoUserData implements IUserData {

  private users: monk.ICollection;
  private classes: monk.ICollection; 

  constructor(mongoConnectionStr: string) {
    let db = monk.default(mongoConnectionStr);
    this.users = db.get('users', { castIds: false });
    this.classes = db.get('classes', { castIds: false });
  }

  getClassById(classId: string) {
    return this.classes.findOne({ _id: classId });
  }

  updateClass(update: M.IClass): Promise<M.IClass> {
    return this.classes.findOneAndUpdate({ _id: update._id }, update)
  }

  getClassTaughtByTeacher(teacherId: string) {
    return this.classes.findOne({ 
      teacher_id: teacherId,
      date_ended: null
    });
  }

  getClassWithStudent(studentId: string) {
    return this.classes.findOne({
      student_ids: studentId,
      date_ended: null
    });
  }

  createUser(user: IUser): Promise<IUser> {
    const copy = _.cloneDeep(user);
    copy._id = shortid.generate();
    return this.users.insert(copy);
  }

  getUserById(userId: string): Promise<IUser> {
    return this.users.findOne({ _id: userId });
  }

  getUserByUsername(username: string): Promise<IUser> {
    return this.users.findOne({ username });
  }

  getUsersWithIds(ids: string[]): Promise<IUser[]> {
    return this.users.find({ _id: { $in: ids }});
  }

  getAllUsers(): Promise<IUser[]> {
    return this.users.find({});
  }

  updateUser(user: IUser): Promise<IUser> {
    return this.users.findOneAndUpdate({ _id: user._id }, user)
  }

  deleteUser(userId: string) {
    return this.users.findOneAndDelete({ _id: userId })
  }

  getEducatorOfStudent(studentId: string): Promise<M.IEducator> {
    return this.users.findOne({ type: M.UserType.Educator, student_ids: studentId })
  }

}