import * as monk from 'monk';

export enum UserType {
  USER = 'USER',
  ADMIN = 'ADMIN'
}

export interface IUser {
  _id?: string;
  type: UserType;
  first_name: string;
  last_name: string;
  email: string;
  password: string;
}

export interface IUserData {
  createUser: (user: IUser) => Promise<IUser>;
  getUserById: (id: string) => Promise<IUser>;
  getUserByEmail: (email: string) => Promise<IUser>;
}

export class MongoUserData implements IUserData {

  private users: monk.ICollection; 

  constructor(mongoConnectionStr: string) {
    let db = monk.default(mongoConnectionStr);
    this.users = db.get('users');
  }

  getUserById(userId: string): Promise<IUser> {
    return this.users.findOne({ _id: userId }, { castIds: false });
  }

  getUserByEmail(email: string): Promise<IUser> {
    return this.users.findOne({ email }, { castIds: false });
  }

  createUser(user: IUser): Promise<IUser> {
    return this.users.insert(user);
  }

}