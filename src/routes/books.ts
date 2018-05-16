import { Response, Next } from 'restify';
import { IBookData, IBook } from '../data/books';
import { IRequest, lexileMeasureSchema, shortidSchema } from '../Extensions';
import * as Middle from '../middleware';
import * as joi from 'joi';
import { genFieldErr, getLexileRange, computeMatchScore, computeCurrentLexileMeasure, unwrapData } from '../helpers';
import _ = require('lodash');
import { ResourceNotFoundError, BadRequestError, ForbiddenError } from 'restify-errors';
import { UserType, IUserData, IStudent } from '../data/users';
import { IGenre, IGenreData } from '../data/genres';
import { IQuizData } from '../data/quizzes';
import { IBookReview, IBookReviewData, IBookReviewBody } from '../data/book_reviews';

const inputBookReview = joi.object({
  comprehension: joi.number().integer().strict().valid([1, 2, 3, 4, 5]).required().error(genFieldErr('comprehension')),
  review: joi.string().max(300).optional().error(genFieldErr('review')),
  book_id: shortidSchema.required().error(genFieldErr('book_id')),
  student_id: shortidSchema.required().error(genFieldErr('student_id'))
}).required()

const inputBookSchema = joi.object({
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

const createdBookSchema = inputBookSchema.keys({
  _id: shortidSchema.required().error(genFieldErr('_id'))
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
  bookData: IBookData,
  bookReviewData: IBookReviewData,
  userData: IUserData,
  quizData: IQuizData
) {

  async function checkBookForInvalidGenres(candidate: IBook): Promise<string[]> {
    
    const existingGenres = await genreData.getGenres();
    const existingGenreIds = _.map(existingGenres, '_id');
    const invalidGenres = _.difference(candidate.genres, existingGenreIds);

    if (!_.isEmpty(invalidGenres)) {
      return invalidGenres;
    }

    return null;
  }

  return {

    createBookReview: [
      Middle.authenticate,
      Middle.authorize([UserType.STUDENT, UserType.ADMIN]),
      (req: IRequest<IBookReviewBody>, res: Response, next: Next) => {
        const { type, _id: userId } = req.authToken;
        if ((type !== UserType.ADMIN) && (userId !== req.body.student_id)) {
          return next(new ForbiddenError(`User ${userId} cannot write book review for user ${req.body.student_id}`));
        }
        next();
      },
      Middle.valBody<IBookReviewBody>(inputBookReview),
      unwrapData(async (req: IRequest<IBookReviewBody>) => {

        const { student_id, book_id } = req.body;

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

        const bookReview: IBookReview = _.assign({}, req.body, {
          date_created: new Date().toISOString(),
          book_lexile_measure: book.lexile_measure
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
      Middle.authorize([UserType.ADMIN]),
      Middle.valBody<IGenre>(inputGenreSchema),
      (req: IRequest<IGenre>, res: Response, next: Next) => {
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
      Middle.authorize([UserType.ADMIN]),
      Middle.valBody<IGenre>(createdGenreSchema),
      Middle.valIdsSame('genreId'),
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
      Middle.authorize([UserType.ADMIN]),
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
      Middle.authorize([UserType.ADMIN]),
      Middle.valBody<IBook>(inputBookSchema),
      unwrapData(async (req: IRequest<IBook>) => {

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
      (req: IRequest<IBook>, res: Response, next: Next) => {
        req.promise = bookData.getBook(req.params.bookId);
        next();
      },
      Middle.handlePromise
    ],
    getBooks: [
      Middle.authenticate,
      unwrapData(async (req: IRequest<IBook>) => {

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
      Middle.authorizeAgents([UserType.ADMIN]),
      unwrapData(async (req: IRequest<IBook>) => {

        const { userId } = req.params;
        
        const user = await userData.getUserById(userId) as IStudent;

        if (user === null) {
          throw new ResourceNotFoundError(`User with id ${req.params.userId} does not exist.`);
        }

        if (_.isEmpty(user.genre_interests)) {
          throw new ForbiddenError(`Student ${userId} has not provided genre interests`)
        }

        const studentBookReviews = await bookReviewData.getBookReviewsForStudent(user._id);
        
        const currentLexileMeasure = computeCurrentLexileMeasure(
          user.initial_lexile_measure, 
          studentBookReviews
        );
        const currentLexileRange = getLexileRange(currentLexileMeasure);

        const booksInRange = await bookData.getMatchingBooks({ lexile_range: currentLexileRange });

        return booksInRange.map(book => _.assign({}, book, {
          match_score: computeMatchScore(
            user.genre_interests, 
            book
          )
        }))

      }),
      Middle.handlePromise
    ],
    updateBook: [
      Middle.authenticate,
      Middle.authorize([UserType.ADMIN]),
      Middle.valBody<IBook>(createdBookSchema),
      Middle.valIdsSame('bookId'),
      unwrapData(async (req: IRequest<IBook>) => {

        const bookUpdate = req.body;

        const invalidGenres = await checkBookForInvalidGenres(bookUpdate);

        if (!_.isEmpty(invalidGenres)) {
          throw new BadRequestError(`Genre ids ${invalidGenres.join(', ')} are invalid.`)
        }

        const updatedBook = await bookData.updateBook(req.body);

        if (_.isNull(updatedBook)) {
          throw new ResourceNotFoundError('No book was updated');
        }

        return updatedBook;

      }),
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