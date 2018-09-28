import * as restify from 'restify';
import * as bunyan from 'bunyan';
import * as corsMiddleware from 'restify-cors-middleware';

import * as Routes from './routes';
import { IBookData } from './data/books';
import { IUserData } from './data/users';
import { IGenreData } from './data/genres';
import { IQuizData } from './data/quizzes';
import { IBookReviewData } from './data/book_reviews';
import { Constants as SC } from 'reading_rewards';
import { IPrizeData } from './data/prizes';
import { IPrizeOrderData } from './data/prize_orders';
import { PrizeRoutes, InitiativeRoutes } from './routes';
import { INotificationSys } from './notifications';
import { IReadingLogData } from './data/reading_log';
import { IEmail } from './email';
import { IAuthorData } from './data/authors';
import { ISeriesData } from './data/series';
import { IBookRequestData } from './data/book_requests';
import { IClassInitiativeData } from './data/initiatives';

// logger configuration

const logger = bunyan.createLogger({
  name: 'literacy_backend',
  serializers: bunyan.stdSerializers
});

// cors configuration

const cors = corsMiddleware({
  origins: ['*'],
  allowHeaders: [SC.AuthHeaderField],
  exposeHeaders: []
});

export default class App {

  server: restify.Server;

  constructor(
    initiativeData: IClassInitiativeData,
    bookData: IBookData,
    userData: IUserData,
    genreData: IGenreData,
    bookRequestData: IBookRequestData,
    seriesData: ISeriesData,
    authorData: IAuthorData,
    quizData: IQuizData,
    bookReviewData: IBookReviewData,
    prizeData: IPrizeData,
    prizeOrderData: IPrizeOrderData,
    readingLogData: IReadingLogData,
    notifications: INotificationSys,
    email: IEmail
  ) {

    this.server = restify.createServer({
      name: 'literacy_api',
      log: logger
    });

    this.server
      .use(restify.plugins.bodyParser())
      .use(restify.plugins.queryParser())
      .use(restify.plugins.requestLogger());
    
    this.server.pre(cors.preflight);
    this.server.use(cors.actual);

    // liveness probe

    this.server.get('/', (req, res) => res.send(200, { message: 'Healthy!'}));

    // Maintenance
    // this.server.use((req, res) => {
    //   res.send(503)
    // })

    // configure user routes

    const userRoutes = Routes.UserRoutes(
      userData,
      quizData,
      bookData,
      prizeData,
      bookRequestData,
      bookReviewData,
      genreData,
      prizeOrderData,
      readingLogData,
      notifications
    );

    this.server.get('/whoami', userRoutes.whoami); // TESTED
    this.server.post('/students/signin', userRoutes.studentSignin); // TESTED
    this.server.post('/educators/signin', userRoutes.educatorSignin); // TESTED
    
    this.server.get('/classes/:classId/students', userRoutes.getStudentsInClass);
    this.server.get('/students/:userId', userRoutes.getStudent); // TESTED
    this.server.post('/students/:userId/activate', userRoutes.activatePendingStudent); // TESTED
    this.server.get('/students', userRoutes.getStudentByUsername); // TESTED
    this.server.post('/students/:userId/genre_interests', userRoutes.createGenreInterests); // TESTED
    this.server.put('/students/:userId/genre_interests/:genreId', userRoutes.editGenreInterest); // TESTED
    this.server.put('/students/:userId/parent_emails', userRoutes.updateStudentsParentsEmails); // TESTED

    this.server.post('/educators', userRoutes.createEducator); // TESTED
    this.server.post('/classes/:classId/students', userRoutes.createPendingStudent); // TESTED
    this.server.del('/classes/:classId/students/:studentId', userRoutes.deletePendingStudent); // TESTED
    this.server.put('/educators/:userId/notification_settings', userRoutes.updateEducatorNotificationSettings); // TESTED
    this.server.post('/students/:userId/bookmarked_books', userRoutes.bookmarkBook); // TESTED
    this.server.del('/students/:userId/bookmarked_books/:bookId', userRoutes.unbookmarkBook); // TESTED
    this.server.post('/students/:userId/book_requests', userRoutes.createBookRequest); // TESTED
    this.server.del('/students/:userId/book_requests/:requestId', userRoutes.deleteBookRequest); // TESTED
    this.server.put('/requests/:requestId/status', userRoutes.updateBookRequestStatus); // TESTED
    this.server.get('/classes/:classId/book_requests', userRoutes.getBookRequestsForClass);
    this.server.get('/classes/:classId', userRoutes.getClass);
    this.server.get('/classes', userRoutes.getAllClasses);
    this.server.get('/classes/:classId/teacher', userRoutes.getTeacherForClass);

    // configure initiative routes

    const initiativeRoutes = InitiativeRoutes(
      bookData,
      initiativeData,
      quizData,
      userData
    );
    
    this.server.get('/classes/:classId/initiative', initiativeRoutes.getClassInitiative);
    
    // configure book routes

    const bookRoutes = Routes.BookRoutes(
      genreData,
      authorData,
      bookData,
      bookReviewData,
      userData,
      quizData,
      seriesData,
      notifications
    );

    this.server.get('/authors', bookRoutes.getAllAuthors); // TESTED

    this.server.get('/students/:userId/books', bookRoutes.getBooksForStudent); // TESTED
    this.server.post('/books/:bookId/book_reviews', bookRoutes.createBookReview); // TESTED

    this.server.post('/genres', bookRoutes.createGenre); // TESTED
    this.server.get('/genres', bookRoutes.getGenres); // TESTED
    this.server.put('/genres/:genreId', bookRoutes.updateGenre); // TESTED
    this.server.del('/genres/:genreId', bookRoutes.deleteGenre); // TESTED

    this.server.get('/books', bookRoutes.getAllBooks); // TESTED
    this.server.get('/books/:bookId/reviews', bookRoutes.getBookReviewsForBook); // TESTED
    this.server.post('/books', bookRoutes.createBook); // TESTED
    this.server.put('/books/:bookId', bookRoutes.updateBook); // TESTED
    this.server.get('/books/:bookId', bookRoutes.getBook); // TESTED
    this.server.del('/books/:bookId', bookRoutes.deleteBook); // TESTED

    // configure quiz routes

    const quizRoutes = Routes.QuizRoutes(
      userData,
      quizData,
      bookData,
      readingLogData,
      notifications,
      email
    )

    this.server.get('/books/:bookId/quiz', quizRoutes.getQuizForBook); // TESTED
    this.server.post('/students/:userId/quiz_submissions', quizRoutes.submitQuiz); // TESTED
    this.server.post('/quizzes', quizRoutes.createQuiz); // TESTED
    this.server.get('/quizzes', quizRoutes.getAllQuizzes); // TESTED
    this.server.del('/quizzes/:quizId', quizRoutes.deleteQuiz); // TESTED
    this.server.put('/quizzes/:quizId', quizRoutes.updateQuiz); // TESTED

    // configure prize routes

    const prizeRoutes = PrizeRoutes(
      prizeData,
      prizeOrderData,
      userData,
      notifications,
      email
    );

    this.server.get('/prizes', prizeRoutes.getAllPrizes); // TESTED
    this.server.post('/prizes', prizeRoutes.createPrize); // TESTED
    this.server.put('/prizes/:prizeId', prizeRoutes.updatePrize); // TESTED
    this.server.del('/prizes/:prizeId', prizeRoutes.deletePrize); // TESTED
    this.server.post('/prize_orders/:orderId/ordered', prizeRoutes.setPrizeOrderStatusToOrdered); // TESTED
    this.server.post('/students/:userId/prize_orders', prizeRoutes.orderPrize); // TESTED

    // configure reading log routes

    const readingLogRoutes = Routes.ReadingLogRoutes(
      userData,
      bookData,
      readingLogData,
      notifications,
      email
    )

    this.server.get('/students/:userId/reading_logs', readingLogRoutes.getLogsForStudent); // TESTED
    this.server.post('/students/:userId/reading_logs', readingLogRoutes.createLog); // TESTED
    this.server.del('/students/:userId/reading_logs/:logId', readingLogRoutes.deleteLog); // TESTED


    /**
     * Audit logging of requests when not being tested.
     */
    if (process.env.NODE_ENV !== 'test') {
      this.server.on('after', restify.plugins.auditLogger({
        event: 'after',
        log: logger
      }));
    }

    /**
     * Log internal server errors.
     * TODO: Email me when this happens.
     */
    this.server.on('InternalServer', function (req: restify.Request, res, err, callback) {
      req.log.error({ err }, 'INTERNAL SERVER ERR');
      return callback();
    });

  }

  listen(port: number) {
    console.log(`Starting app on port ${port}`);
    this.server.listen(port);
  }

}