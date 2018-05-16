import * as restify from 'restify';
import * as bunyan from 'bunyan';

import * as Routes from './routes';
import { IBookData } from './data/books';
import { IUserData } from './data/users';
import { IGenreData } from './data/genres';
import { IQuizData } from './data/quizzes';
import { IBookReviewData } from './data/book_reviews';

// setup logger

const logger = bunyan.createLogger({
  name: 'literacy_backend',
  serializers: bunyan.stdSerializers
});

export default class App {

  server: restify.Server;

  constructor(
    bookData: IBookData,
    userData: IUserData,
    genreData: IGenreData,
    quizData: IQuizData,
    bookReviewData: IBookReviewData
  ) {

    this.server = restify.createServer({
      name: 'literacy_api',
      log: logger
    });

    this.server
      .use(restify.plugins.bodyParser())
      .use(restify.plugins.queryParser())
      .use(restify.plugins.requestLogger());

    // configure user routes

    const userRoutes = Routes.UserRoutes(
      userData,
      quizData,
      bookData,
      bookReviewData,
      genreData
    );

    this.server.get('/users', userRoutes.getAllUsers); // TODO: remove

    this.server.get('/whoami', userRoutes.whoami);
    this.server.post('/users/signin', userRoutes.signin);

    this.server.post('/students', userRoutes.createStudent);
    this.server.post('/students/:userId/genre_interests', userRoutes.createGenreInterests);
    this.server.put('/students/:userId/genre_interests/:genreId', userRoutes.editGenreInterest);

    this.server.post('/educators', userRoutes.createEducator);
    this.server.put('/educator/:userId/students', userRoutes.updateStudentsForEducator);

    // configure book routes

    const bookRoutes = Routes.BookRoutes(
      genreData,
      bookData,
      bookReviewData,
      userData,
      quizData
    );

    this.server.get('/books', bookRoutes.getBooks);

    this.server.get('/students/:userId/books', bookRoutes.getBooksForStudent);
    this.server.post('/book_reviews', bookRoutes.createBookReview);

    this.server.post('/genres', bookRoutes.createGenre);
    this.server.get('/genres', bookRoutes.getGenres);
    this.server.put('/genres/:genreId', bookRoutes.updateGenre);
    this.server.del('/genres/:genreId', bookRoutes.deleteGenre);

    this.server.post('/books', bookRoutes.createBook);
    this.server.put('/books/:bookId', bookRoutes.updateBook);
    this.server.get('/books/:bookId', bookRoutes.getBook);
    this.server.del('/books/:bookId', bookRoutes.deleteBook);

    // configure quiz routes

    const quizRoutes = Routes.QuizRoutes(
      userData,
      quizData,
      bookData
    )

    this.server.get('/quizzes', quizRoutes.getAllQuizzes); // TODO: remove

    this.server.post('/quiz_submissions', quizRoutes.submitQuiz);
    this.server.get('/students/:userId/quiz_submissions', quizRoutes.getQuizSubmissionsForStudent);

    this.server.post('/quizzes', quizRoutes.createQuiz);
    this.server.del('/quizzes/:quizId', quizRoutes.deleteQuiz);
    this.server.put('/quizzes/:quizId', quizRoutes.updateQuiz);


    /**
     * Audit logging of requests when not being tested.
     */
    // if (process.env.NODE_ENV !== 'test') {
    //   this.server.on('after', restify.plugins.auditLogger({
    //     event: 'after',
    //     log: logger
    //   }));
    // }

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