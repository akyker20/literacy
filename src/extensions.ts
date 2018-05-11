import * as restify from 'restify';
import { UserType } from './data/users';

export interface IRequest<T> extends restify.Request {
  body: T;
  promise: Promise<any>;
  authToken?: {
    _id: string,
    type: UserType
  };
}