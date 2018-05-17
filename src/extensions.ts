import * as restify from 'restify';
import * as joi from 'joi';
import { UserType } from './models/user';

export interface IRequest<T> extends restify.Request {
  body: T;
  promise: Promise<any>;
  authToken?: {
    _id: string,
    type: UserType
  };
}

export const lexileMeasureSchema = joi.number().min(0).max(2000).required();

const shortidRegexPattern = /[A-Za-z0-9_-]{7,14}/;

export const shortidSchema = joi.string().regex(shortidRegexPattern).required();