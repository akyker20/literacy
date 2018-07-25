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
import { PrizeRoutes } from './routes';
import { INotificationSys } from './notifications';
import { IReadingLogData } from './data/reading_log';

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
    bookData: IBookData,
    userData: IUserData,
    genreData: IGenreData,
    quizData: IQuizData,
    bookReviewData: IBookReviewData,
    prizeData: IPrizeData,
    prizeOrderData: IPrizeOrderData,
    readingLogData: IReadingLogData,
    notifications: INotificationSys
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
      bookReviewData,
      genreData,
      prizeOrderData,
      prizeData,
      readingLogData,
      notifications
    );
    
    this.server.get('/users', userRoutes.getAllUsers); // TODO: remove

    this.server.get('/whoami', userRoutes.whoami); // TEST
    this.server.post('/students/signin', userRoutes.studentSignin);
    this.server.post('/educators/signin', userRoutes.educatorSignin);

    this.server.post('/students', userRoutes.createStudent);
    this.server.post('/students/:userId/activate', userRoutes.activatePendingStudent);
    this.server.get('/students', userRoutes.getStudentByEmail);
    this.server.post('/educators/:userId/students', userRoutes.createPendingStudent);
    this.server.post('/students/:userId/genre_interests', userRoutes.createGenreInterests);
    this.server.put('/students/:userId/genre_interests/:genreId', userRoutes.editGenreInterest);
    this.server.put('/students/:userId/parent_emails', userRoutes.updateStudentsParentsEmails);
    
    this.server.post('/educators', userRoutes.createEducator);
    this.server.put('/educators/:userId/students', userRoutes.updateStudentsForEducator);
    this.server.del('/educators/:userId/students/:studentId', userRoutes.deletePendingStudent);

    this.server.post('/students/:userId/bookmarked_books', userRoutes.bookmarkBook);
    this.server.del('/students/:userId/bookmarked_books/:bookId', userRoutes.unbookmarkBook)

    // configure book routes

    const bookRoutes = Routes.BookRoutes(
      genreData,
      bookData,
      bookReviewData,
      userData,
      quizData
    );

    this.server.get('/students/:userId/books', bookRoutes.getBooksForStudent); // TEST
    this.server.post('/book_reviews', bookRoutes.createBookReview);

    this.server.post('/genres', bookRoutes.createGenre);
    this.server.get('/genres', bookRoutes.getGenres);
    this.server.put('/genres/:genreId', bookRoutes.updateGenre);
    this.server.del('/genres/:genreId', bookRoutes.deleteGenre);

    this.server.get('/books', bookRoutes.getBooks);
    this.server.get('/books/:bookId/reviews', bookRoutes.getBookReviewsForBook);
    this.server.post('/books', bookRoutes.createBook);
    this.server.put('/books/:bookId', bookRoutes.updateBook);
    this.server.get('/books/:bookId', bookRoutes.getBook);
    this.server.del('/books/:bookId', bookRoutes.deleteBook);

    // configure quiz routes

    const quizRoutes = Routes.QuizRoutes(
      userData,
      quizData,
      bookData,
      notifications
    )

    this.server.get('/books/:bookId/quiz', quizRoutes.getQuizForBook);

    this.server.get('/quizzes', quizRoutes.getAllQuizzes); // TODO: remove

    this.server.post('/quiz_submissions', quizRoutes.submitQuiz);

    this.server.post('/quizzes', quizRoutes.createQuiz);
    this.server.del('/quizzes/:quizId', quizRoutes.deleteQuiz);
    this.server.put('/quizzes/:quizId', quizRoutes.updateQuiz);

    // configure prize routes

    const prizeRoutes = PrizeRoutes(
      prizeData,
      prizeOrderData,
      userData,
      notifications
    );

    this.server.get('/prizes', prizeRoutes.getPrizes);
    this.server.post('/prizes', prizeRoutes.createPrize);
    this.server.put('/prizes/:prizeId', prizeRoutes.updatePrize);
    this.server.del('/prizes/:prizeId', prizeRoutes.deletePrize);
    this.server.post('/prize_orders', prizeRoutes.orderPrize);

    // configure reading log routes

    const readingLogRoutes = Routes.ReadingLogRoutes(
      userData,
      bookData,
      readingLogData,
      notifications
    )

    this.server.get('/students/:userId/reading_logs', readingLogRoutes.getLogsForStudent);
    this.server.post('/students/:userId/reading_logs', readingLogRoutes.createLog);
    this.server.del('/students/:userId/reading_logs/:logId', readingLogRoutes.deleteLog);


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