import { Response, Next } from 'restify';
import { IRequest } from '../Extensions';
import * as Middle from '../middleware';
import * as joi from 'joi';
import { genFieldErr } from '../helpers';
import { IUserData } from '../data/users';
import { BadRequestError, InternalServerError } from 'restify-errors';
import * as jwt from 'jsonwebtoken';
import * as Constants from '../constants';

interface IUserLoginCredentials {
  email: string;
  password: string;
}

export const userAuthSchema = joi.object({
  email: joi.string().required().error(genFieldErr('email')),
  password: joi.string().required().error(genFieldErr('password')),
}).required();

export function UserService(userData: IUserData) {

  return {
    signin: [
      Middle.valBody(userAuthSchema),
      (req: IRequest<IUserLoginCredentials>, res: Response, next: Next) => {

        const { email, password } = req.body;

        userData.getUserByEmail(email)
          .then(user => {

            if (user === null) {
              return next(new BadRequestError(`No user with email ${email}`))
            }

            if (user.password !== password) {
              return next(new BadRequestError('Invalid email/password combination'));
            }
            
            // what will exist in the token.
            const claims = {
              _id: user._id,
              type: user.type
            };
      
            jwt.sign(claims, Constants.JWTSecret, {expiresIn: '1y'}, (err, token) => {
              if (err) {
                return next(new InternalServerError('Problem generating auth token'))
              }
              return res.send({
                auth_token: token,
                user
              })
            });

          })
          .catch(err => next(err))
      }
    ]
  }

}