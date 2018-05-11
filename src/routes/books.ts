import { Response, Next } from 'restify';
import { IBookData, IBook } from '../data/books';
import { IRequest } from '../Extensions';
import * as Middle from '../middleware';
import * as joi from 'joi';
import { genFieldErr } from '../helpers';
import _ = require('lodash');
import { ResourceNotFoundError } from 'restify-errors';
import { UserType } from '../data/users';
import { IGenre, IGenreData } from '../data/genres';

export const bookSchema = joi.object({
  cover_photo_url: joi.string().required().error(genFieldErr('cover_photo_url')),
  amazon_popularity: joi.number().min(0).max(5).required().error(genFieldErr('amazon_popularity')),
  title: joi.string().required().error(genFieldErr('title')),
  summary: joi.string().min(100).max(1000).required().error(genFieldErr('summary')),
  lexile_measure: joi.number().min(0).max(2000).required().error(genFieldErr('lexile_measure')),
  num_pages: joi.number().min(40).max(3000).required().error(genFieldErr('num_pages')),
  isbn: joi.string().regex(/^(97(8|9))?\d{9}(\d|X)$/).required().error(genFieldErr('isbn')),
  author: joi.string().required().error(genFieldErr('author')),
  genres: joi.array().items(joi.string()).min(1).max(5).required().error(genFieldErr('genres'))
}).strict().required();

export const genreSchema = joi.object({
  title: joi.string().required().error(genFieldErr('title')),
}).required();

export function BookService(
  genreData: IGenreData,
  bookData: IBookData
) {

  return {

    /**
     * Genre Routes
     */

    createGenre: [
      Middle.authenticate,
      Middle.authorize([UserType.ADMIN]),
      Middle.valBody<IGenre>(genreSchema),
      (req: IRequest<IGenre>, res: Response, next: Next) => {
        const genre = req.body;
        genreData.createGenre(genre)
          .then(createdGenre => res.send(201, createdGenre))
          .catch(err => next(err))
      }
    ],
    getGenres: [
      Middle.authenticate,
      (req: IRequest<IGenre>, res: Response, next: Next) => {
        genreData.getGenres()
          .then(genres => res.send(genres))
          .catch(err => next(err))
      }
    ],
    deleteGenre: [
      Middle.authenticate,
      Middle.authorize([UserType.ADMIN]),
      (req: IRequest<null>, res: Response, next: Next) => {
        genreData.deleteGenre(req.params.genreId)
          .then(deleted_genre => {
            if (_.isEmpty(deleted_genre)) {
              return next(new ResourceNotFoundError('No genre was deleted'))
            }
            res.send({ deleted_genre })
          })
          .catch(err => next(err))
      }
    ],

    /**
     * Book Routes
     */

    createBook: [
      Middle.authenticate,
      Middle.authorize([UserType.ADMIN]),
      Middle.valBody<IBook>(bookSchema),
      (req: IRequest<IBook>, res: Response, next: Next) => {
        const book = req.body;
        bookData.createBook(book)
          .then(createdBook => res.send(201, createdBook))
          .catch(err => next(err))
      }
    ],
    getBook: [
      (req: IRequest<IBook>, res: Response, next: Next) => {
        bookData.getBook(req.params.isbn)
          .then(book => res.send(book))
          .catch(err => next(err))
      }
    ],
    getAllBooks: [
      Middle.authenticate,
      Middle.authorize([UserType.ADMIN]),
      (req: IRequest<IBook>, res: Response, next: Next) => {
        bookData.getBooks()
          .then(books => res.send(books))
          .catch(err => next(err))
      }
    ],
    getBooksOfGenre: [
      Middle.authenticate,
      (req: IRequest<IBook>, res: Response, next: Next) => {
        bookData.getBooksOfGenre(req.params.genreId)
          .then(books => res.send(books))
          .catch(err => next(err))
      }
    ],
    deleteBook: [
      Middle.authenticate,
      Middle.authorize([UserType.ADMIN]),
      (req: IRequest<IBook>, res: Response, next: Next) => {
        bookData.deleteBook(req.params.isbn)
          .then(book_deleted => {
            if (_.isEmpty(book_deleted)) {
              return next(new ResourceNotFoundError('No book was deleted'))
            }
            res.send({ book_deleted })
          })
          .catch(err => next(err))
      }
    ]
  }

}