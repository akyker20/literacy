import { Response, Next } from 'restify';
import { IBookData, IBook } from '../data/books';
import { IRequest, lexileMeasureSchema } from '../Extensions';
import * as Middle from '../middleware';
import * as joi from 'joi';
import { genFieldErr, getLexileRange, computeMatchScore, computeCurrentLexileMeasure, unwrapData } from '../helpers';
import _ = require('lodash');
import { ResourceNotFoundError, BadRequestError } from 'restify-errors';
import { UserType, IUserData, IStudent } from '../data/users';
import { IGenre, IGenreData } from '../data/genres';
import { IQuizData } from '../data/quizzes';

export const bookSchema = joi.object({
  cover_photo_url: joi.string().required().error(genFieldErr('cover_photo_url')),
  amazon_popularity: joi.number().min(0).max(5).required().error(genFieldErr('amazon_popularity')),
  title: joi.string().required().error(genFieldErr('title')),
  summary: joi.string().min(100).max(1000).required().error(genFieldErr('summary')),
  lexile_measure: lexileMeasureSchema.error(genFieldErr('lexile_measure')),
  num_pages: joi.number().min(40).max(3000).required().error(genFieldErr('num_pages')),
  isbn: joi.string().regex(/^(97(8|9))?\d{9}(\d|X)$/).required().error(genFieldErr('isbn')),
  author: joi.string().required().error(genFieldErr('author')),
  genres: joi.array().items(joi.string()).min(1).max(5).unique().required().error(genFieldErr('genres'))
}).strict().required();

export const genreSchema = joi.object({
  title: joi.string().required().error(genFieldErr('title')),
  description: joi.string().max(200).required().error(genFieldErr('description'))
}).required();

export function BookService(
  genreData: IGenreData,
  bookData: IBookData,
  userData: IUserData,
  quizData: IQuizData
) {

  return {

    /**
     * Genre Routes
     */

    createGenre: [
      Middle.authenticate,
      Middle.authorize([UserType.ADMIN]),
      Middle.valBody<IGenre>(genreSchema),
      (req: IRequest<IGenre>) => {
        const genre = req.body;
        req.promise = genreData.createGenre(genre)
      },
      Middle.handlePromise
    ],
    getGenres: [
      Middle.authenticate,
      (req: IRequest<IGenre>) => {
        req.promise = genreData.getGenres();
      },
      Middle.handlePromise
    ],
    updateGenre: [
      Middle.authenticate,
      Middle.authorize([UserType.ADMIN]),
      Middle.valBody<IGenre>(genreSchema),
      (req: IRequest<null>) => {
        req.promise = genreData.updateGenre(req.body);
      },
      Middle.handlePromise
    ],
    deleteGenre: [
      Middle.authenticate,
      Middle.authorize([UserType.ADMIN]),
      unwrapData(async (req: IRequest<null>) => {

        const deletedGenre = await genreData.deleteGenre(req.params.genreId);

        if (_.isEmpty(deletedGenre)) {
          throw new ResourceNotFoundError('No genre was deleted')
        }

        return { deletedGenre };

      })
    ],

    /**
     * Book Routes
     */

    createBook: [
      Middle.authenticate,
      Middle.authorize([UserType.ADMIN]),
      Middle.valBody<IBook>(bookSchema),
      unwrapData(async (req: IRequest<IBook>) => {

        const book = req.body;
        const existingGenres = await genreData.getGenres();
        const existingGenreIds = _.map(existingGenres, '_id');
        const invalidGenres = _.difference(book.genres, existingGenreIds)
        
        if (!_.isEmpty(invalidGenres)) {
          throw new BadRequestError(`Genre ids ${invalidGenres.join(',')} are invalid.`)
        }
        
        return bookData.createBook(book);

      }),
      Middle.handlePromise
    ],
    getBook: [
      (req: IRequest<IBook>, res: Response, next: Next) => {
        req.promise = bookData.getBook(req.params.bookId);
      },
      Middle.handlePromise
    ],
    getAllBooks: [
      Middle.authenticate,
      Middle.authorize([UserType.ADMIN]),
      (req: IRequest<IBook>, res: Response, next: Next) => {
        req.promise = bookData.getAllBooks()
      },
      Middle.handlePromise
    ],
    getBooksForStudent: [
      Middle.authenticate,
      Middle.authorizeAgents([UserType.ADMIN]),
      unwrapData(async (req: IRequest<IBook>) => {

        const userId = req.params.id;
        
        const user = await userData.getUserById(userId) as IStudent;

        if (user === null) {
          throw new ResourceNotFoundError(`User with id ${req.params.id} does not exist.`);
        }

        const userQuizSubmissions = await quizData.getSubmissionsForUser(userId);
        
        const currentLexileMeasure = computeCurrentLexileMeasure(user.initial_lexile_measure, userQuizSubmissions);
        const currentLexileRange = getLexileRange(currentLexileMeasure);

        const booksInRange = await bookData.getMatchingBooks({ lexile_range: currentLexileRange });
        
        return booksInRange.map(book => _.assign({}, book, {
          match_score: computeMatchScore(
            user.genre_interests, 
            currentLexileMeasure, 
            book
          )
        }))

      }),
      Middle.handlePromise
    ],
    updateBook: [
      Middle.authenticate,
      Middle.authorize([UserType.ADMIN]),
      Middle.valBody<IBook>(bookSchema),
      (req: IRequest<null>, res: Response, next: Next) => {
        req.promise = bookData.updateBook(req.body);
      },
      Middle.handlePromise
    ],
    deleteBook: [
      Middle.authenticate,
      Middle.authorize([UserType.ADMIN]),
      unwrapData(async (req: IRequest<IBook>) => {
        
        const deletedBook = await bookData.deleteBook(req.params.bookId);
        
        if (_.isEmpty(deletedBook)) {
          throw new ResourceNotFoundError('No book was deleted')
        }

        return { deletedBook };

      }),
      Middle.handlePromise
    ]
  }

}