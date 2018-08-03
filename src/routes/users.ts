import { IRequest, lexileMeasureSchema } from '../extensions';
import * as Middle from '../middleware';
import * as joi from 'joi';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import * as _ from 'lodash';
import { Next, Response } from 'restify';
import { Models as M, Constants as C, Helpers } from 'reading_rewards';
import {
  BadRequestError,
  ResourceNotFoundError,
  UnauthorizedError,
  ForbiddenError
} from 'restify-errors';

import * as Constants from '../constants';
import { genFieldErr, unwrapData, computeCurrentLexileMeasure } from '../helpers';
import { IUserData } from '../data/users';
import { IQuizData } from '../data/quizzes';
import { IBookData } from '../data/books';
import { IGenreData } from '../data/genres';
import { shortidSchema } from '../extensions';
import { IBookReviewData } from '../data/book_reviews';
import { IPrizeOrderData } from '../data/prize_orders';
import { IPrizeData } from '../data/prizes';
import { INotificationSys } from '../notifications';
import { IReadingLogData } from '../data/reading_log';

interface IUserLoginCredentials {
  email: string;
  password: string;
}

const bookmarkBookSchema = joi.object({
  bookId: shortidSchema.error(genFieldErr('bookId'))
}).required()

const updateStudentsForTeacherSchema = joi.object({
  student_ids: joi.array().items(shortidSchema).max(100).unique().required().error(genFieldErr('students'))
}).required();

export const editGenreInterestSchema = joi.object({
  interest_value: joi.number().integer().valid([1, 2, 3, 4]).required().error(genFieldErr('interest_value'))
}).required();

export const createGenreInterestSchema = joi.object().pattern(/.*/, joi.number().integer().valid([1, 2, 3, 4])).required().error(genFieldErr('create genre body'))

const parentEmailsSchema = joi.array().items(joi.string().email()).max(C.MaxParentEmailsPerStudent).unique().required().error(genFieldErr('parent_emails'));

const notificationSettingsSchema = joi.object({
  reading_logs: joi.bool().required(),
  quiz_submissions: joi.bool().required(),
  prizes_ordered: joi.bool().required()
}).required()

export const userSchema = joi.object({
  first_name: joi.string().required().error(genFieldErr('first_name')),
  last_name: joi.string().required().error(genFieldErr('last_name')),
  email: joi.string().email().required().error(genFieldErr('email')),
  password: joi.string().required().error(genFieldErr('password')),
}).required();

const activateUserSchema = joi.object({
  password: joi.string().required()
}).required()

export const studentSchema = userSchema.keys({
  gender: joi.string().valid(_.values(M.Gender)).required().error(genFieldErr('gender')),
  parent_emails: parentEmailsSchema,
  initial_lexile_measure: lexileMeasureSchema.error(genFieldErr('initial_lexile_measure')),
}).required();

export const pendingStudentSchema = joi.object({
  first_name: joi.string().required(),
  last_name: joi.string().required(),
  email: joi.string().email().required(),
  initial_lexile_measure: lexileMeasureSchema,
  gender: joi.string().valid(_.values(M.Gender)).required(),
  parent_emails: parentEmailsSchema
}).required();

export const userAuthSchema = joi.object({
  email: joi.string().email().required().error(genFieldErr('email')),
  password: joi.string().required().error(genFieldErr('password')),
}).required();

export const updateParentEmailsSchema = joi.object({
  parent_emails: parentEmailsSchema
})

interface IUpdateGenreInterestBody {
  interest_value: number;
}

