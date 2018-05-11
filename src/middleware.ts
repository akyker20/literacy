// external dependencies

import * as Err from 'restify-errors';
import { Response, Next } from 'restify';
import * as _ from 'lodash';
import * as joi from 'joi';
import * as jwt from 'jsonwebtoken';

// internal dependencies

import { IRequest } from './Extensions';
import { UserType } from './data/users';
import * as Constants from './constants';

/**
 * Authentication, not authorization! Use authorize middleware
 * for authorization.
 * 
 * 401 if no authentication token present in headers.
 * 401 if token is invalid.
 * Otherwise, append decoded token to request and call next.
 */
export function authenticate(req: IRequest<any>, res: Response, next: Next) {

  const token = <string>req.headers[Constants.AuthHeaderField];

  if (_.isEmpty(token)) {
    return next(new Err.UnauthorizedError('No authorization token provided in header.'));
  }

  jwt.verify(token, Constants.JWTSecret /* to be changed */, (err, decoded: any) => {

    if (err) {
      return next(new Err.UnauthorizedError('Authorization token provided is invalid.'));
    }

    req.authToken = decoded;
    return next();

  });

}

/**
 * Authorization, not authentication! Can only be run after
 * authenticate middleware. Otherwise, no authentication token
 * will be on the request object and this middleware will 500.
 * 
 * 500 if no authentication token present on request object.
 * 403 if token belongs to user with type not in permitted types.
 * Otherwise, append decoded token to request and call next.
 * 
 * @param permittedUserTypes list of types authorized to make request.
 */
export function authorize(permittedUserTypes: UserType[]) {

  return (req: IRequest<any>, res: Response, next: Next) => {

    const { authToken } = req;

    if (_.isEmpty(authToken)) {
      return next(new Err.InternalServerError('Auth token not present on req in authorization middleware'));
    }

    if (!_.includes(permittedUserTypes, authToken.type)) {
      return next(new Err.ForbiddenError(`Users of type ${authToken.type} are not allowed to make this request.`));
    }

    return next();

  };

}

/**
 * Validates JSON body is in correct schema. Schema is defined
 * as a JOI object. This should be used after authentication/authorization
 * middlewares and before the route handler. Used in routes that create
 * some object (POST /players, POST /plays, etc.)
 * 
 * 400 if body is not valid according to JOI schema.
 * If body is valid, call next middleware which will likely be primary route handler.
 * 
 * @param schema Joi schema to validate body against.
 */
export function valBody<T>(schema: joi.Schema) {
  return (req: IRequest<any>, res: Response, next: Next) => {

    if (_.isEmpty(req.body)) {
      return next(new Err.BadRequestError('No body was sent in request.'));
    }

    const { error } = joi.validate<T>(req.body, schema);

    if (error) {
      return next(new Err.BadRequestError(error.message));
    }

    return next();

  };
}