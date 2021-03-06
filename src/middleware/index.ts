// external dependencies

import * as Err from 'restify-errors';
import { Response, Next } from 'restify';
import * as _ from 'lodash';
import * as joi from 'joi';
import * as jwt from 'jsonwebtoken';
import { Models as M, Constants as SC } from 'reading_rewards';

// internal dependencies

import { IRequest } from '../routes/extensions';
import * as Constants from '../constants';

/**
 * Authentication, not authorization! Use authorize middleware
 * for authorization.
 * 
 * 401 if no authentication token present in headers.
 * 401 if token is invalid.
 * Otherwise, append decoded token to request and call next.
 */
export function authenticate(req: IRequest<any>, res: Response, next: Next) {

  const token = <string>req.headers[SC.AuthHeaderField];

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
export function authorize(permittedUserTypes: M.UserType[]) {

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
 * This middleware prohibits certain users from making requests on 
 * behalf of other users.
 * 
 * For users who do not have a role in permittedAgentRoles that are making
 * the request (their id is in the request auth token), they must be updating
 * their own resources (userId in /users/:userId/... is their id).
 * 
 * This only applies to requests with userId in request url params.
 * 
 * @param permittedAgentRoles list of roles that can always make the request on
 * behalf of other users.
 */
export function authorizeAgents(permittedAgentRoles: M.UserType[]) {

  return (req: IRequest<any>, res: Response, next: Next) => {

    const { authToken } = req;

    if (_.isEmpty(authToken) || _.isEmpty(req.params.userId)) {
      return next();
    }

    if (_.includes(permittedAgentRoles, authToken.type)) {
      return next();
    }

    const agentUserId = authToken._id;

    if (agentUserId !== req.params.userId) {
      const errMsg = `User ${agentUserId} cannot act as an agent for user ${req.params.userId}`;
      return next(new Err.ForbiddenError(errMsg));
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

/**
 * Validates schema of request query parameters
 * Sends 400 if any parameters are invalid.
 * 
 * @param params 
 */
export function valQueryParams(... params: { name: string, schema: joi.Schema }[]) {
  return (req: IRequest<any>, res: Response, next: Next) => {

    // https://basarat.gitbooks.io/typescript/content/docs/for...of.html
    for (const { name, schema } of params) {
      const { error } = joi.validate(req.query[name], schema);
      if (error) {
        req.log.info(error.message, 'Request Url Query Param Error');
        return next(new Err.BadRequestError(`Query param error for ${name}`));
      }
    }

    return next();

  };
}

export function valIdsSame({ paramKey, bodyKey }: { paramKey: string, bodyKey: string }) {
  return (req: IRequest<any>, res: Response, next: Next) => {

    if (_.isEmpty(req.body)) {
      return next(new Err.BadRequestError('No body was sent in request.'));
    }

    if (_.isEmpty(req.body[bodyKey])) {
      return next(new Err.BadRequestError(`No key ${bodyKey} present in request body.`));
    }

    if (req.params[paramKey] !== req.body[bodyKey]) {
      return next(new Err.BadRequestError(`${paramKey} in url is different than ${bodyKey} in body.`));
    }

    return next();

  };
}

/**
 * Middleware that looks for a promise attached to request object.
 * If the promise resolves, the value is sent to the client.
 * If the promise rejects, call the error middleware.
 */
export function handlePromise(req: IRequest<any>, res: Response, next: Next): void {

  if (_.isUndefined(req.promise)) {
    return next(new Err.InternalServerError('No req.promise in handlePromise middleware.'));
  }

  req.promise
    .then(result => {
      res.send(result);
      return next();
    })
    .catch(err => next(err));

}