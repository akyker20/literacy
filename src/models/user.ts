export enum UserType {
  STUDENT = 'STUDENT',
  EDUCATOR = 'EDUCATOR',
  ADMIN = 'ADMIN'
}

export interface IUserCore {
  _id?: string;
  first_name: string;
  last_name: string;
  email: string;
}

// The interfaces for request body for creating users.

export interface IUserBody extends IUserCore {
  password: string;
}

export interface IStudentBody extends IUserBody {
  initial_lexile_measure: number;
}

export interface IEducatorBody extends IUserBody {
  student_ids: string[];
}

// interface for created users.

export interface IUser extends IUserCore {
  date_created: string;
  type: UserType;
  hashed_password: string;
}

export type GenreInterestMap = { [genreId: string]: 1|2|3|4 };

export interface IStudent extends IUser {
  initial_lexile_measure: number;
  genre_interests: GenreInterestMap;
}

export interface IEducator extends IUser {
  student_ids: string[];
}