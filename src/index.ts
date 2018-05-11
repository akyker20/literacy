import * as restify from 'restify';
import { MongoBookData } from './data/books';
import { BookService } from './routes/books';
import { MongoUserData } from './data/users';
import { UserService } from './routes/users';
import { MongoGenreData } from './data/genres';

const dbHost = process.env.MONGO_HOST || 'localhost';
const dbPort = process.env.MONGO_PORT || '27017';
const dbName = process.env.MONGO_DB_NAME || 'local';

const connectionStr = `mongodb://${dbHost}:${dbPort}/${dbName}`;

const mongoBookData = new MongoBookData(connectionStr);
const mongoUserData = new MongoUserData(connectionStr);
const mongoGenreData = new MongoGenreData(connectionStr);

const bookService = BookService(mongoGenreData, mongoBookData);
const userService = UserService(mongoUserData);

const server = restify.createServer();
server.use(restify.plugins.bodyParser());

server.post('/genres', bookService.createGenre);
server.get('/genres', bookService.getGenres);
server.del('/genres/:genreId', bookService.deleteGenre);
server.get('/genres/:genreId/books', bookService.getBooksOfGenre);

server.post('/books', bookService.createBook);
server.get('/books', bookService.getAllBooks);
server.get('/books/:isbn', bookService.getBook);
server.del('/books/:isbn', bookService.deleteBook);

server.post('/users/signin', userService.signin);

server.listen(8080, function() {
  console.log('%s listening at %s', server.name, server.url);
});