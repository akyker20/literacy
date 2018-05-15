import { IRequest, lexileMeasureSchema } from '../Extensions';
import * as Middle from '../middleware';
import * as joi from 'joi';
import { genFieldErr, unwrapData } from '../helpers';
import { IUserData, IUser, UserType, IStudent } from '../data/users';
import { BadRequestError, ResourceNotFoundError, UnauthorizedError } from 'restify-errors';
import * as jwt from 'jsonwebtoken';
import * as Constants from '../constants';
import _ = require('lodash');
import { IQuizData } from '../data/quizzes';
import { IBookData } from '../data/books';

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

export function UserService(
  userData: IUserData,
  quizData: IQuizData,
  bookData: IBookData
) {

  return {
    whoami: [
      Middle.authenticate,
      unwrapData(async (req: IRequest<{ [genreId: string]: number }>) => {

        const { _id: userId } = req.authToken;
        console.log(userId);
        const user = await userData.getUserById(userId);

        if (_.isNull(user)) {
          throw new UnauthorizedError('Valid token, but user no longer exists.');
        }

        if (user.type === UserType.USER) {

          const quizSubmissions = await quizData.getSubmissionsForUser(user._id);
          const idsOfBooksRead = quizSubmissions.map(s => s.book_id);
          const booksRead = await Promise.all(idsOfBooksRead.map(bookData.getBook));
          return _.assign({}, user, { booksRead })

        }

        return user;

      }),
      Middle.handlePromise
    ],
    createGenreInterests: [
      Middle.authenticate,
      Middle.authorizeAgents([UserType.ADMIN]),
      Middle.valBody(createGenreInterestSchema),
      unwrapData(async (req: IRequest<{ [genreId: string]: number }>) => {

        const user = await userData.getUserById(req.authToken._id);

        const updatedUser = _.assign({}, user, {
          genre_interests: req.body
        })

        return await userData.updateUser(updatedUser);

      }),
      Middle.handlePromise
    ],
    editGenreInterest: [
      Middle.authenticate,
      Middle.authorizeAgents([UserType.ADMIN]),
      Middle.valBody(editGenreInterestSchema),
      unwrapData(async (req: IRequest<IUpdateGenreInterestBody>) => {

        const { userId, genreId } = req.params;
        const user = await userData.getUserById(userId) as IStudent;

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

        return await userData.updateUser(updatedUser)

      }),
      Middle.handlePromise
    ],

    createUser: [
      Middle.valBody(studentSchema),
      unwrapData(async (req: IRequest<IUser>) => {

        const newUser = req.body;

        const existingUserWithEmail = await userData.getUserByEmail(newUser.email);

        if (existingUserWithEmail !== null) {
          throw new BadRequestError(`User with email ${newUser.email} already exists.`);
        }

        return await userData.createUser(newUser);

      }),
      Middle.handlePromise
    ],

    signin: [
      Middle.valBody(userAuthSchema),
      unwrapData(async (req: IRequest<IUserLoginCredentials>) => {

        const { email, password } = req.body;

        const user = await userData.getUserByEmail(email);

        if (user === null) {
          throw new BadRequestError(`No user with email ${email}`);
        }

        if (user.password !== password) {
          throw new BadRequestError('Invalid email/password combination');
        }

        const claims = {
          _id: user._id,
          type: user.type
        };

        const token = jwt.sign(claims, Constants.JWTSecret, { expiresIn: '1y' });

        return {
          auth_token: token,
          user
        }

      }),
      Middle.handlePromise
    ]
  }

}