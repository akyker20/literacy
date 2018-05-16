import { IRequest, lexileMeasureSchema } from '../Extensions';
import * as Middle from '../middleware';
import * as joi from 'joi';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import * as _ from 'lodash';
import { Next, Response } from 'restify';
import { 
  BadRequestError,
  ResourceNotFoundError, 
  UnauthorizedError, 
  ForbiddenError 
} from 'restify-errors';

import * as Constants from '../constants';
import { genFieldErr, unwrapData, computeCurrentLexileMeasure } from '../helpers';
import { IUserData, IUser, UserType, IStudent, IEducator, IStudentBody, IEducatorBody } from '../data/users';
import { IQuizData } from '../data/quizzes';
import { IBookData } from '../data/books';
import { IGenreData } from '../data/genres';
import { shortidSchema } from '../extensions';
import { IBookReviewData } from '../data/book_reviews';

interface IUserLoginCredentials {
  email: string;
  password: string;
}

const updateStudentsForTeacherSchema = joi.object({
  student_ids: joi.array().items(shortidSchema).max(100).unique().required().error(genFieldErr('students'))
}).required();

export const editGenreInterestSchema = joi.object({
  interest_value: joi.number().integer().valid([1, 2, 3, 4]).required().error(genFieldErr('interest_value'))
}).required();

export const createGenreInterestSchema = joi.object().pattern(/.*/, joi.number().integer().valid([1, 2, 3, 4])).required().error(genFieldErr('create genre body'))

export const userSchema = joi.object({
  first_name: joi.string().required().error(genFieldErr('first_name')),
  last_name: joi.string().required().error(genFieldErr('last_name')),
  email: joi.string().required().error(genFieldErr('email')),
  password: joi.string().required().error(genFieldErr('password')),
}).required();

export const studentSchema = userSchema.keys({
  initial_lexile_measure: lexileMeasureSchema.error(genFieldErr('initial_lexile_measure')),
}).required();

export const userAuthSchema = joi.object({
  email: joi.string().required().error(genFieldErr('email')),
  password: joi.string().required().error(genFieldErr('password')),
}).required();

interface IUpdateGenreInterestBody {
  interest_value: number;
}

export function UserRoutes(
  userData: IUserData,
  quizData: IQuizData,
  bookData: IBookData,
  bookReviewData: IBookReviewData,
  genreData: IGenreData
) {

  async function userExistsWithEmail(email: string): Promise<boolean> {
    const existingUserWithEmail = await userData.getUserByEmail(email);
    return !_.isNull(existingUserWithEmail);
  }

  async function getStudentDTO(user: IUser) {
    const student = user as IStudent;

    const studentBookReviews = await bookReviewData.getBookReviewsForStudent(student._id);
    const studentQuizSubmissions = await quizData.getSubmissionsForStudent(student._id);

    const idsOfBooksRead = _.chain(studentQuizSubmissions)
      .filter(s => s.passed)
      .map('book_id')
      .value();

    const booksRead = await bookData.getBooksWithIds(idsOfBooksRead);
    
    const currentLexileMeasure = computeCurrentLexileMeasure(
      student.initial_lexile_measure,
      studentBookReviews
    )
    
    return _.assign({}, user, { 
      current_lexile_measure: currentLexileMeasure,
      books_read: booksRead, // based on passed submissions, not book reviews
      quiz_submissions: studentQuizSubmissions,
      book_reviews: studentBookReviews
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

        if (user.type === UserType.STUDENT) {
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

        if (user.type !== UserType.STUDENT) {
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

    createStudent: [
      Middle.authenticate,
      Middle.authorize([UserType.ADMIN]),
      Middle.valBody(studentSchema),
      unwrapData(async (req: IRequest<IStudentBody>) => {

        if (await userExistsWithEmail(req.body.email)) {
          throw new BadRequestError(`User with email ${req.body.email} already exists.`);
        }

        const hashedPassword = await bcrypt.hash(req.body.password, 8);
        delete req.body.password;

        const newStudent: IStudent = _.assign({}, req.body, {
          hashed_password: hashedPassword,
          date_joined: new Date().toISOString(),
          type: UserType.STUDENT,
          genre_interests: null,
          books_read: []
        });

        return await userData.createUser(newStudent);

      }),
      Middle.handlePromise
    ],

    updateBooksReadForStudent: [
      Middle.authenticate,

    ],

    createEducator: [
      Middle.authenticate,
      Middle.authorize([UserType.ADMIN]),
      Middle.valBody(userSchema),
      unwrapData(async (req: IRequest<IEducatorBody>) => {

        if (await userExistsWithEmail(req.body.email)) {
          throw new BadRequestError(`User with email ${req.body.email} already exists.`);
        }

        const hashedPassword = await bcrypt.hash(req.body.password, 8);
        delete req.body.password;

        const educator: IEducator = _.assign({}, req.body, {
          hashed_password: hashedPassword,
          date_joined: new Date().toISOString(),
          type: UserType.EDUCATOR,
          student_ids: []
        });

        return await userData.createUser(educator);

      }),
      Middle.handlePromise
    ],

    updateStudentsForEducator: [
      Middle.authenticate,
      Middle.authorize([UserType.EDUCATOR, UserType.ADMIN]),
      Middle.authorizeAgents([UserType.ADMIN]),
      Middle.valBody(updateStudentsForTeacherSchema),
      unwrapData(async (req: IRequest<{ student_ids: string[] }>) => {

        const { userId: educatorId } = req.params;
        const { student_ids } = req.body;

        // grab educator and verify.

        const educator = await userData.getUserById(educatorId) as IEducator;

        if (_.isNull(educator)) {
          throw new ResourceNotFoundError(`Educator ${educatorId} does not exist.`)
        }

        if (educator.type !== UserType.EDUCATOR) {
          throw new ForbiddenError(`User ${educatorId} is not an educator`)
        }

        // grab all users with _id in student_ids

        const dbUsers = await userData.getUsersWithIds(student_ids);
        const dbUserIds = _.map(dbUsers, '_id');

        // check there is a user for each student_id provided.

        const invalidIds = _.difference(student_ids, dbUserIds);
        if (!_.isEmpty(invalidIds)) {
          throw new BadRequestError(`User ids ${invalidIds.join(', ')} are invalid.`);
        }

        // check all the corresponding users are actually students.

        const nonStudentIds = _.chain(dbUsers)
          .filter(u => u.type !== UserType.STUDENT)
          .map('_id')
          .value();

        if (!_.isEmpty(nonStudentIds)) {
          throw new BadRequestError(`Users ${nonStudentIds} are not students.`)
        }


        // build updated educator object

        const updatedEducator: IEducator = _.assign({}, educator, {
          student_ids
        });

        return userData.updateUser(updatedEducator);

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

        const isPasswordCorrect = await bcrypt.compare(password, user.hashed_password);

        if (!isPasswordCorrect) {
          throw new BadRequestError('Invalid email/password combination.');
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