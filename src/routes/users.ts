import { IRequest, lexileMeasureSchema } from '../Extensions';
import * as Middle from '../middleware';
import * as joi from 'joi';
import { genFieldErr, unwrapData, computeCurrentLexileMeasure } from '../helpers';
import { IUserData, IUser, UserType, IStudent } from '../data/users';
import { BadRequestError, ResourceNotFoundError, UnauthorizedError, ForbiddenError } from 'restify-errors';
import * as jwt from 'jsonwebtoken';
import * as Constants from '../constants';
import _ = require('lodash');
import { IQuizData } from '../data/quizzes';
import { IBookData } from '../data/books';
import { IGenreData } from '../data/genres';
import { Next, Response } from 'restify';

interface IUserLoginCredentials {
  email: string;
  password: string;
}

export const editGenreInterestSchema = joi.object({
  interest_value: joi.number().integer().valid([1, 2, 3, 4]).required().error(genFieldErr('interest_value'))
}).required();

export const createGenreInterestSchema = joi.object().pattern(/.*/, joi.number().integer().valid([1, 2, 3, 4])).required().error(genFieldErr('create genre body'))

export const studentSchema = joi.object({
  first_name: joi.string().required().error(genFieldErr('first_name')),
  last_name: joi.string().required().error(genFieldErr('last_name')),
  email: joi.string().required().error(genFieldErr('email')),
  password: joi.string().required().error(genFieldErr('password')),
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
  bookData: IBookData,
  genreData: IGenreData
) {

  async function getStudentDTO(user: IUser) {
    const student = user as IStudent;

    const quizSubmissions = await quizData.getSubmissionsForStudent(student._id);
    const idsOfBooksRead = quizSubmissions.map(s => s.book_id);
    const booksRead = await Promise.all(idsOfBooksRead.map(bookId => bookData.getBook(bookId)));
    
    const currentLexileMeasure = computeCurrentLexileMeasure(
      student.initial_lexile_measure,
      quizSubmissions
    )
    
    return _.assign({}, user, { 
      current_lexile_measure: currentLexileMeasure,
      books_read: booksRead
    })
  }

  return {
    whoami: [
      Middle.authenticate,
      unwrapData(async (req: IRequest<{ [genreId: string]: number }>) => {

        const { _id: userId } = req.authToken;

        const user = await userData.getUserById(userId);

        if (_.isNull(user)) {
          throw new UnauthorizedError('Valid token, but user no longer exists.');
        }

        if (user.type === UserType.USER) {
          return getStudentDTO(user);
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

        const user = await userData.getUserById(req.params.userId);

        if (_.isNull(user)) {
          throw new ResourceNotFoundError(`User ${req.params.userId} does not exist.`)
        }

        if (user.type !== UserType.USER) {
          throw new ForbiddenError('Can only post genre interests for student users');
        }

        if (!_.isEmpty((user as IStudent).genre_interests)) {
          throw new BadRequestError('User already has created genre interests');
        }

        const existingGenres = await genreData.getGenres();
        const existingGenreIds = _.map(existingGenres, '_id');

        const inputGenreKeys = _.keys(req.body);

        if (existingGenres.length !== inputGenreKeys.length) {
          throw new BadRequestError(`There is a discrepancy between existing genres and genres user provided interest levels for.`);
        }

        const invalidGenres = _.difference(inputGenreKeys, existingGenreIds);

        if (!_.isEmpty(invalidGenres)) {
          throw new BadRequestError(`Genres ${invalidGenres.join(', ')} are invalid.`)
        }

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

        const existingUserWithEmail = await userData.getUserByEmail(req.body.email);

        if (existingUserWithEmail !== null) {
          throw new BadRequestError(`User with email ${req.body.email} already exists.`);
        }

        const newUser: IUser = _.assign({}, req.body, {
          date_joined: new Date().toISOString(),
          type: UserType.USER
        });

        return await userData.createUser(newUser);

      }),
      Middle.handlePromise
    ],

    getAllUsers: [
      Middle.authenticate,
      Middle.authorize([UserType.ADMIN]),
      (req: IRequest<null>, res: Response, next: Next) => {
        req.promise = userData.getAllUsers();
        next();
      },
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

        const userDTO = await getStudentDTO(user);

        const claims = {
          _id: user._id,
          type: user.type
        };

        const token = jwt.sign(claims, Constants.JWTSecret, { expiresIn: '1y' });

        return {
          auth_token: token,
          user: userDTO
        }

      }),
      Middle.handlePromise
    ]
  }

}