import { Response, Next } from 'restify';
import { Models as M } from 'reading_rewards';
import * as joi from 'joi';
import * as _ from 'lodash';

import { IBookData } from '../data/books';
import { IRequest, lexileMeasureSchema, shortidSchema } from '../extensions';
import * as Middle from '../middleware';
import { genFieldErr, computeMatchScore, unwrapData } from '../helpers';
import { ResourceNotFoundError, BadRequestError, ForbiddenError } from 'restify-errors';
import { IUserData } from '../data/users';
import { IBookReviewData } from '../data/book_reviews';
import { IGenreData } from '../data/genres';
import { IQuizData } from '../data/quizzes';
import { IAuthorData } from '../data/authors';
import { ISeriesData } from '../data/series';

const inputBookReview = joi.object({
  interest: joi.number().integer().strict().valid([1, 2, 3, 4, 5]).required(),
  comprehension: joi.number().integer().strict().valid([1, 2, 3, 4, 5]).required(),
  review: joi.string().max(500).optional(),
  book_id: shortidSchema.required(),
  student_id: shortidSchema.required()
}).required()

const sharedBookSchema = joi.object({
  cover_photo_url: joi.string().required().error(genFieldErr('cover_photo_url')),
  amazon_popularity: joi.number().min(0).max(5).required().error(genFieldErr('amazon_popularity')),
  title: joi.string().required().error(genFieldErr('title')),
  summary: joi.string().min(100).max(1000).required().error(genFieldErr('summary')),
  lexile_measure: lexileMeasureSchema.error(genFieldErr('lexile_measure')),
  num_pages: joi.number().min(40).max(3000).required().error(genFieldErr('num_pages')),
  isbn: joi.string().regex(/^(97(8|9))?\d{9}(\d|X)$/).required().error(genFieldErr('isbn')),
  genres: joi.array().items(joi.string()).min(1).max(5).unique().required().error(genFieldErr('genres')),
  series: joi.object({
    book_num: joi.number().integer().required(),
    id: shortidSchema
  }).optional()
}).strict().required();

const inputBookSchema = sharedBookSchema.keys({
  author_ids: joi.array().items(shortidSchema).required().error(genFieldErr('author_ids'))
}).strict().required();

const createdBookSchema = sharedBookSchema.keys({
  _id: shortidSchema.required().error(genFieldErr('_id')),
  authors: joi.array().items(joi.object({
    id: shortidSchema,
    name: joi.string().required()
  }).min(1).max(4).required())
}).required();

const inputGenreSchema = joi.object({
  title: joi.string().required().error(genFieldErr('title')),
  description: joi.string().max(200).required().error(genFieldErr('description'))
}).required();

const createdGenreSchema = inputGenreSchema.keys({
  _id: shortidSchema.required().error(genFieldErr('_id'))
}).required();

