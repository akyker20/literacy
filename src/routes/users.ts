import { Response, Next } from 'restify';
import { IRequest, lexileMeasureSchema } from '../Extensions';
import * as Middle from '../middleware';
import * as joi from 'joi';
import { genFieldErr } from '../helpers';
import { IUserData, IUser, UserType, IStudent } from '../data/users';
import { BadRequestError, InternalServerError, ResourceNotFoundError, UnauthorizedError } from 'restify-errors';
import * as jwt from 'jsonwebtoken';
import * as Constants from '../constants';
import _ = require('lodash');

interface IUserLoginCredentials {
  email: string;
  password: string;
}

export const editGenreInterestSchema = joi.object({
  interest_value: joi.number().integer().valid([1, 2, 3, 4]).required().error(genFieldErr('interest_value'))
}).required();

export const createGenreInterestSchema = joi.object().valid([1, 2, 3, 4]).required().error(genFieldErr('create genre body'))

export const studentSchema = joi.object({
  first_name: joi.string().required().error(genFieldErr('first_name')),
  last_name: joi.string().required().error(genFieldErr('last_name')),
  email: joi.string().required().error(genFieldErr('email')),
  password: joi.string().required().error(genFieldErr('password')),
  date_joined: joi.string().isoDate().required().error(genFieldErr('date_joined')),
  initial_lexile_measure: lexileMeasureSchema.error(genFieldErr('initial_lexile_measure')),
}).required()

export const userAuthSchema = joi.object({
  email: joi.string().required().error(genFieldErr('email')),
  password: joi.string().required().error(genFieldErr('password')),
}).required();

interface IUpdateGenreInterestBody {
  interest_value: number;
}

export function UserService(userData: IUserData) {

  return {
    whoami: [
      Middle.authenticate,
      (req: IRequest<{ [genreId: string]: number }>, res: Response, next: Next) => {
        const { _id: userId } = req.authToken;
        userData.getUserById(userId)
          .then(user => {
            if (_.isNull(user)) {
              throw new UnauthorizedError('Valid token, but user no longer exists.');
            }
            res.send(user)
          })
          .catch(err => next(err))
      }
    ],
    createGenreInterests: [
      Middle.authenticate,
      Middle.authorizeAgents([UserType.ADMIN]),
      Middle.valBody(createGenreInterestSchema),
      (req: IRequest<{ [genreId: string]: number }>, res: Response, next: Next) => {
        userData.getUserById(req.authToken._id)
          .then(user => {
            const updatedUser = _.assign({}, user, {
              genre_interests: req.body
            })
            return userData.updateUser(updatedUser)
          })
          .then(update => res.send(update))
          .catch(err => next(err))
      }
    ],
    editGenreInterest: [
      Middle.authenticate,
      Middle.authorizeAgents([UserType.ADMIN]),
      Middle.valBody(editGenreInterestSchema),
      (req: IRequest<IUpdateGenreInterestBody>, res: Response, next: Next) => {
        
        const { userId, genreId } = req.params;
        
        userData.getUserById(userId)
          .then((user: IStudent) => {
            if (_.isNull(user)) {
              throw new ResourceNotFoundError(`No user with id ${userId}`);
            }
            if (_.isEmpty(user.genre_interests)) {
              throw new BadRequestError('User cannot edit genre interests, until they have been created.');
            }
            const updatedUser = _.assign({}, user, {
              genre_interests: _.assign({}, user.genre_interests, {
                [genreId]: req.body.interest_value
              })
            })
            return userData.updateUser(updatedUser)
          })
          .then(update => res.send(update))
          .catch(err => next(err))
      }
    ],
    createUser: [
      Middle.valBody(studentSchema),
      (req: IRequest<IUser>, res: Response, next: Next) => {
        const user = req.body;
        userData.getUserByEmail(user.email)
          .then(user => {
            if (user !== null) {
              throw(new BadRequestError(`User with email ${user.email} already exists.`))
            }
            return userData.createUser(user);
          })
          .then(createdUser => res.send(201, createdUser))
          .catch(err => next(err))
      }
    ],
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