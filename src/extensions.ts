import * as restify from 'restify';
import * as joi from 'joi';
import { Models, Constants as SC } from 'reading_rewards';

export interface IRequest<T> extends restify.Request {
  body: T;
  promise: Promise<any>;
  authToken?: {
    _id: string,
    type: Models.UserType
  };
}

export const lexileMeasureSchema = joi.number().min(SC.MinLexileMeasure).max(SC.MaxLexileMeasure).strict().required();

const shortidRegexPattern = /[A-Za-z0-9_-]{7,14}/;

export const shortidSchema = joi.string().regex(shortidRegexPattern).required();