export function BookRoutes(
  genreData: IGenreData,
  authorData: IAuthorData,
  bookData: IBookData,
  bookReviewData: IBookReviewData,
  userData: IUserData,
  quizData: IQuizData,
  seriesData: ISeriesData
) {

  async function checkBookForInvalidGenres(candidate: M.IBook): Promise<string[]> {
    
    const existingGenres = await genreData.getGenres();
    const existingGenreIds = _.map(existingGenres, '_id');
    const invalidGenres = _.difference(candidate.genres, existingGenreIds);

    if (!_.isEmpty(invalidGenres)) {
      return invalidGenres;
    }

    return null;
  }

  return {

    getBookReviewsForBook: [
      Middle.authenticate,
      unwrapData(async (req: IRequest<null>) => {

        const { bookId } = req.params;
        const bookReviews = await bookReviewData.getReviewsForBook(bookId);
        const activeReviews = bookReviews.filter(review => review.is_active && !_.isEmpty(review.review))
        
        return <M.IBookReviewDTO[]> activeReviews.map(review => ({
          _id: review._id,
          review: review.review,
          date_created: review.date_created,
          student_initials: review.student_initials
        }))
        
      }),
      Middle.handlePromise
    ],

    getAllSeries: [
      Middle.authenticate,
      unwrapData(async () => seriesData.getAllSeries()),
      Middle.handlePromise
    ],

    getAllAuthors: [
      Middle.authenticate,
      unwrapData(async () => authorData.getAllAuthors()),
      Middle.handlePromise
    ],

    getAuthor: [
      Middle.authenticate,
      unwrapData(async (req) => authorData.getAuthorById(req.params.authorId)),
      Middle.handlePromise
    ],

    getBooksByAuthor: [
      Middle.authenticate,
      unwrapData(async (req) => bookData.getBooksByAuthor(req.params.authorId)),
      Middle.handlePromise
    ],

    createBookReview: [
      Middle.authenticate,
      Middle.authorize([M.UserType.STUDENT, M.UserType.ADMIN]),
      (req: IRequest<M.IBookReviewBody>, res: Response, next: Next) => {
        const { type, _id: userId } = req.authToken;
        if ((type !== M.UserType.ADMIN) && (userId !== req.body.student_id)) {
          return next(new ForbiddenError(`User ${userId} cannot write book review for user ${req.body.student_id}`));
        }
        next();
      },
      Middle.valBody<M.IBookReviewBody>(inputBookReview),
      unwrapData(async (req: IRequest<M.IBookReviewBody>) => {

        const { student_id, book_id } = req.body;

        const student = await userData.getUserById(student_id);

        if (_.isNull(student)) {
          throw new BadRequestError(`User ${student_id} does not exist`);
        }

        // verify the book actually exists

        const book = await bookData.getBook(book_id);

        if (_.isNull(book)) {
          throw new BadRequestError(`Book ${book_id} does not exist`);
        }

        // verify the student already passed the quiz.

        const studentSubmissions = await quizData.getSubmissionsForStudent(student_id);
        const passedSubmissionForBook = _.find(studentSubmissions, { passed: true, book_id });

        if (_.isUndefined(passedSubmissionForBook)) {
          throw new ForbiddenError(`User has not passed a quiz for book ${book_id}. The user must do this before posting a review.`)
        }

        // verify the student has not already reviewed the book.

        const existingBookReview = await bookReviewData.getBookReview(student_id, book_id);
        
        if (!_.isNull(existingBookReview)) {
          throw new ForbiddenError(`Student ${student_id} has already posted a book review for book ${book_id}`);
        }

        // build book review and save it to database.

        const bookReview: M.IBookReview = _.assign({}, req.body, {
          date_created: new Date().toISOString(),
          book_lexile_measure: book.lexile_measure,
          is_active: true,
          student_initials: `${student.first_name.charAt(0)}${student.last_name.charAt(0)}`.toUpperCase()
        })
        
        return bookReviewData.createBookReview(bookReview);

      }),
      Middle.handlePromise
    ],

    /**
     * Genre Routes
     */

    createGenre: [
      Middle.authenticate,
      Middle.authorize([M.UserType.ADMIN]),
      Middle.valBody<M.IGenre>(inputGenreSchema),
      (req: IRequest<M.IGenre>, res: Response, next: Next) => {
        req.promise = genreData.createGenre(req.body);
        next();
      },
      Middle.handlePromise
    ],
    getGenres: [
      Middle.authenticate,
      (req: IRequest<null>, res: Response, next: Next) => {
        req.promise = genreData.getGenres();
        next();
      },
      Middle.handlePromise
    ],
    updateGenre: [
      Middle.authenticate,
      Middle.authorize([M.UserType.ADMIN]),
      Middle.valBody<M.IGenre>(createdGenreSchema),
      Middle.valIdsSame({ paramKey: 'genreId', bodyKey: '_id' }),
      unwrapData(async (req: IRequest<null>) => {
        
        const updatedGenre = await genreData.updateGenre(req.body);

        if (_.isNull(updatedGenre)) {
          throw new ResourceNotFoundError('No genre was updated')
        }
        
        return { updatedGenre };

      }),
      Middle.handlePromise
    ],
    deleteGenre: [
      Middle.authenticate,
      Middle.authorize([M.UserType.ADMIN]),
      unwrapData(async (req: IRequest<null>) => {

        const deletedGenre = await genreData.deleteGenre(req.params.genreId);

        if (_.isEmpty(deletedGenre)) {
          throw new ResourceNotFoundError('No genre was deleted')
        }

        return { deletedGenre };

      }),
      Middle.handlePromise
    ],

    /**
     * Book Routes
     */

    createBook: [
      Middle.authenticate,
      Middle.authorize([M.UserType.ADMIN]),
      Middle.valBody<M.IBook>(inputBookSchema),
      unwrapData(async (req: IRequest<M.IBook>) => {

        const bookCandidate = req.body;

        const invalidGenres = await checkBookForInvalidGenres(bookCandidate);

        if (!_.isEmpty(invalidGenres)) {
          throw new BadRequestError(`Genre ids ${invalidGenres.join(', ')} are invalid.`)
        }
        
        return bookData.createBook(bookCandidate);

      }),
      Middle.handlePromise
    ],
    getBook: [
      Middle.authenticate,
      unwrapData(async (req: IRequest<null>) => {
        const book = await bookData.getBook(req.params.bookId);
        if (_.isNull(book)) {
          throw new ResourceNotFoundError(`Book ${req.params.bookId} does not exist.`);
        }
        return book;
      }),
      Middle.handlePromise
    ],
    getBooks: [
      Middle.authenticate,
      unwrapData(async (req: IRequest<M.IBook>) => {

        const searchQuery = req.query.q;

        if (!_.isEmpty(searchQuery)) {
          return bookData.searchBooks(searchQuery);
        }

        return bookData.getAllBooks();

      }),
      Middle.handlePromise
    ],
    getBooksForStudent: [
      Middle.authenticate,
      Middle.authorizeAgents([M.UserType.ADMIN]),
      unwrapData(async (req: IRequest<M.IBook>) => {

        const { userId } = req.params;
        
        const user = await userData.getUserById(userId) as M.IStudent;

        if (user === null) {
          throw new ResourceNotFoundError(`User with id ${req.params.userId} does not exist.`);
        }

        if (_.isEmpty(user.genre_interests)) {
          throw new ForbiddenError(`Student ${userId} has not provided genre interests`)
        }

        // const studentBookReviews = await bookReviewData.getBookReviewsForStudent(user._id);
        
        const allBooks = await bookData.getAllBooks();

        const matchScores: { [bookId: string]: number } = {};
        _.forEach(allBooks, book => {
          matchScores[book._id] = computeMatchScore(
            user.genre_interests, 
            book
          )
        })
        
        return <M.IStudentBooksDTO> {
          books: allBooks,
          match_scores: matchScores
        }

      }),
      Middle.handlePromise
    ],
    updateBook: [
      Middle.authenticate,
      Middle.authorize([M.UserType.ADMIN]),
      Middle.valBody<M.IBook>(createdBookSchema),
      Middle.valIdsSame({ paramKey: 'bookId', bodyKey: '_id' }),
      unwrapData(async (req: IRequest<M.IBook>) => {

        const bookUpdate = req.body;

        const invalidGenres = await checkBookForInvalidGenres(bookUpdate);

        if (!_.isEmpty(invalidGenres)) {
          throw new BadRequestError(`Genre ids ${invalidGenres.join(', ')} are invalid.`)
        }

        const updatedBook = await bookData.updateBook(req.body);

        if (_.isNull(updatedBook)) {
          throw new ResourceNotFoundError('No book was updated');
        }

        return { updatedBook };

      }),
      Middle.handlePromise
    ],
    deleteBook: [
      Middle.authenticate,
      Middle.authorize([M.UserType.ADMIN]),
      unwrapData(async (req: IRequest<M.IBook>) => {
        
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