export function UserRoutes(
  userData: IUserData,
  quizData: IQuizData,
  bookData: IBookData,
  bookReviewData: IBookReviewData,
  genreData: IGenreData,
  prizeOrderData: IPrizeOrderData,
  prizeData: IPrizeData,
  readingLogData: IReadingLogData,
  notifications: INotificationSys
) {

  function getAuthToken(user: M.IUser) {
    const claims = {
      _id: user._id,
      type: user.type
    };
    const token = jwt.sign(claims, Constants.JWTSecret, { expiresIn: '1y' });
    return token;
  }

  async function userExistsWithEmail(email: string): Promise<boolean> {
    const existingUserWithEmail = await userData.getUserByEmail(email);
    return !_.isNull(existingUserWithEmail);
  }

  async function getEducatorDTO(user: M.IUser): Promise<M.IEducatorDTO> {
    const educator = user as M.IEducator;

    // compute studentProgress object

    const allStudentReadingLogs = await readingLogData.getLogsForStudents(educator.student_ids);
    const allStudentSubmissions = await quizData.getSubmissionsForStudents(educator.student_ids);

    const students = await userData.getUsersWithIds(educator.student_ids) as M.IStudent[];

    const studentProgress: M.IStudentProgress[] = [];
    _.forEach(students, student => {
      if (student.status === M.StudentStatus.Active) {
        const studentReadingLogs = _.filter(allStudentReadingLogs, { student_id: student._id });
        const passedStudentQuizzes = _.filter(allStudentSubmissions, { student_id: student._id, passed: true });
        studentProgress.push({
          student_name: Helpers.getFullName(student),
          student_id: student._id,
          num_quizzes_passed: passedStudentQuizzes.length,
          num_reading_sessions: studentReadingLogs.length,
          total_min_reading: _.sumBy(studentReadingLogs, 'duration_min')
        })
      }
    })

    return {
      students,
      educator,
      student_progress: studentProgress
    }
  }

  async function getStudentDTO(user: M.IUser): Promise<M.IStudentDTO> {
    const student = user as M.IStudent;

    // get book reviews by student

    const studentBookReviews = await bookReviewData.getBookReviewsForStudent(student._id);

    // current lexile measure

    const currentLexileMeasure = computeCurrentLexileMeasure(
      student.initial_lexile_measure,
      studentBookReviews
    )

    // get quiz submissions by student

    const studentQuizSubmissions = await quizData.getSubmissionsForStudent(student._id);

    // get books passed quiz for

    const idsOfPassedQuizBooks = Helpers.getIdsOfPassedQuizBooks(studentQuizSubmissions);
    const passedQuizBooks = await bookData.getBooksWithIds(idsOfPassedQuizBooks);

    // get bookmarked books

    const idsOfBookmarkedBooks = _.map(student.bookmarked_books, 'bookId');

    const booksBookmarked = await bookData.getBooksWithIds(idsOfBookmarkedBooks);

    // get prizes ordered

    const studentPrizeOrders = await prizeOrderData.getPrizeOrdersForStudent(student._id);
    const idsOfPrizesOrdered = _.chain(studentPrizeOrders)
      .map('prize_id')
      .uniq()
      .value()

    const prizesOrdered = await prizeData.getPrizesWithIds(idsOfPrizesOrdered);

    const readingLog = await readingLogData.getLogsForStudent(user._id);

    return {
      info: student,
      current_lexile_measure: currentLexileMeasure,
      passed_quiz_books: passedQuizBooks,
      quiz_submissions: studentQuizSubmissions,
      book_reviews: studentBookReviews,
      bookmarked_books: booksBookmarked,
      prize_orders: studentPrizeOrders,
      prizes_ordered: prizesOrdered,
      reading_logs: readingLog
    }

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

        if (user.type === M.UserType.STUDENT) {
          return getStudentDTO(user);
        } else if (user.type === M.UserType.EDUCATOR) {
          return getEducatorDTO(user);
        }

        return user;

      }),
      Middle.handlePromise
    ],

    getStudent: [
      Middle.authenticate,
      Middle.authorizeAgents([M.UserType.EDUCATOR, M.UserType.ADMIN]),
      unwrapData(async (req: IRequest<null>) => {
        const { userId } = req.params;

        const user = await userData.getUserById(userId);

        if (_.isNull(user)) {
          return new BadRequestError(`User ${userId} does not exist.`)
        }

        if (user.type !== M.UserType.STUDENT) {
          return new ForbiddenError(`User ${userId} is not a student.`)
        }

        const { type, _id } = req.authToken;
        if (type === M.UserType.EDUCATOR) {
          const educator = await userData.getUserById(_id) as M.IEducator;
          if (!_.includes(educator.student_ids, userId)) {
            return new ForbiddenError(`Teacher ${educator._id} does not have student ${userId}`)
          }
        }

        return await getStudentDTO(user);

      }),
      Middle.handlePromise
    ],

    updateStudentsParentsEmails: [
      Middle.authenticate,
      Middle.authorizeAgents([M.UserType.ADMIN]),
      Middle.valBody(updateParentEmailsSchema),
      unwrapData(async (req: IRequest<{ parent_emails: string[] }>) => {
        const { userId } = req.params;
        const { parent_emails } = req.body;

        const user = await userData.getUserById(userId);

        if (_.isNull(user)) {
          return new BadRequestError(`User ${userId} does not exist.`)
        }

        if (user.type !== M.UserType.STUDENT) {
          return new ForbiddenError(`User ${userId} is not a student.`)
        }

        const updatedStudent: M.IStudent = _.assign({}, user as M.IStudent, {
          parent_emails
        })

        return await userData.updateUser(updatedStudent)

      }),
      Middle.handlePromise
    ],

    bookmarkBook: [
      Middle.authenticate,
      Middle.authorizeAgents([M.UserType.ADMIN]),
      Middle.valBody(bookmarkBookSchema),
      unwrapData(async (req: IRequest<{ bookId: string }>) => {

        const { userId: studentId } = req.params;
        const { bookId } = req.body;

        const book = await bookData.getBook(bookId);

        if (_.isNull(book)) {
          return new BadRequestError(`Book ${bookId} does not exist.`)
        }

        const student = (await userData.getUserById(studentId)) as M.IStudent

        if (_.isNull(student)) {
          return new ResourceNotFoundError(`User ${studentId} does not exist.`)
        }

        if (student.type !== M.UserType.STUDENT) {
          return new ForbiddenError(`User ${studentId} is not a student.`)
        }

        const idsOfBooksBookmarked = _.map(student.bookmarked_books, 'bookId');

        if (_.includes(idsOfBooksBookmarked, bookId)) {
          return new BadRequestError(`Student ${studentId} already bookmarked book ${bookId}.`)
        }

        const updatedStudent: M.IStudent = _.assign({}, student, {
          bookmarked_books: [...student.bookmarked_books, {
            bookId,
            date: new Date().toISOString()
          }]
        })

        return await userData.updateUser(updatedStudent);

      }),
      Middle.handlePromise
    ],

    unbookmarkBook: [
      Middle.authenticate,
      Middle.authorizeAgents([M.UserType.ADMIN]),
      unwrapData(async (req: IRequest<null>) => {

        const { userId: studentId, bookId } = req.params;

        const book = await bookData.getBook(bookId);

        if (_.isNull(book)) {
          return new BadRequestError(`Book ${bookId} does not exist.`)
        }

        const student = (await userData.getUserById(studentId)) as M.IStudent

        if (_.isNull(student)) {
          return new ResourceNotFoundError(`User ${studentId} does not exist.`)
        }

        if (student.type !== M.UserType.STUDENT) {
          return new ForbiddenError(`User ${studentId} is not a student.`)
        }

        const idsOfBooksBookmarked = _.map(student.bookmarked_books, 'bookId');

        if (!_.includes(idsOfBooksBookmarked, bookId)) {
          return new BadRequestError(`Student ${studentId} never bookmarked book ${bookId}.`)
        }

        const updatedStudent: M.IStudent = _.assign({}, student, {
          bookmarked_books: _.filter(student.bookmarked_books, ({ bookId: existingId }) => existingId !== bookId)
        })

        return await userData.updateUser(updatedStudent);

      }),
      Middle.handlePromise
    ],

    createGenreInterests: [
      Middle.authenticate,
      Middle.authorizeAgents([M.UserType.ADMIN]),
      Middle.valBody(createGenreInterestSchema),
      unwrapData(async (req: IRequest<{ [genreId: string]: number }>) => {

        const user = await userData.getUserById(req.params.userId);

        if (_.isNull(user)) {
          throw new ResourceNotFoundError(`User ${req.params.userId} does not exist.`)
        }

        if (user.type !== M.UserType.STUDENT) {
          throw new ForbiddenError('Can only post genre interests for student users');
        }

        if (!_.isEmpty((user as M.IStudent).genre_interests)) {
          throw new ForbiddenError('User already has created genre interests');
        }

        const existingGenres = await genreData.getGenres();
        const existingGenreIds = _.map(existingGenres, '_id');

        const inputGenreKeys = _.keys(req.body);

        const sameNumKeys = (existingGenres.length === inputGenreKeys.length);

        if (!sameNumKeys || !_.isEmpty(_.xor(existingGenreIds, inputGenreKeys))) {
          throw new BadRequestError(`There is a discrepancy between existing genres and genres user provided interest levels for.`);
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
      Middle.authorizeAgents([M.UserType.ADMIN]),
      Middle.valBody(editGenreInterestSchema),
      unwrapData(async (req: IRequest<IUpdateGenreInterestBody>) => {

        const { userId, genreId } = req.params;
        const user = await userData.getUserById(userId) as M.IStudent;

        if (_.isNull(user)) {
          throw new ResourceNotFoundError(`No user with id ${userId}`);
        }

        if (_.isEmpty(user.genre_interests)) {
          throw new ForbiddenError('User cannot edit genre interests, until they have been created.');
        }

        const genre = await genreData.getGenreById(genreId);

        if (_.isNull(genre)) {
          throw new BadRequestError(`Genre ${genreId} does not exist.`)
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

    deletePendingStudent: [
      Middle.authenticate,
      Middle.authorize([M.UserType.ADMIN, M.UserType.EDUCATOR]),
      Middle.authorizeAgents([M.UserType.ADMIN]),
      unwrapData(async (req: IRequest<null>) => {
        
        const { userId: educatorId, studentId } = req.params;

        const educator = await userData.getUserById(educatorId) as M.IEducator;

        if (_.isNull(educator)) {
          throw new ResourceNotFoundError(`User ${educatorId} does not exist`)
        }

        if (educator.type !== M.UserType.EDUCATOR) {
          throw new BadRequestError(`User ${educatorId} is not an educator`)
        }

        if (!_.includes(educator.student_ids, studentId)) {
          throw new BadRequestError(`Student ${studentId} is not in educator ${educatorId}'s list of students`)
        }

        const student = await userData.getUserById(studentId) as M.IStudent;

        if (_.isNull(student)) {
          throw new ResourceNotFoundError(`User ${studentId} does not exist`)
        }

        if (student.type !== M.UserType.STUDENT) {
          throw new BadRequestError(`User ${studentId} is not a student`)
        }

        if (student.status !== M.StudentStatus.Pending) {
          throw new BadRequestError(`Student ${studentId} cannot be deleted as they are already active`)
        }

        await userData.deleteUser(studentId);

        const updatedEducator: M.IEducator = {
          ...educator,
          student_ids: _.filter(educator.student_ids, id => id !== studentId)
        }

        return await userData.updateUser(updatedEducator);

      }),
      Middle.handlePromise
    ],

    createPendingStudent: [
      Middle.authenticate,
      Middle.authorize([M.UserType.ADMIN, M.UserType.EDUCATOR]),
      Middle.authorizeAgents([M.UserType.ADMIN]),
      Middle.valBody(pendingStudentSchema),
      unwrapData(async (req: IRequest<M.IPendingStudentBody>) => {

        const { userId: teacherId } = req.params;

        const teacher = await userData.getUserById(req.params.userId) as M.IEducator;

        if (_.isNull(teacher)) {
          throw new ResourceNotFoundError(`Teacher ${teacherId} does not exist`)
        }

        if (teacher.type !== M.UserType.EDUCATOR) {
          throw new BadRequestError(`User ${teacherId} is not a teacher.`)
        }
        
        if (await userExistsWithEmail(req.body.email)) {
          throw new BadRequestError(`User with email ${req.body.email} already exists.`);
        }

        const pendingUser: M.IStudent = {
          ...req.body,
          type: M.UserType.STUDENT,
          status: M.StudentStatus.Pending,
          bookmarked_books: [],
          genre_interests: null,
          date_created: new Date().toISOString(),
          date_activated: null
        }

        const createdStudent = await userData.createUser(pendingUser);

        const updatedTeacher: M.IEducator = {
          ... teacher,
          student_ids: [...teacher.student_ids, createdStudent._id as string]
        }

        return await userData.updateUser(updatedTeacher);

      }),
      Middle.handlePromise
    ],

    getStudentByEmail: [
      Middle.valQueryParams({ name: 'email', schema: joi.string().email().required() }),
      unwrapData(async (req: IRequest<null>) => {
        return await userData.getUserByEmail(req.query.email);
      }),
      Middle.handlePromise
    ],

    activatePendingStudent: [
      Middle.valBody(activateUserSchema),
      unwrapData(async (req: IRequest<{ password: string }>) => {

        const { userId: studentId } = req.params;

        const user = await userData.getUserById(studentId);

        if (_.isNull(user)) {
          throw new ResourceNotFoundError(`User ${studentId} does not exist`)
        }

        if (user.type !== M.UserType.STUDENT) {
          throw new BadRequestError(`User ${studentId} is not a student.`)
        }

        const student = user as M.IStudent;

        if (student.status !== M.StudentStatus.Pending) {
          throw new BadRequestError(`Student ${studentId} is already activated.`)
        }

        const hashedPassword = await bcrypt.hash(req.body.password, Constants.HashedPassSaltLen);

        const updatedStudent: M.IStudent = {
          ...student,
          status: M.StudentStatus.Active,
          hashed_password: hashedPassword,
          date_activated: new Date().toISOString()
        }

        const activatedStudent = await userData.updateUser(updatedStudent);

        const slackMessage = `*${Helpers.getFullName(user)}* is activated`
        notifications.sendMessage(slackMessage)
        
        return <M.IAuthStudentDTO>{
          auth_token: getAuthToken(activatedStudent),
          dto: await getStudentDTO(activatedStudent)
        }


      }),
      Middle.handlePromise
    ],

    createStudent: [
      Middle.authenticate,
      Middle.authorize([M.UserType.ADMIN]),
      Middle.valBody(studentSchema),
      unwrapData(async (req: IRequest<M.IStudentBody>) => {

        if (await userExistsWithEmail(req.body.email)) {
          throw new BadRequestError(`User with email ${req.body.email} already exists.`);
        }

        const hashedPassword = await bcrypt.hash(req.body.password, Constants.HashedPassSaltLen);
        delete req.body.password;

        const nowIso = new Date().toISOString();

        const newStudent: M.IStudent = _.assign({}, req.body, {
          status: M.StudentStatus.Active,
          hashed_password: hashedPassword,
          date_created: nowIso,
          date_activated: nowIso,
          type: M.UserType.STUDENT,
          genre_interests: null,
          bookmarked_books: []
        });

        return await userData.createUser(newStudent);

      }),
      Middle.handlePromise
    ],

    updateEducatorNotificationSettings: [
      Middle.authenticate,
      Middle.authorize([M.UserType.EDUCATOR, M.UserType.ADMIN]),
      Middle.authorizeAgents([M.UserType.ADMIN]),
      Middle.valBody(notificationSettingsSchema),
      unwrapData(async (req: IRequest<M.IEducatorNoteSettings>) => {
        
        const { userId: educatorId } = req.params;

        const educator = await userData.getUserById(educatorId) as M.IEducator;

        if (_.isNull(educator)) {
          throw new ResourceNotFoundError(`Educator ${educatorId} does not exist.`)
        }

        if (educator.type !== M.UserType.EDUCATOR) {
          throw new ForbiddenError(`User ${educatorId} is not an educator`)
        }

        const updatedEducator: M.IEducator = {
          ...educator,
          notification_settings: req.body
        }

        return await userData.updateUser(updatedEducator);

      }),
      Middle.handlePromise
    ],

    createEducator: [
      Middle.authenticate,
      Middle.authorize([M.UserType.ADMIN]),
      Middle.valBody(userSchema),
      unwrapData(async (req: IRequest<M.IUserBody>) => {

        if (await userExistsWithEmail(req.body.email)) {
          throw new BadRequestError(`User with email ${req.body.email} already exists.`);
        }

        const hashedPassword = await bcrypt.hash(req.body.password, Constants.HashedPassSaltLen);
        delete req.body.password;

        const educator: M.IEducator = _.assign({}, req.body, {
          hashed_password: hashedPassword,
          date_created: new Date().toISOString(),
          type: M.UserType.EDUCATOR,
          student_ids: [],
          notification_settings: {
            reading_logs: true,
            quiz_submissions: true,
            prizes_ordered: true
          }
        });

        return await userData.createUser(educator);

      }),
      Middle.handlePromise
    ],

    updateStudentsForEducator: [
      Middle.authenticate,
      Middle.authorize([M.UserType.EDUCATOR, M.UserType.ADMIN]),
      Middle.authorizeAgents([M.UserType.ADMIN]),
      Middle.valBody(updateStudentsForTeacherSchema),
      unwrapData(async (req: IRequest<{ student_ids: string[] }>) => {

        const { userId: educatorId } = req.params;
        const { student_ids } = req.body;

        // grab educator and verify.

        const educator = await userData.getUserById(educatorId) as M.IEducator;

        if (_.isNull(educator)) {
          throw new ResourceNotFoundError(`Educator ${educatorId} does not exist.`)
        }

        if (educator.type !== M.UserType.EDUCATOR) {
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
          .filter(u => u.type !== M.UserType.STUDENT)
          .map('_id')
          .value();

        if (!_.isEmpty(nonStudentIds)) {
          throw new BadRequestError(`Users ${nonStudentIds} are not students.`)
        }


        // build updated educator object

        const updatedEducator: M.IEducator = _.assign({}, educator, {
          student_ids
        });

        return userData.updateUser(updatedEducator);

      }),
      Middle.handlePromise
    ],

    getAllUsers: [
      Middle.authenticate,
      Middle.authorize([M.UserType.ADMIN]),
      (req: IRequest<null>, res: Response, next: Next) => {
        req.promise = userData.getAllUsers();
        next();
      },
      Middle.handlePromise
    ],

    studentSignin: [
      Middle.valBody(userAuthSchema),
      unwrapData(async (req: IRequest<IUserLoginCredentials>) => {

        const { email, password } = req.body;

        const user = await userData.getUserByEmail(email);

        if (user === null) {
          throw new BadRequestError(`No user with email ${email}`);
        }

        if (user.type !== M.UserType.STUDENT) {
          throw new BadRequestError(`User must be a student.`)
        }

        const student = user as M.IStudent;

        if (student.status !== M.StudentStatus.Active) {
          throw new BadRequestError('This student account is not yet activated.');
        }

        const isPasswordCorrect = await bcrypt.compare(password, user.hashed_password);

        if (!isPasswordCorrect) {
          throw new BadRequestError('Invalid email/password combination.');
        }

        const slackMessage = `*${Helpers.getFullName(user)} signed in*`
        notifications.sendMessage(slackMessage)

        return <M.IAuthStudentDTO>{
          auth_token: getAuthToken(user),
          dto: await getStudentDTO(user)
        }

      }),
      Middle.handlePromise
    ],

    educatorSignin: [
      Middle.valBody(userAuthSchema),
      unwrapData(async (req: IRequest<IUserLoginCredentials>) => {

        const { email, password } = req.body;

        const user = await userData.getUserByEmail(email);

        if (user === null) {
          throw new BadRequestError(`No user with email ${email}`);
        }

        if (user.type !== M.UserType.EDUCATOR) {
          throw new BadRequestError(`User must be an educator.`)
        }

        const isPasswordCorrect = await bcrypt.compare(password, user.hashed_password);

        if (!isPasswordCorrect) {
          throw new BadRequestError('Invalid email/password combination.');
        }

        const slackMessage = `*${Helpers.getFullName(user)} signed in*`
        notifications.sendMessage(slackMessage)

        return <M.IAuthEducatorDTO>{
          auth_token: getAuthToken(user),
          dto: await getEducatorDTO(user)
        }

      }),
      Middle.handlePromise
    ]
  }

}