import * as monk from 'monk';
import * as shortid from 'shortid';
import _ = require('lodash');

export enum UserType {
  USER = 'USER',
  ADMIN = 'ADMIN'
}

export interface IUser {
  _id?: string;
  date_joined: string;
  type: UserType;
  first_name: string;
  last_name: string;
  email: string;
  password: string;
}

export type GenreInterestMap = { [genreId: string]: 1|2|3|4 };

export interface IStudent extends IUser {
  initial_lexile_measure: number;
  genre_interests: GenreInterestMap
}

export interface IUserData {
  createUser: (user: IUser) => Promise<IUser>;
  updateUser: (user: IUser) => Promise<IUser>;
  getUserById: (id: string) => Promise<IUser>;
  getUserByEmail: (email: string) => Promise<IUser>;
  getAllUsers: () => Promise<IUser[]>;
}

export class MongoUserData implements IUserData {

  private users: monk.ICollection; 

  constructor(mongoConnectionStr: string) {
    let db = monk.default(mongoConnectionStr);
    this.users = db.get('users', { castIds: false });
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

}