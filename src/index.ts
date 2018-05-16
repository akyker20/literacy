import * as restify from 'restify';
import * as bunyan from 'bunyan';

import { MongoBookData } from './data/books';
import { BookService } from './routes/books';
import { MongoUserData } from './data/users';
import { UserService } from './routes/users';
import { MongoGenreData } from './data/genres';
import { QuizService } from './routes/quizzes';
import { MongoQuizData } from './data/quizzes';

// logger setup

const logger = bunyan.createLogger({
  name: 'mainstream_backend',
  serializers: bunyan.stdSerializers
});

const dbHost = process.env.MONGO_HOST || 'localhost';
const dbPort = process.env.MONGO_PORT || '27017';
const dbName = process.env.MONGO_DB_NAME || 'local';

const connectionStr = `mongodb://${dbHost}:${dbPort}/${dbName}`;

const mongoBookData = new MongoBookData(connectionStr);
const mongoUserData = new MongoUserData(connectionStr);
const mongoGenreData = new MongoGenreData(connectionStr);
const mongoQuizData = new MongoQuizData(connectionStr);

const bookService = BookService(mongoGenreData, mongoBookData, mongoUserData, mongoQuizData);
const userService = UserService(mongoUserData, mongoQuizData, mongoBookData, mongoGenreData);
const quizService = QuizService(mongoQuizData, mongoBookData);

const server = restify.createServer({
  name: 'literacy_api',
  log: logger
});

server
  .use(restify.plugins.bodyParser())
  .use(restify.plugins.queryParser())
  .use(restify.plugins.requestLogger());

// Temporary

server.get('/books', bookService.getBooks);
server.get('/quizzes', quizService.getAllQuizzes);
server.get('/users', userService.getAllUsers);

// Routes

server.get('/whoami', userService.whoami);
server.post('/users/signin', userService.signin);

server.post('/students', userService.createStudent);
server.post('/students/:userId/genre_interests', userService.createGenreInterests);
server.put('/students/:userId/genre_interests/:genreId', userService.editGenreInterest);
server.get('/students/:userId/books', bookService.getBooksForStudent);

server.post('/educators', userService.createEducator);
server.put('/educator/:userId/students', userService.updateStudentsForEducator);

server.post('/quiz_submissions', quizService.submitQuiz);
server.put('/quiz_submissions/:submissionId/comprehension', quizService.setComprehensionForSubmission);

server.post('/genres', bookService.createGenre);
server.get('/genres', bookService.getGenres);
server.put('/genres/:genreId', bookService.updateGenre);
server.del('/genres/:genreId', bookService.deleteGenre);

server.post('/books', bookService.createBook);
server.put('/books/:bookId', bookService.updateBook);
server.get('/books/:bookId', bookService.getBook);
server.del('/books/:bookId', bookService.deleteBook);
server.get('/books/:bookId/quiz', quizService.getQuizForBook);

server.post('/quizzes', quizService.createQuiz);
server.del('/quizzes/:quizId', quizService.deleteQuiz);
server.put('/quizzes/:quizId', quizService.updateQuiz);

// audit logging except when testing

// if (process.env.NODE_ENV !== 'test') {
//   server.on('after', restify.plugins.auditLogger({
//     event: 'after',
//     log: logger,
//     // body: true
//   }));
// }

server.listen(3000, function() {
  console.log('%s listening at %s', server.name, server.url);
});