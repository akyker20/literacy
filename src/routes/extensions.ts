/**
 * Stuff that makes writing routes and validation simpler.
 */

import * as _ from 'lodash';
import { Next, Request, RequestHandler, Response } from 'restify';
import * as joi from 'joi';
import { Models, Constants as SC } from 'reading_rewards';
import { ResourceNotFoundError, BadRequestError } from 'restify-errors';

export interface IRequest<T> extends Request {
  body: T;
  promise: Promise<any>;
  authToken?: {
    _id: string,
    type: Models.UserType
  };
}

export type PromiseHandler = (req: Request) => Promise<any>;


/**
 * Similar to unwrapVal, but this function wraps an async function which
 * returns a promise that is attached to the req.promise field which can
 * later be processed (resolved/rejected) in handlePromise middleware.
 * @param handler
 */
export function unwrapData(handler: PromiseHandler): RequestHandler {
  return (req: IRequest<any>, res: Response, next: Next) => {
    req.promise = handler(req);
    next();
  };
}

/**
 * Clients should not receive a joi error.
 * They should receive something simpler:
 * i.e. 'Invalid/missing field user_name'
 * @param fieldName
 */
export function genFieldErr(fieldName: string): Error {
  return new BadRequestError(`Invalid/missing field ${fieldName}`);
}

export const lexileMeasureSchema = joi.number().min(SC.MinLexileMeasure).max(SC.MaxLexileMeasure).strict().required();

const shortidRegexPattern = /[A-Za-z0-9_-]{7,14}/;

export const shortidSchema = joi.string().regex(shortidRegexPattern).required();

export function validateUser(userId, candidate: Models.IUser | null, expectedType: Models.UserType = Models.UserType.Student) {
  if (_.isNull(candidate)) {
    throw new ResourceNotFoundError(`User ${userId} does not exist.`)
  }
  if (candidate.type !== expectedType) {
    throw new BadRequestError(`User ${userId} is not a ${expectedType.toLowerCase()}`);
  }
}