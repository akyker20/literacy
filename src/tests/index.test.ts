// PossModels.IBle Reason for Flakes:

// 1. Faker creates text that is too long and fails validation checks in route. See faker.lorem.paragraph(X)

import * as fs from 'fs';
import * as Path from 'path';
import * as shortid from 'shortid';
import * as jwt from 'jsonwebtoken';
import * as monk from 'monk';
import * as faker from 'faker';
import * as moment from 'moment';
import * as supertest from 'supertest';
import * as bcrypt from 'bcryptjs';
import * as _ from 'lodash';
import { Models, Mockers, Constants as SC, Helpers } from 'reading_rewards';
import { assert } from 'chai';

import * as BEC from '../constants'
import App from '../app';

import { MongoAuthorData } from '../data/authors';
import { MongoUserData } from '../data/users';
import { MongoBookData } from '../data/books';
import { MongoQuizData } from '../data/quizzes';
import { MongoBookReviewData } from '../data/book_reviews';
import { MongoGenreData } from '../data/genres';
import { MongoPrizeData } from '../data/prizes';
import { MongoPrizeOrderData } from '../data/prize_orders';
import { MockNotifications } from '../notifications/mock';
import { MongoReadingLogData } from '../data/reading_log';
import { MockEmail } from '../email/mock';
import { MongoSeriesData } from '../data/series';
import { MongoBookRequestData } from '../data/book_requests';

// Load all the data

const initialClasses: Models.IClass[] = JSON.parse(fs.readFileSync(Path.join(__dirname, '../../test_data/classes.json'), 'utf8'));
const initialBookRequests: Models.IBookRequest[] = JSON.parse(fs.readFileSync(Path.join(__dirname, '../../test_data/book_requests.json'), 'utf8'));
const initialBooks: Models.IBook[] = JSON.parse(fs.readFileSync(Path.join(__dirname, '../../test_data/books.json'), 'utf8'));
const initialGenres: Models.IGenre[] = JSON.parse(fs.readFileSync(Path.join(__dirname, '../../test_data/genres.json'), 'utf8'));
const initialQuizzes: Models.IQuiz[] = JSON.parse(fs.readFileSync(Path.join(__dirname, '../../test_data/quizzes.json'), 'utf8'));
const initialUsers: Models.IUser[] = JSON.parse(fs.readFileSync(Path.join(__dirname, '../../test_data/users.json'), 'utf8'));
const initialQuizSubmissions: Models.IQuizSubmission[] = JSON.parse(fs.readFileSync(Path.join(__dirname, '../../test_data/quiz_submissions.json'), 'utf8'));
const initialBookReviews: Models.IBookReview[] = JSON.parse(fs.readFileSync(Path.join(__dirname, '../../test_data/book_reviews.json'), 'utf8'));
const initialPrizes: Models.IPrize[] = JSON.parse(fs.readFileSync(Path.join(__dirname, '../../test_data/prizes.json'), 'utf8'));
const initialPrizeOrders: Models.IPrizeOrder[] = JSON.parse(fs.readFileSync(Path.join(__dirname, '../../test_data/prize_orders.json'), 'utf8'));
const initialReadingLogs: Models.IReadingLog[] = JSON.parse(fs.readFileSync(Path.join(__dirname, '../../test_data/reading_logs.json'), 'utf8'));
const initialAuthors: Models.IAuthor[] = JSON.parse(fs.readFileSync(Path.join(__dirname, '../../test_data/authors.json'), 'utf8'));

// convenience variables

const austin = _.find(initialUsers, { _id: 'austin-kyker' });
const austinToken = genAuthTokenForUser(austin);

const bonnie = _.find(initialUsers, { _id: 'bonnie-stewart' }) as Models.IEducator;
const bonnieToken = genAuthTokenForUser(bonnie);

const bonnieClass: Models.IClass = _.find(initialClasses, { teacher_id: bonnie._id });

const mikePhillips = _.find(initialUsers, { _id: 'mike-phillips' }) as Models.IEducator;
const mikePhillipsToken = genAuthTokenForUser(mikePhillips);

const katelynn = _.find(initialUsers, { _id: 'katelynn-kyker' }) as Models.IStudent;
const katelynnToken = genAuthTokenForUser(katelynn);

const jb = _.find(initialUsers, { _id: 'jb-rapp' }) as Models.IStudent;
const jbToken = genAuthTokenForUser(jb);

const inactiveStudent = _.find(initialUsers, { status: Models.StudentStatus.Pending }) as Models.IStudent;

const chase = _.find(initialUsers, { _id: 'chase-malik' }) as Models.IStudent;
const chaseToken = genAuthTokenForUser(chase);

let dbHost = process.env.MONGO_HOST || 'localhost';
let dbPort = process.env.MONGO_PORT || '27017';
let dbName = process.env.MONGO_DB_NAME || 'ete';

const connectionStr = `mongodb://${dbHost}:${dbPort}/${dbName}`;

const db = monk.default(connectionStr);
db.addMiddleware(require('monk-middleware-debug'))

const classCollection = db.get('classes', { castIds: false });
const authorCollection = db.get('authors', { castIds: false });
const bookCollection = db.get('books', { castIds: false });
const bookReviewCollection = db.get('book_reviews', { castIds: false });
const quizCollection = db.get('quizzes', { castIds: false });
const quizSubmissionCollection = db.get('quiz_submissions', { castIds: false });
const usersCollection = db.get('users', { castIds: false });
const genreCollection = db.get('genres', { castIds: false });
const prizeCollection = db.get('prizes', { castIds: false });
const prizeOrderCollection = db.get('prize_orders', { castIds: false });
const readingLogCollection = db.get('reading_logs', { castIds: false });
const bookRequestCollection = db.get('book_requests', { castIds: false });

async function setData(collection: monk.ICollection, data: any) {
  await collection.remove({});
  await collection.insert(data);
}

const mongoAuthorData = new MongoAuthorData(connectionStr);
const mongoBookData = new MongoBookData(connectionStr);
const mongoUserData = new MongoUserData(connectionStr);
const mongoGenreData = new MongoGenreData(connectionStr);
const mongoQuizData = new MongoQuizData(connectionStr);
const mongoBookReviewData = new MongoBookReviewData(connectionStr);
const mongoPrizeData = new MongoPrizeData(connectionStr);
const mongoPrizeOrderData = new MongoPrizeOrderData(connectionStr);
const readingLogData = new MongoReadingLogData(connectionStr);
const mongoSeriesData = new MongoSeriesData(connectionStr)
const mongoBookRequestData = new MongoBookRequestData(connectionStr);

const app = new App(
  mongoBookData,
  mongoUserData,
  mongoGenreData,
  mongoBookRequestData,
  mongoSeriesData,
  mongoAuthorData,
  mongoQuizData,
  mongoBookReviewData,
  mongoPrizeData,
  mongoPrizeOrderData,
  readingLogData,
  new MockNotifications(),
  new MockEmail(false /* log emails */)
)

const agent = supertest(app.server);

function genAuthToken(type: Models.UserType, id?: string): string {
  return jwt.sign({ _id: id || shortid.generate(), type }, BEC.JWTSecret, { expiresIn: '1y' });
}

function genAuthTokenForUser(user: Models.IUser): string {
  return genAuthToken(user.type, user._id);
}

function checkErrMsg(msg: string) {
  return ({ body }: any) => {
    assert.equal(body.message, msg);
  };
}

describe('End to End tests', function () {

  beforeEach(async function () {
    await Promise.all([
      setData(classCollection, initialClasses),
      setData(bookCollection, initialBooks),
      setData(bookReviewCollection, initialBookReviews),
      setData(genreCollection, initialGenres),
      setData(quizCollection, initialQuizzes),
      setData(quizSubmissionCollection, initialQuizSubmissions),
      setData(usersCollection, initialUsers),
      setData(prizeCollection, initialPrizes),
      setData(prizeOrderCollection, initialPrizeOrders),
      setData(readingLogCollection, initialReadingLogs),
      setData(authorCollection, initialAuthors),
      setData(bookRequestCollection, initialBookRequests)
    ]);
  });

  describe('Genre Routes', function () {

    describe('#createGenre', function () {

      const validGenreBody: Models.IGenre = {
        title: 'Some genre title',
        description: 'Some genre description'
      };

      it('should 401 when no auth token in header', function () {
        return agent
          .post('/genres')
          .expect(401);
      });

      it('should 403 if non-admin making request', function () {
        return agent
          .post(`/genres`)
          .set(SC.AuthHeaderField, katelynnToken)
          .expect(403);
      });

      it('should save the genre', function () {
        return agent
          .post('/genres')
          .set(SC.AuthHeaderField, austinToken)
          .send(validGenreBody)
          .expect(200)
          .then(({ body }) => {
            assert.containsAllKeys(body, ['_id', 'title', 'description']);
            assert.equal(body.title, validGenreBody.title);
            assert.equal(body.description, validGenreBody.description);
            return genreCollection.find({})
          })
          .then(allGenres => assert.lengthOf(allGenres, initialGenres.length + 1))
      })

    })

    describe('#getGenres', function () {

      it('should 401 when no auth token in header', function () {
        return agent
          .get('/genres')
          .expect(401);
      });

      it('should return all genres', function () {
        return agent
          .get('/genres')
          .set(SC.AuthHeaderField, katelynnToken)
          .expect(200)
          .then(({ body }) => assert.sameDeepMembers(body, initialGenres))
      })

    })

    describe('#updateGenres', function () {

      const genreToUpdate = _.sample(initialGenres);
      const genreId = genreToUpdate._id;
      const update: Models.IGenre = Mockers.mockGenre({
        _id: genreToUpdate._id
      });

      it('should 401 when no auth token in header', function () {
        return agent
          .put(`/genres/${genreId}`)
          .expect(401);
      });

      it('should 403 if not admin user', function () {
        return agent
          .put(`/genres/${genreId}`)
          .set(SC.AuthHeaderField, katelynnToken)
          .expect(403);
      });

      it('should update the genre', function () {
        return agent
          .put(`/genres/${genreId}`)
          .set(SC.AuthHeaderField, austinToken)
          .send(update)
          .expect(200)
          .then(({ body }) => {
            assert.deepEqual(body, { updatedGenre: update })
            return genreCollection.findOne({ _id: genreId })
          })
          .then(genre => assert.deepEqual(genre, update))
      })

    })

    describe('#deleteGenre', function () {

      const idOfGenreToDelete = initialGenres[0]._id;

      it('should 401 when no auth token in header', function () {
        return agent
          .del(`/genres/${idOfGenreToDelete}`)
          .expect(401);
      });

      it('should 404 if genre does not exist', function () {
        return agent
          .del(`/genres/${shortid.generate()}`)
          .set(SC.AuthHeaderField, austinToken)
          .expect(404)
          .then(checkErrMsg('No genre was deleted'))
      });

      it('should 403 if non-admin making request', function () {
        return agent
          .del(`/genres/${idOfGenreToDelete}`)
          .set(SC.AuthHeaderField, katelynnToken)
          .expect(403);
      });

      it('should delete the genre', function () {
        return agent
          .del(`/genres/${idOfGenreToDelete}`)
          .set(SC.AuthHeaderField, austinToken)
          .expect(200)
          .then(({ body }) => {
            assert.deepEqual(body, {
              deletedGenre: _.find(initialGenres, { _id: idOfGenreToDelete })
            })
            return genreCollection.find({})
          })
          .then(allGenres => assert.lengthOf(allGenres, initialGenres.length - 1))
      })

    })

  })

  describe('Prize Routes', function () {

    describe('#createPrizeOrder', function () {

      const validPrizeBody: Models.IPrizeOrderBody = {
        student_id: katelynn._id,
        prize_id: _.sample(initialPrizes)._id
      };

      it('should 401 when no auth token in header', function () {
        return agent
          .post(`/students/${katelynn._id}/prize_orders`)
          .expect(401);
      });

      it('should 400 if student id in url different from body', function () {
        return agent
          .post(`/students/${chase._id}/prize_orders`)
          .set(SC.AuthHeaderField, austinToken)
          .send(validPrizeBody)
          .expect(400)
      });

      it('should 403 when students submits on behalf another student', function () {
        return agent
          .post(`/students/${katelynn._id}/prize_orders`)
          .set(SC.AuthHeaderField, chaseToken)
          .send(validPrizeBody)
          .expect(403)
      });

      it('should 404 if student does not exist', function () {
        const invalidId = shortid.generate();
        const invalidPrizeBody = {
          ...validPrizeBody,
          student_id: invalidId
        }
        return agent
          .post(`/students/${invalidId}/prize_orders`)
          .set(SC.AuthHeaderField, austinToken)
          .send(invalidPrizeBody)
          .expect(404)
          .then(checkErrMsg(`User ${invalidId} does not exist.`))
      })

      it('should 404 if prize does not exist', function () {
        const invalidId = shortid.generate();
        const invalidPrizeBody = {
          ...validPrizeBody,
          prize_id: invalidId
        }
        return agent
          .post(`/students/${katelynn._id}/prize_orders`)
          .set(SC.AuthHeaderField, austinToken)
          .send(invalidPrizeBody)
          .expect(404)
          .then(checkErrMsg(`Prize ${invalidId} does not exist.`))
      })

      it('should save the prize order', function () {
        return agent
          .post(`/students/${katelynn._id}/prize_orders`)
          .set(SC.AuthHeaderField, austinToken)
          .send(validPrizeBody)
          .expect(200)
          .then(({ body }) => {
            assert.equal(body.status, Models.PrizeOrderStatus.Pending);
            assert.containsAllKeys(body, [
              '_id',
              'student_id',
              'prize_id',
              'prize_price_usd',
              'prize_point_cost',
              'status',
              'date_created'
            ]);
            return prizeOrderCollection.find({})
          })
          .then(allPrizeOrders => assert.lengthOf(allPrizeOrders, initialPrizeOrders.length + 1))
      })

    })

    describe('#setPrizeOrderStatusToOrdered', function () {

      const unorderedPrizeOrder = _.find(initialPrizeOrders, { status: Models.PrizeOrderStatus.Pending });
      const orderedPrizeOrder = _.find(initialPrizeOrders, { status: Models.PrizeOrderStatus.Ordered });

      it('should 401 when no auth token in header', function () {
        return agent
          .post(`/prize_orders/${unorderedPrizeOrder._id}/ordered`)
          .expect(401);
      });

      it('should 403 if non-admin making request when no auth token in header', function () {
        return agent
          .post(`/prize_orders/${unorderedPrizeOrder._id}/ordered`)
          .set(SC.AuthHeaderField, katelynnToken)
          .expect(403);
      });

      it('should 404 if prize order does not exist', function () {
        const invalidId = shortid.generate();
        return agent
          .post(`/prize_orders/${invalidId}/ordered`)
          .set(SC.AuthHeaderField, austinToken)
          .expect(404);
      });

      it('should 400 if prize was already ordered', function () {
        return agent
          .post(`/prize_orders/${orderedPrizeOrder._id}/ordered`)
          .set(SC.AuthHeaderField, austinToken)
          .expect(400);
      });

      it('should 200 and update the status', function () {
        return agent
          .post(`/prize_orders/${unorderedPrizeOrder._id}/ordered`)
          .set(SC.AuthHeaderField, austinToken)
          .expect(200)
          .then(() => prizeOrderCollection.findOne({ _id: unorderedPrizeOrder._id }))
          .then(({ status, date_ordered }: Models.IPrizeOrder) => {
            assert.equal(status, Models.PrizeOrderStatus.Ordered);
            assert.isTrue(moment(date_ordered, moment.ISO_8601).isValid())
          })
      });

    })

    describe('#createPrize', function () {

      const validPrizeBody: Models.IPrize = {
        title: 'Some Prize title',
        description: ['Some prize bullet point'],
        price_usd: 13.5,
        photo_urls: ['http://some-url']
      };

      it('should 401 when no auth token in header', function () {
        return agent
          .post('/prizes')
          .expect(401);
      });

      it('should 403 if non-admin making request', function () {
        return agent
          .post(`/prizes`)
          .set(SC.AuthHeaderField, katelynnToken)
          .expect(403);
      });

      it('should save the prize', function () {
        return agent
          .post('/prizes')
          .set(SC.AuthHeaderField, austinToken)
          .send(validPrizeBody)
          .expect(200)
          .then(({ body }) => {
            assert.containsAllKeys(body, [
              '_id',
              'title',
              'description',
              'price_usd',
              'photo_urls'
            ]);
            return prizeCollection.find({})
          })
          .then(allPrizes => assert.lengthOf(allPrizes, initialPrizes.length + 1))
      })

    })

    describe('#deletePrize', function () {

      const idOfPrizeToDelete = initialPrizes[0]._id;

      it('should 401 when no auth token in header', function () {
        return agent
          .del(`/prizes/${idOfPrizeToDelete}`)
          .expect(401);
      });

      it('should 404 if prize does not exist', function () {
        return agent
          .del(`/prizes/${shortid.generate()}`)
          .set(SC.AuthHeaderField, austinToken)
          .expect(404)
          .then(checkErrMsg('No prize was deleted'))
      });

      it('should 403 if non-admin making request', function () {
        return agent
          .del(`/prizes/${idOfPrizeToDelete}`)
          .set(SC.AuthHeaderField, katelynnToken)
          .expect(403);
      });

      it('should delete the genre', function () {
        return agent
          .del(`/prizes/${idOfPrizeToDelete}`)
          .set(SC.AuthHeaderField, austinToken)
          .expect(200)
          .then(({ body }) => {
            assert.deepEqual(body, {
              deletedPrize: _.find(initialPrizes, { _id: idOfPrizeToDelete })
            })
            return prizeCollection.find({})
          })
          .then(allPrizes => assert.lengthOf(allPrizes, initialPrizes.length - 1))
      })

    })

    describe('#getPrizes', function () {

      it('should 401 when no auth token in header', function () {
        return agent
          .get('/prizes')
          .expect(401);
      });

      it('should return all prizes', function () {
        return agent
          .get('/prizes')
          .set(SC.AuthHeaderField, katelynnToken)
          .expect(200)
          .then(({ body }) => assert.sameDeepMembers(body, initialPrizes))
      })

    })

    describe('#updatePrize', function () {

      const prizeToUpdate = _.sample(initialPrizes);
      const prizeId = prizeToUpdate._id;
      const update: Models.IPrize = Mockers.mockPrize({
        _id: prizeId
      });

      it('should 401 when no auth token in header', function () {
        return agent
          .put(`/prizes/${prizeId}`)
          .expect(401);
      });

      it('should 403 if non-admin user', function () {
        return agent
          .put(`/prizes/${prizeId}`)
          .set(SC.AuthHeaderField, katelynnToken)
          .expect(403);
      });

      it('should update the prize', function () {
        return agent
          .put(`/prizes/${prizeId}`)
          .set(SC.AuthHeaderField, austinToken)
          .send(update)
          .expect(200)
          .then(({ body }) => {
            assert.deepEqual(body, { updatedPrize: update })
            return prizeCollection.findOne({ _id: prizeId })
          })
          .then(prize => assert.deepEqual(prize, update))
      })

    })

  })

  describe('Book Routes', function () {

    describe('#getAllAuthors', function () {

      it('should 401 when no auth token in header', function () {
        return agent
          .get('/authors')
          .expect(401);
      });

      it('should return all authors', function () {
        return agent
          .get('/authors')
          .set(SC.AuthHeaderField, austinToken)
          .expect(200)
          .then(({ body }) => assert.sameDeepMembers(body, initialAuthors))
      })

    })

    describe('#createBook', function () {

      let validBookBody: Models.IBook = Mockers.mockBook({
        genres: [initialGenres[0]._id],
        authors: [_.sample(initialAuthors)._id as string]
      });
      delete validBookBody._id;

      it('should 401 when no auth token in header', function () {
        return agent
          .post('/books')
          .expect(401);
      });

      it('should 403 if non-admin making request', function () {
        return agent
          .post(`/books`)
          .set(SC.AuthHeaderField, katelynnToken)
          .expect(403);
      });

      it('should 400 if invalid genres', function () {
        const invalidBody = _.cloneDeep(validBookBody);
        const invalidId = shortid.generate();
        invalidBody.genres = [invalidId];

        return agent
          .post(`/books`)
          .set(SC.AuthHeaderField, austinToken)
          .send(invalidBody)
          .expect(400)
          .then(checkErrMsg(`Genre ids ${invalidId} are invalid.`))
      });

      it('should 400 if invalid authors', function () {
        const invalidBody = _.cloneDeep(validBookBody);
        const invalidId = shortid.generate();
        invalidBody.authors = [invalidId];

        return agent
          .post(`/books`)
          .set(SC.AuthHeaderField, austinToken)
          .send(invalidBody)
          .expect(400)
          .then(checkErrMsg(`Author ids ${invalidId} are invalid.`))
      });

      it('should save the book', function () {
        return agent
          .post('/books')
          .set(SC.AuthHeaderField, austinToken)
          .send(validBookBody)
          .expect(200)
          .then(({ body }) => {
            assert.containsAllKeys(body, ['_id', ..._.keys(validBookBody)]);
            delete body._id;
            assert.deepEqual(body, validBookBody);
            return bookCollection.find({})
          })
          .then(allBooks => assert.lengthOf(allBooks, initialBooks.length + 1))
      })

    })

    describe('#deleteBook', function () {

      const idOfBookToDelete = initialBooks[0]._id;

      it('should 401 when no auth token in header', function () {
        return agent
          .del(`/books/${idOfBookToDelete}`)
          .expect(401);
      });

      it('should 404 if book does not exist', function () {
        return agent
          .del(`/books/${shortid.generate()}`)
          .set(SC.AuthHeaderField, austinToken)
          .expect(404)
          .then(checkErrMsg('No book was deleted'))
      });

      it('should 403 if non-admin making request', function () {
        return agent
          .del(`/books/${idOfBookToDelete}`)
          .set(SC.AuthHeaderField, katelynnToken)
          .expect(403);
      });

      it('should delete the book', function () {
        return agent
          .del(`/books/${idOfBookToDelete}`)
          .set(SC.AuthHeaderField, austinToken)
          .expect(200)
          .then(({ body }) => {
            assert.deepEqual(body, {
              deletedBook: _.find(initialBooks, { _id: idOfBookToDelete })
            })
            return bookCollection.find({})
          })
          .then(allBooks => assert.lengthOf(allBooks, initialBooks.length - 1))
      })

    })

    describe('#getBooks', function () {

      it('should 401 when no auth token in header', function () {
        return agent
          .get('/books')
          .expect(401);
      });

      it('should 403 if not admin', function () {
        return agent
          .get('/books')
          .set(SC.AuthHeaderField, katelynnToken)
          .expect(403);
      });

      it('should return all books', function () {
        return agent
          .get('/books')
          .set(SC.AuthHeaderField, austinToken)
          .expect(200)
          .then(({ body }) => assert.sameDeepMembers(body, initialBooks))
      })

    })

    describe('#getBook', function () {

      const idOfBookToFetch = _.sample(initialBooks);

      it('should 401 when no auth token in header', function () {
        return agent
          .get(`/books/${idOfBookToFetch}`)
          .expect(401);
      });

      it('should 404 if book does not exist', function () {
        const invalidId = shortid.generate();
        return agent
          .get(`/books/${invalidId}`)
          .set(SC.AuthHeaderField, katelynnToken)
          .expect(404)
          .then(checkErrMsg(`Book ${invalidId} does not exist.`))
      })

      it('should 200 and return the book', function () {
        const bookToFetch = _.sample(initialBooks);
        return agent
          .get(`/books/${bookToFetch._id}`)
          .set(SC.AuthHeaderField, katelynnToken)
          .expect(200)
          .then(({ body }) => assert.deepEqual(bookToFetch, body))
      })

    })

    describe('#updateBook', function () {

      const bookToUpdate = _.sample(initialBooks);
      const bookId = bookToUpdate._id;
      const update: Models.IBook = Mockers.mockBook({
        _id: bookToUpdate._id,
        genres: _.cloneDeep(bookToUpdate.genres),
        authors: _.cloneDeep(bookToUpdate.authors)
      });

      it('should 401 when no auth token in header', function () {
        return agent
          .put(`/books/${bookId}`)
          .expect(401);
      });

      it('should 403 if not admin user', function () {
        return agent
          .put(`/books/${bookId}`)
          .set(SC.AuthHeaderField, katelynnToken)
          .expect(403);
      });

      it('should update the book', function () {
        return agent
          .put(`/books/${bookId}`)
          .set(SC.AuthHeaderField, austinToken)
          .send(update)
          .expect(200)
          .then(({ body }) => {
            assert.deepEqual(body, { updatedBook: update })
            return bookCollection.findOne({ _id: bookId })
          })
          .then(book => assert.deepEqual(book, update))
      })

    })

    describe('#createBookReview', function () {

      // chase has not submitted a quiz for this book
      const bookNotReadId = 'baseball-id';
      const reviewForBookNotRead = Mockers.mockBookReview({
        student_id: chase._id,
        book_id: bookNotReadId
      });
      delete reviewForBookNotRead.book_lexile_measure;
      delete reviewForBookNotRead.date_created;
      delete reviewForBookNotRead._id;
      delete reviewForBookNotRead.is_active;
      delete reviewForBookNotRead.student_initials;

      const katelynnReview = _.find(initialBookReviews, { student_id: katelynn._id });
      assert.isDefined(katelynnReview);
      const repeatReview: Models.IBookReviewBody = {
        student_id: katelynn._id,
        book_id: katelynnReview.book_id,
        comprehension: 5,
        interest: 4,
        review: 'another review'
      }

      const bookChaseReadId = _.find(initialQuizSubmissions, { student_id: chase._id, passed: true }).book_id;
      if (_.isUndefined(bookChaseReadId)) {
        throw new Error('issue with test')
      }
      const reviewForBookRead = Mockers.mockBookReview({
        student_id: chase._id,
        book_id: bookChaseReadId
      });
      delete reviewForBookRead.book_lexile_measure;
      delete reviewForBookRead.date_created;
      delete reviewForBookRead._id;
      delete reviewForBookRead.is_active;
      delete reviewForBookRead.student_initials;

      it('should 401 when no auth token in header', function () {
        return agent
          .post(`/books/${_.sample(initialBooks)._id}/book_reviews`)
          .expect(401);
      });

      it('should 403 if student submitting for another student', function () {
        return agent
          .post(`/books/${bookChaseReadId}/book_reviews`)
          .set(SC.AuthHeaderField, katelynnToken)
          .send(reviewForBookRead)
          .expect(403)
          .then(checkErrMsg(`User ${katelynn._id} cannot write book review for user ${chase._id}`))
      });

      it('should 404 if the book does not exist', function () {
        const invalidId = shortid.generate();
        return agent
          .post(`/books/${invalidId}/book_reviews`)
          .set(SC.AuthHeaderField, austinToken)
          .send({
            ...reviewForBookNotRead,
            book_id: invalidId
          })
          .expect(404)
      });

      it('should 400 if student has not passed a quiz for book', function () {
        return agent
          .post(`/books/${reviewForBookNotRead.book_id}/book_reviews`)
          .set(SC.AuthHeaderField, chaseToken)
          .send(reviewForBookNotRead)
          .expect(400)
          .then(checkErrMsg(`User has not passed a quiz for book ${bookNotReadId}. The user must do this before posting a review.`))
      });

      it('should 400 if student has already submitted a review for the book', function () {
        return agent
          .post(`/books/${katelynnReview.book_id}/book_reviews`)
          .set(SC.AuthHeaderField, katelynnToken)
          .send(repeatReview)
          .expect(400)
          .then(checkErrMsg(`Student ${katelynn._id} has already posted a book review for book ${repeatReview.book_id}`))
      });

      it('should 200 and create the review', function () {
        return agent
          .post(`/books/${reviewForBookRead.book_id}/book_reviews`)
          .set(SC.AuthHeaderField, chaseToken)
          .send(reviewForBookRead)
          .expect(200)
          .then(({ body }) => {
            delete body.date_created;
            delete body._id;
            const expected = {
              ...reviewForBookRead,
              book_lexile_measure: _.find(initialBooks, { _id: reviewForBookRead.book_id }).lexile_measure,
              is_active: true,
              student_initials: 'CM'
            }
            assert.deepEqual(body, expected);
            return bookReviewCollection.find({})
          })
          .then(reviews => assert.lengthOf(reviews, initialBookReviews.length + 1))
      });

    })

  })

  describe('Quiz Routes', function () {

    const allBookIds = _.map(initialBooks, '_id');
    const idsOfBooksWithQuizzes = _.chain(initialQuizzes)
      .filter(q => !_.isEmpty(q.book_id))
      .map('book_id')
      .value();
    const booksWithoutQuiz = _.difference(allBookIds, idsOfBooksWithQuizzes);

    const bookWithQuiz = _.find(initialBooks, b => _.includes(idsOfBooksWithQuizzes, b._id));
    const bookWithoutQuiz = _.find(initialBooks, b => _.includes(booksWithoutQuiz, b._id));

    describe('#createQuiz', function () {

      let validQuizBody = Mockers.mockQuiz({
        questions: _.times(5, () => Mockers.mockQuizQuestion()),
        book_id: bookWithoutQuiz._id
      })
      delete validQuizBody._id;
      delete validQuizBody.date_created;

      let repeatQuizBody = Mockers.mockQuiz({
        questions: _.times(5, () => Mockers.mockQuizQuestion()),
        book_id: bookWithQuiz._id
      })
      delete validQuizBody._id;
      delete validQuizBody.date_created;

      it('should 401 when no auth token in header', function () {
        return agent
          .post(`/quizzes`)
          .expect(401);
      });

      it('should 403 if non-admin making the request', function () {
        return agent
          .post(`/quizzes`)
          .set(SC.AuthHeaderField, katelynnToken)
          .expect(403);
      });

      it('should 404 if book does not exist', function () {
        return agent
          .post(`/quizzes`)
          .set(SC.AuthHeaderField, austinToken)
          .send({
            ...validQuizBody,
            book_id: shortid.generate()
          })
          .expect(404);
      });

      it('should 400 if quiz already exists for book', function () {
        return agent
          .post(`/quizzes`)
          .set(SC.AuthHeaderField, austinToken)
          .send(repeatQuizBody)
          .expect(400);
      });

      it('should create a new quiz', function () {
        return agent
          .post(`/quizzes`)
          .set(SC.AuthHeaderField, austinToken)
          .send(validQuizBody)
          .expect(200)
          .then(({ body }) => {
            delete body._id;
            delete body.date_created;
            assert.deepEqual(body, validQuizBody);
            return quizCollection.find({})
          })
          .then(quizzes => assert.lengthOf(quizzes, initialQuizzes.length + 1))
      });

    });

    describe('#deleteQuiz', function () {

      const idOfQuizToDelete = initialQuizzes[0]._id;

      it('should 401 when no auth token in header', function () {
        return agent
          .del(`/genres/${idOfQuizToDelete}`)
          .expect(401);
      });

      it('should 404 if quiz does not exist', function () {
        return agent
          .del(`/quizzes/${shortid.generate()}`)
          .set(SC.AuthHeaderField, austinToken)
          .expect(404)
          .then(checkErrMsg('No quiz was deleted'))
      });

      it('should 403 if non-admin making request', function () {
        return agent
          .del(`/quizzes/${idOfQuizToDelete}`)
          .set(SC.AuthHeaderField, katelynnToken)
          .expect(403);
      });

      it('should delete the quiz', function () {
        return agent
          .del(`/quizzes/${idOfQuizToDelete}`)
          .set(SC.AuthHeaderField, austinToken)
          .expect(200)
          .then(({ body }) => {
            assert.deepEqual(body, {
              deletedQuiz: _.find(initialQuizzes, { _id: idOfQuizToDelete })
            })
            return quizCollection.find({})
          })
          .then(allQuizzes => assert.lengthOf(allQuizzes, initialQuizzes.length - 1))
      })

    })

    describe('#updateQuiz', function () {

      const quizToUpdate = _.sample(initialQuizzes);
      const quizId = quizToUpdate._id;
      const update: Models.IQuiz = Mockers.mockQuiz({
        _id: quizToUpdate._id,
        questions: _.times(5, () => Mockers.mockQuizQuestion())
      });

      it('should 401 when no auth token in header', function () {
        return agent
          .put(`/quizzes/${quizId}`)
          .expect(401);
      });

      it('should 403 if not admin user', function () {
        return agent
          .put(`/quizzes/${quizId}`)
          .set(SC.AuthHeaderField, katelynnToken)
          .expect(403);
      });

      it('should 404 if quiz does not exist', function () {
        const invalidId = shortid.generate()
        return agent
          .put(`/quizzes/${invalidId}`)
          .set(SC.AuthHeaderField, austinToken)
          .send({
            ...update,
            _id: invalidId
          })
          .expect(404)
      });

      it('should 404 if book does not exist', function () {
        return agent
          .put(`/quizzes/${update._id}`)
          .set(SC.AuthHeaderField, austinToken)
          .send({
            ...update,
            book_id: shortid.generate()
          })
          .expect(404)
      });

      it('should update the quiz', function () {
        return agent
          .put(`/quizzes/${quizId}`)
          .set(SC.AuthHeaderField, austinToken)
          .send(update)
          .expect(200)
          .then(({ body }) => {
            assert.deepEqual(body, { updatedQuiz: update })
            return quizCollection.findOne({ _id: quizId })
          })
          .then(quiz => assert.deepEqual(quiz, update))
      })

    })

    describe('#submitQuiz', function () {

      const genericQuiz = _.find(initialQuizzes, q => _.isUndefined(q.book_id))

      const chasePassQuizSubBody = {
        student_id: chase._id,
        book_id: 'baseball-id',
        quiz_id: genericQuiz._id,
        answers: [
          { answer_index: 3 },
          { answer_index: 2 },
          { answer_index: 2 },
          { answer_index: 2 },
          { answer_index: 0 }
        ]
      }

      const chaseFailedQuizSubBody = {
        student_id: chase._id,
        book_id: 'baseball-id',
        quiz_id: genericQuiz._id,
        answers: [
          { answer_index: 4 },
          { answer_index: 1 },
          { answer_index: 2 },
          { answer_index: 2 },
          { answer_index: 0 }
        ]
      }

      const kkQuizSubForBookAlreadyPassed = {
        student_id: katelynn._id,
        book_id: 'baseball-id',
        quiz_id: genericQuiz._id,
        answers: [
          { answer_index: 3 },
          { answer_index: 2 },
          { answer_index: 2 },
          { answer_index: 2 },
          { answer_index: 0 }
        ]
      }

      const kkQuizSubForBookAlreadyFailed = {
        student_id: katelynn._id,
        book_id: 'hatchet-id',
        quiz_id: genericQuiz._id,
        answers: [
          { answer_index: 3 },
          { answer_index: 2 },
          { answer_index: 2 },
          { answer_index: 2 },
          { answer_index: 0 }
        ]
      }

      it('should 401 when no auth token in header', function () {
        return agent
          .post(`/students/${katelynn._id}/quiz_submissions`)
          .expect(401);
      });

      it('should 404 if quiz is invalid', function () {
        const copy = _.cloneDeep(chasePassQuizSubBody);
        copy.quiz_id = shortid.generate();
        return agent
          .post(`/students/${chase._id}/quiz_submissions`)
          .set(SC.AuthHeaderField, chaseToken)
          .send(copy)
          .expect(404)
          .then(checkErrMsg(`No quiz with id ${copy.quiz_id} exists`))
      })

      it('should 404 if book is invalid', function () {
        const copy = _.cloneDeep(chasePassQuizSubBody);
        copy.book_id = shortid.generate();
        return agent
          .post(`/students/${chase._id}/quiz_submissions`)
          .set(SC.AuthHeaderField, chaseToken)
          .send(copy)
          .expect(404)
          .then(checkErrMsg(`No book with id ${copy.book_id} exists`))
      });

      it('should 400 if student has not logged to the end of the book', function () {
        const copy = _.cloneDeep(chasePassQuizSubBody);
        copy.book_id = 'hatchet-id';
        return agent
          .post(`/students/${chase._id}/quiz_submissions`)
          .set(SC.AuthHeaderField, chaseToken)
          .send(copy)
          .expect(400)
          .then(checkErrMsg(`Student ${Helpers.getFullName(chase)} has not logged to the end of ${_.find(initialBooks, { _id: copy.book_id }).title}`))
      })

      it('should 403 when students submits on behalf another student', function () {
        return agent
          .post(`/students/${chase._id}/quiz_submissions`)
          .set(SC.AuthHeaderField, katelynnToken)
          .send(chasePassQuizSubBody)
          .expect(403)
          .then(checkErrMsg(`User ${katelynn._id} cannot act as an agent for user ${chasePassQuizSubBody.student_id}`))
      })

      it('should 400 if user has already passed quiz', function () {
        return agent
          .post(`/students/${katelynn._id}/quiz_submissions`)
          .set(SC.AuthHeaderField, katelynnToken)
          .send(kkQuizSubForBookAlreadyPassed)
          .expect(400)
          .then(checkErrMsg(`User has already passed quiz for book ${kkQuizSubForBookAlreadyPassed.book_id}`))
      })

      it('should 400 if user has already failed three times', function () {
        return agent
          .post(`/students/${katelynn._id}/quiz_submissions`)
          .set(SC.AuthHeaderField, katelynnToken)
          .send(kkQuizSubForBookAlreadyFailed)
          .expect(400)
          .then(checkErrMsg(`User has exhausted all attempts to pass quiz for book ${kkQuizSubForBookAlreadyFailed.book_id}`))
      })

      it('should prevent user from attempting another quiz without waiting', function () {

        const latestSubmissionDate = moment().subtract(SC.MinHoursBetweenBookQuizAttempt, 'h').add(1, 'm').toISOString();

        const recentSubmission = Mockers.mockQuizSubmission({
          quiz_id: 'quiz-id-1',
          book_id: initialBooks[0]._id,
          book_title: initialBooks[0].title,
          student_id: katelynn._id,
          date_created: latestSubmissionDate,
          answers: _.times(5, () => ({ answer_index: 2 }))
        })

        return quizSubmissionCollection.insert(recentSubmission)
          .then(() => {

            return agent
              .post(`/students/${katelynn._id}/quiz_submissions`)
              .set(SC.AuthHeaderField, katelynnToken)
              .send(kkQuizSubForBookAlreadyFailed)
              .expect(400)
              .then(checkErrMsg(`User must wait to attempt another quiz.`))

          })

      })

      it('should 200 and return passed quiz', function () {
        return agent
          .post(`/students/${chase._id}/quiz_submissions`)
          .set(SC.AuthHeaderField, chaseToken)
          .send(chasePassQuizSubBody)
          .expect(200)
          .then(({ body }) => {
            delete body._id;
            delete body.date_created;
            assert.deepEqual(body, {
              ...chasePassQuizSubBody,
              passed: true,
              score: 100,
              book_title: initialBooks[0].title
            })
            return quizSubmissionCollection.find({})
          })
          .then(submissions => assert.lengthOf(submissions, initialQuizSubmissions.length + 1))
      })

      it('should 200 and return failed quiz', function () {
        return agent
          .post(`/students/${chase._id}/quiz_submissions`)
          .set(SC.AuthHeaderField, chaseToken)
          .send(chaseFailedQuizSubBody)
          .expect(200)
          .then(({ body }) => {
            delete body._id;
            delete body.date_created;
            assert.deepEqual(body, {
              ...chaseFailedQuizSubBody,
              passed: false,
              score: 60,
              book_title: initialBooks[0].title
            })
          })
      })

    })

    describe('#getQuizForBook', function () {

      it('should 401 when no auth token in header', function () {
        return agent
          .get(`/books/${bookWithQuiz._id}/quiz`)
          .expect(401);
      });

      it('should 404 when book does not exist', function () {
        const invalidId = shortid.generate();
        return agent
          .get(`/books/${invalidId}/quiz`)
          .set(SC.AuthHeaderField, chaseToken)
          .expect(404)
          .then(checkErrMsg(`Book ${invalidId} does not exist.`))
      });

      it('should 200 and return book specific quiz', function () {
        const bookSpecificQuiz = _.find(initialQuizzes, q => !_.isEmpty(q.book_id));
        assert.isDefined(bookSpecificQuiz);
        return agent
          .get(`/books/${bookSpecificQuiz.book_id}/quiz`)
          .set(SC.AuthHeaderField, chaseToken)
          .expect(200)
          .then(({ body }) => assert.deepEqual(body, bookSpecificQuiz))
      });

      it('should 200 and return generic book quiz', function () {
        return agent
          .get(`/books/${bookWithoutQuiz._id}/quiz`)
          .set(SC.AuthHeaderField, chaseToken)
          .expect(200)
          .then(({ body }) => {
            const genericQuizzes = _.filter(initialQuizzes, quiz => _.isUndefined(quiz.book_id));
            const genericIds = _.map(genericQuizzes, '_id');
            assert.isTrue(_.includes(genericIds, body._id));
          })
      });

    })

    describe('#getAllQuizzes', function () {

      it('should 401 when no auth token in header', function () {
        return agent
          .get('/quizzes')
          .expect(401);
      });

      it('should 403 if not admin', function () {
        return agent
          .get('/quizzes')
          .set(SC.AuthHeaderField, katelynnToken)
          .expect(403);
      });

      it('should return all books', function () {
        return agent
          .get('/quizzes')
          .set(SC.AuthHeaderField, austinToken)
          .expect(200)
          .then(({ body }) => assert.sameDeepMembers(body, initialQuizzes))
      })
    })

  })

  describe('Reading Log Routes', function () {

    const validReadingLog: Models.IReadingLogBody = {
      student_id: katelynn._id as string,
      book_id: _.find(initialBooks, { _id: 'blue-dolphins-id' })._id as string,
      start_page: 0,
      final_page: 100,
      duration_min: 100,
      summary: faker.lorem.sentence(4),
      read_with: Models.ReadingWith.ByMyself,
      is_last_log_for_book: false
    }

    describe('#createReadingLog', function () {

      it('should 401 when no auth token in header', function () {
        return agent
          .post(`/students/${katelynn._id}/reading_logs`)
          .expect(401);
      });

      it('should 400 when student id in url does not match student in body', function () {
        return agent
          .post(`/students/${chase._id}/reading_logs`)
          .set(SC.AuthHeaderField, austinToken)
          .send(validReadingLog)
          .expect(400);
      });

      it('should 403 if student posting for another student', function () {
        return agent
          .post(`/students/${chase._id}/reading_logs`)
          .set(SC.AuthHeaderField, katelynnToken)
          .send(validReadingLog)
          .expect(403);
      });

      it('should 400 if final_page is equal to end_page', function () {

        const invalid = {
          ...validReadingLog,
          start_page: 10,
          final_page: 10
        }

        return agent
          .post(`/students/${katelynn._id}/reading_logs`)
          .set(SC.AuthHeaderField, katelynnToken)
          .send(invalid)
          .expect(400)
          .then(checkErrMsg('Final page should be greater than start page'))

      });

      it('should 400 if final_page is less than to end_page', function () {

        const invalid = {
          ...validReadingLog,
          start_page: 10,
          final_page: 5
        }

        return agent
          .post(`/students/${katelynn._id}/reading_logs`)
          .set(SC.AuthHeaderField, katelynnToken)
          .send(invalid)
          .expect(400)
          .then(checkErrMsg('Final page should be greater than start page'))

      });

      it('should 400 if final_page is greater than number of pages in book', function () {

        const book = _.find(initialBooks, { _id: validReadingLog.book_id });

        const invalid = {
          ...validReadingLog,
          start_page: book.num_pages - 20,
          final_page: book.num_pages + 10
        }

        return agent
          .post(`/students/${katelynn._id}/reading_logs`)
          .set(SC.AuthHeaderField, katelynnToken)
          .send(invalid)
          .expect(400)
          .then(checkErrMsg(`Final page (${invalid.final_page}) exceeds number of pages in book (${book.num_pages})`))

      });

      it('should 400 if too many pages logged', function () {

        const invalid: Models.IReadingLogBody = {
          ...validReadingLog,
          start_page: 0,
          final_page: SC.ReadingLogMaxPagesPossibleInLog + 10
        }

        return agent
          .post(`/students/${katelynn._id}/reading_logs`)
          .set(SC.AuthHeaderField, katelynnToken)
          .send(invalid)
          .expect(400)
          .then(checkErrMsg(`The maximum number of pages you can log is ${SC.ReadingLogMaxPagesPossibleInLog}`))

      });

      it('should 400 if final_page is last page of book, but not last log set', function () {

        const book = _.find(initialBooks, { _id: validReadingLog.book_id });

        const invalid: Models.IReadingLogBody = {
          ...validReadingLog,
          start_page: book.num_pages - 20,
          final_page: book.num_pages,
          is_last_log_for_book: false
        }

        return agent
          .post(`/students/${katelynn._id}/reading_logs`)
          .set(SC.AuthHeaderField, katelynnToken)
          .send(invalid)
          .expect(400)
          .then(checkErrMsg('Final page cannot be last page, yet not the last log for the book'))

      });

      it('should 400 if duration_min too small', function () {

        const invalid: Models.IReadingLogBody = {
          ...validReadingLog,
          duration_min: SC.ReadingLogMinMinutes - 1
        }

        return agent
          .post(`/students/${katelynn._id}/reading_logs`)
          .set(SC.AuthHeaderField, katelynnToken)
          .send(invalid)
          .expect(400)
          .then(checkErrMsg(`Reading log duration must be between ${SC.ReadingLogMinMinutes} and ${SC.ReadingLogMaxMinutes} minutes`))

      });

      it('should 400 if duration_min too large', function () {

        const invalid: Models.IReadingLogBody = {
          ...validReadingLog,
          duration_min: SC.ReadingLogMaxMinutes + 1
        }

        return agent
          .post(`/students/${katelynn._id}/reading_logs`)
          .set(SC.AuthHeaderField, katelynnToken)
          .send(invalid)
          .expect(400)
          .then(checkErrMsg(`Reading log duration must be between ${SC.ReadingLogMinMinutes} and ${SC.ReadingLogMaxMinutes} minutes`))

      });

      it('should 400 if is last log, but final_page is not last page of book', function () {

        const book = _.find(initialBooks, { _id: validReadingLog.book_id });

        const invalid: Models.IReadingLogBody = {
          ...validReadingLog,
          start_page: book.num_pages - 20,
          final_page: book.num_pages - 10,
          is_last_log_for_book: true
        }

        return agent
          .post(`/students/${katelynn._id}/reading_logs`)
          .set(SC.AuthHeaderField, katelynnToken)
          .send(invalid)
          .expect(400)
          .then(checkErrMsg('Final page is not last page of book, yet this is a last log for the book'))

      });

      it('should 400 if first log and doesn\'t start at page 0', function () {

        const bookNotLogged = _.find(initialBooks, book => {
          const idsOfBooksLogged = _.map(initialReadingLogs, 'book_id');
          return !_.includes(idsOfBooksLogged, book._id)
        })

        const invalid = {
          ...validReadingLog,
          book_id: bookNotLogged._id,
          start_page: 1,
          final_page: 10
        }

        return agent
          .post(`/students/${katelynn._id}/reading_logs`)
          .set(SC.AuthHeaderField, katelynnToken)
          .send(invalid)
          .expect(400)
          .then(checkErrMsg(`First log for book ${bookNotLogged.title} must have start_page = 0`))

      })

      it('should 400 if trying to log a book already finished logging', function () {

        // katelynn has logged to the end of hatchet
        const book = _.find(initialBooks, { _id: 'hatchet-id' })

        const invalid = {
          ...validReadingLog,
          book_id: book._id,
          start_page: 1,
          final_page: 10
        }

        return agent
          .post(`/students/${katelynn._id}/reading_logs`)
          .set(SC.AuthHeaderField, katelynnToken)
          .send(invalid)
          .expect(400)
          .then(checkErrMsg(`You have already logged that you finished ${book.title}`))

      })

      it('should 400 if log does not start where last log ended', function () {

        // chase has started, but not finished logging Hatchet
        const unfinishedLog = _.find(initialReadingLogs, { _id: 'chase_unfinished_hatchet_2' })
        assert.isDefined(unfinishedLog);
        const book = _.find(initialBooks, { _id: 'hatchet-id' })

        const invalid: Models.IReadingLogBody = {
          is_last_log_for_book: false,
          summary: faker.lorem.sentence(4),
          read_with: Models.ReadingWith.WithParent,
          duration_min: 30,
          student_id: chase._id,
          book_id: book._id,
          start_page: unfinishedLog.final_page + 2,
          final_page: unfinishedLog.final_page + 10
        }

        return agent
          .post(`/students/${chase._id}/reading_logs`)
          .set(SC.AuthHeaderField, chaseToken)
          .send(invalid)
          .expect(400)
          .then(checkErrMsg(`Your last log for ${book.title} ended on ${unfinishedLog.final_page}. This next log must start on that page.`))

      })

    });

    describe('#deleteReadingLog', function () {

      const firstLogForHatchetChase = _.find(initialReadingLogs, { _id: 'chase_unfinished_hatchet_1' });
      const lastLogForHatchetChase = _.find(initialReadingLogs, { _id: 'chase_unfinished_hatchet_2' })

      it('should 401 when no auth token in header', function () {
        return agent
          .del(`/students/${chase._id}/reading_logs/${lastLogForHatchetChase._id}`)
          .expect(401);
      });

      it('should 404 if log does not exist', function () {
        return agent
          .del(`/students/${chase._id}/reading_logs/${shortid.generate()}`)
          .set(SC.AuthHeaderField, chaseToken)
          .expect(404)
      });

      it('should 400 if not last log for book', function () {
        return agent
          .del(`/students/${chase._id}/reading_logs/${firstLogForHatchetChase._id}`)
          .set(SC.AuthHeaderField, chaseToken)
          .expect(400)
          .then(checkErrMsg(`Log ${firstLogForHatchetChase._id} is not the most recent log for Book ${firstLogForHatchetChase.book_id}`))
      });

      it('should delete the log', function () {
        return agent
          .del(`/students/${chase._id}/reading_logs/${lastLogForHatchetChase._id}`)
          .set(SC.AuthHeaderField, chaseToken)
          .expect(200)
          .then(({ body }) => {
            assert.deepEqual(body, {
              deletedLog: lastLogForHatchetChase
            })
            return readingLogCollection.find({})
          })
          .then(allReadingLogs => assert.lengthOf(allReadingLogs, initialReadingLogs.length - 1))
      })

    })

    describe('#getLogsForStudent', function () {

      it('should require authentication', function () {
        return agent
          .get(`/students/${chase._id}/reading_logs`)
          .expect(401)
      })

      it('should 403 if not admin', function () {
        return agent
          .get(`/students/${chase._id}/reading_logs`)
          .set(SC.AuthHeaderField, chaseToken)
          .expect(403)
      })

      it('should 404 if student doesnt exist', function () {
        return agent
          .get(`/students/${shortid.generate()}/reading_logs`)
          .set(SC.AuthHeaderField, austinToken)
          .expect(404)
      })

      it('should return student logs', function () {
        return agent
          .get(`/students/${chase._id}/reading_logs`)
          .set(SC.AuthHeaderField, austinToken)
          .then(({ body }) => assert.sameDeepMembers(body, _.filter(initialReadingLogs, { student_id: chase._id })))
      })

    })

  });

  describe('User Routes', function () {

    const validAdminCreds: Models.IUserLoginCreds = {
      username: austin.username,
      password: 'password'
    }

    const validEducatorCreds: Models.IUserLoginCreds = {
      username: bonnie.username,
      password: 'password'
    }

    const validStudentCreds: Models.IUserLoginCreds = {
      username: katelynn.username,
      password: 'password'
    }

    const inactiveStudentCreds: Models.IUserLoginCreds = {
      username: inactiveStudent.username,
      password: 'password'
    }

    describe('#getStudentByUsername', function () {

      it('should require query', function () {
        return agent
          .get(`/students`)
          .expect(400)
          .then(checkErrMsg('Query param error for username'))
      })

      it('should return 400 if student is an educator', function () {
        return agent
          .get(`/students?username=${bonnie.username}`)
          .expect(400)
          .then(checkErrMsg(`User with username ${bonnie.username} is not a student.`))
      })

      it('should return 400 if student is an admin', function () {
        return agent
          .get(`/students?username=${austin.username}`)
          .expect(400)
          .then(checkErrMsg(`User with username ${austin.username} is not a student.`))
      })

      it('should return 404 if student does not exist', function () {
        return agent
          .get(`/students?username=blah`)
          .expect(404)
      })

      it('should return 200 and the student', function () {
        return agent
          .get(`/students?username=${chase.username}`)
          .expect(200)
          .then(({ body }) => assert.deepEqual(body, chase))
      })

    })

    describe('#studentSignin', function () {

      it('should 400 if no user exists with username', function () {
        const invalidUsername = 'invalid@gmail.com'
        return agent
          .post(`/students/signin`)
          .send({ username: invalidUsername, password: 'pass' })
          .expect(400)
          .then(checkErrMsg(`No user with username ${invalidUsername} exists.`))
      })

      it('should 400 if user is admin', function () {
        return agent
          .post(`/students/signin`)
          .send(validAdminCreds)
          .expect(400)
          .then(checkErrMsg('User must be a student.'))
      })

      it('should 400 if user is educator', function () {
        return agent
          .post(`/students/signin`)
          .send(validEducatorCreds)
          .expect(400)
          .then(checkErrMsg('User must be a student.'))
      })

      it('should 400 if student is not active', function () {
        return agent
          .post('/students/signin')
          .send(inactiveStudentCreds)
          .expect(400)
          .then(checkErrMsg('This student account is not yet activated.'))
      })

      it('should 400 if invalid username/password combo', function () {
        const invalidPass = 'invalid';
        const invalidCreds = {
          ...validStudentCreds,
          password: invalidPass
        }
        return agent
          .post(`/students/signin`)
          .send(invalidCreds)
          .expect(400)
          .then(checkErrMsg('Invalid username/password combination.'))
      })

      it('should 200 if credentials valid', function () {
        return agent
          .post(`/students/signin`)
          .expect(200)
          .send(validStudentCreds)
          .then(({ body }) => {
            const actualClaims = jwt.verify(body.auth_token, BEC.JWTSecret) as any
            assert.equal(actualClaims._id, katelynn._id);
            assert.equal(actualClaims.type, katelynn.type)
            assert.deepEqual(body.dto.info, katelynn)
          })
      })

    })

    describe('#educatorSignin', function () {

      it('should 400 if no user exists with username', function () {
        const invalidUsername = 'invalid-user'
        return agent
          .post(`/educators/signin`)
          .send({ username: invalidUsername, password: 'pass' })
          .expect(400)
          .then(checkErrMsg(`No user with username ${invalidUsername} exists.`))
      })

      it('should 400 if user is admin', function () {
        return agent
          .post(`/educators/signin`)
          .send(validAdminCreds)
          .expect(400)
          .then(checkErrMsg('User must be an educator.'))
      })

      it('should 400 if user is student', function () {
        return agent
          .post(`/educators/signin`)
          .send(validStudentCreds)
          .expect(400)
          .then(checkErrMsg('User must be an educator.'))
      })

      it('should 400 if invalid username/password combo', function () {
        const invalidPass = 'invalid';
        const invalidCreds = {
          ...validEducatorCreds,
          password: invalidPass
        }
        return agent
          .post(`/educators/signin`)
          .send(invalidCreds)
          .expect(400)
          .then(checkErrMsg('Invalid username/password combination.'))
      })

      it('should 200 if credentials valid', function () {
        return agent
          .post(`/educators/signin`)
          .expect(200)
          .send(validEducatorCreds)
          .then(({ body }: { body: Models.IAuthEducatorDTO }) => {
            const actualClaims = jwt.verify(body.auth_token, BEC.JWTSecret) as any
            assert.equal(actualClaims._id, bonnie._id);
            assert.equal(actualClaims.type, bonnie.type)
            assert.deepEqual(body.dto.educator, bonnie)
          })
      })

    })

    describe('#activatePendingStudent', function () {

      const validBody = {
        password: 'my-password'
      }

      it('should 404 if student does not exist', function () {
        return agent
          .post(`/students/${shortid.generate()}/activate`)
          .send(validBody)
          .expect(404);
      });

      it('should 400 if user is not a student (admin case)', function () {
        return agent
          .post(`/students/${austin._id}/activate`)
          .send(validBody)
          .expect(400)
          .then(checkErrMsg(`User ${austin._id} is not a student`))
      });

      it('should 400 if user is not a student (educator case)', function () {
        return agent
          .post(`/students/${bonnie._id}/activate`)
          .send(validBody)
          .expect(400)
          .then(checkErrMsg(`User ${bonnie._id} is not a student`))
      });

      it('should 400 if student is already activated', function () {
        return agent
          .post(`/students/${chase._id}/activate`)
          .send(validBody)
          .expect(400)
          .then(checkErrMsg(`Student ${chase._id} is already activated.`))
      });

      it('should 200 and update the status + hashed password', function () {
        const pendingStudent = _.find(initialUsers, { status: Models.StudentStatus.Pending }) as Models.IStudent;
        assert.isDefined(pendingStudent, 'Necessary for test.');
        return agent
          .post(`/students/${pendingStudent._id}/activate`)
          .send(validBody)
          .expect(200)
          .then(() => usersCollection.findOne({ _id: pendingStudent._id }))
          .then((activatedStudent: Models.IStudent) => {
            assert.equal(activatedStudent.status, Models.StudentStatus.Active);
            assert.isTrue(bcrypt.compareSync(validBody.password, activatedStudent.hashed_password));
          })
      });

    })

    describe('#createEducator', function () {

      const validReqBody: Models.IEducatorBody = {
        gender: Models.Gender.Female,
        first_name: 'Bonnie',
        last_name: 'Stewart',
        username: 'tjones',
        email: 'tjones@parktudor.org',
        password: 'taylors_password'
      }

      it('should 401 when no auth token in header', function () {
        return agent
          .post(`/educators`)
          .expect(401);
      });

      it('should 403 if non-admin making request', function () {
        return agent
          .post('/educators')
          .set(SC.AuthHeaderField, chaseToken)
          .expect(403);
      });

      it('should 200 and save the educator', function () {

        return agent
          .post('/educators')
          .set(SC.AuthHeaderField, austinToken)
          .send(validReqBody)
          .expect(200)
          .then(({ body }) => {

            assert.hasAllKeys(body, [
              '_id',
              'date_created',
              'username',
              'email',
              'gender',
              'first_name',
              'hashed_password',
              'last_name',
              'notification_settings',
              'student_ids',
              'type'
            ])

            // bcrypt will produce different hashes for the same
            // string. In other words, hash(validReqBody.password) !== body.hashed_password
            assert.isTrue(bcrypt.compareSync(validReqBody.password, body.hashed_password));

            delete body._id;
            delete body.date_created;
            delete body.hashed_password;
            delete validReqBody.password;

            const expected = _.assign({}, validReqBody, {
              type: Models.UserType.Educator,
              student_ids: [],
              notification_settings: {
                reading_logs: true,
                quiz_submissions: true,
                prizes_ordered: true
              }
            });

            assert.deepEqual(expected, body);
            return usersCollection.find({});

          })
          .then(allUsers => assert.lengthOf(allUsers, initialUsers.length + 1))
      });

    });

    describe('#updateEducatorNotificationSettings', function () {

      const validNoteSettings: Models.IEducatorNoteSettings = {
        reading_logs: true,
        quiz_submissions: false,
        prizes_ordered: true
      }

      it('should 401 when no auth token in header', function () {
        return agent
          .put(`/educators/${bonnie._id}/notification_settings`)
          .expect(401);
      });

      it('should 403 if not a teacher', function () {
        return agent
          .put(`/educators/${chase._id}/notification_settings`)
          .set(SC.AuthHeaderField, bonnieToken)
          .send(validNoteSettings)
          .expect(403);
      });

      it('should 400 if invalid body', function () {
        let invalidSettings = _.cloneDeep(validNoteSettings);
        delete invalidSettings.prizes_ordered;
        return agent
          .put(`/educators/${bonnie._id}/notification_settings`)
          .set(SC.AuthHeaderField, bonnieToken)
          .send(invalidSettings)
          .expect(400);
      });

      it('should 200 and update the settings', function () {

        return agent
          .put(`/educators/${bonnie._id}/notification_settings`)
          .set(SC.AuthHeaderField, bonnieToken)
          .send(validNoteSettings)
          .expect(200)
          .then(() => mongoUserData.getUserById(bonnie._id))
          .then((educator: Models.IEducator) => assert.deepEqual(educator.notification_settings, validNoteSettings))
      });

    })

    describe('#updateStudentsParentsEmails', function () {

      it('should 401 when no auth token in header', function () {
        return agent
          .put(`/students/${katelynn._id}/parent_emails`)
          .expect(401);
      });

      it('should 403 if non-admin making request', function () {
        return agent
          .put(`/students/${katelynn._id}/parent_emails`)
          .set(SC.AuthHeaderField, chaseToken)
          .expect(403);
      });

      it('should 400 if too many emails provided', function () {
        return agent
          .put(`/students/${katelynn._id}/parent_emails`)
          .set(SC.AuthHeaderField, katelynnToken)
          .send({
            parent_emails: _.times(SC.MaxParentEmailsPerStudent + 1, () => faker.internet.email())
          })
          .expect(400)
          .then(checkErrMsg('Invalid/missing field parent_emails'))
      });

      it('should 400 if duplicate emails provided', function () {
        return agent
          .put(`/students/${katelynn._id}/parent_emails`)
          .set(SC.AuthHeaderField, katelynnToken)
          .send({
            parent_emails: ["austin@gmail.com", "austin@gmail.com"]
          })
          .expect(400)
          .then(checkErrMsg('Invalid/missing field parent_emails'));
      });

      it('should 200 and save emails', function () {
        const updatedEmails = ["sam@gmail.com", "sarah@gmail.com"];
        return agent
          .put(`/students/${katelynn._id}/parent_emails`)
          .set(SC.AuthHeaderField, katelynnToken)
          .send({
            parent_emails: updatedEmails
          })
          .expect(200)
          .then(() => mongoUserData.getUserById(katelynn._id))
          .then((updatedStudent: Models.IStudent) => {
            assert.sameMembers(updatedStudent.parent_emails, updatedEmails);
          })
      });

    })

    describe('#createPendingStudent', function () {

      const validReqBody: Models.IPendingStudentBody = {
        first_name: 'Taylor',
        last_name: 'Jones',
        gender: Models.Gender.Male,
        initial_lexile_measure: 600,
        username: 'tjones',
        parent_emails: []
      }

      it('should 401 when no auth token in header', function () {
        return agent
          .post(`/classes/${bonnieClass._id}/students`)
          .expect(401);
      });

      it('should 403 if requester does not teach the class', function () {
        return agent
          .post(`/classes/${bonnieClass._id}/students`)
          .set(SC.AuthHeaderField, mikePhillipsToken)
          .send(validReqBody)
          .expect(403)
          .then(checkErrMsg(`Educator ${mikePhillips._id} does not teach class ${bonnieClass._id}`))
      });

      it('should 404 if class does not exist', function () {
        return agent
          .post(`/classes/invalid-id/students`)
          .set(SC.AuthHeaderField, austinToken)
          .send(validReqBody)
          .expect(404)
      });

      it('should 400 if user already exists with that username', function () {
        const invalidReqBody = {
          ...validReqBody,
          username: chase.username
        }
        return agent
          .post(`/classes/${bonnieClass._id}/students`)
          .set(SC.AuthHeaderField, bonnieToken)
          .send(invalidReqBody)
          .expect(400)
          .then(checkErrMsg(`User with username ${invalidReqBody.username} already exists.`));
      });

      it('should 200 and create a pending student', function () {

        let createdStudentId: string;

        return agent
          .post(`/classes/${bonnieClass._id}/students`)
          .set(SC.AuthHeaderField, bonnieToken)
          .send(validReqBody)
          .expect(200)
          .then(({ body }) => {

            assert.hasAllKeys(body, [
              'updatedClass',
              'createdStudent'
            ]);

            return usersCollection.findOne({ _id: body.createdStudent._id })

          })
          .then((createdStudent: Models.IStudent) => {

            assert.hasAllKeys(createdStudent, [
              '_id',
              'date_created',
              'username',
              'date_activated',
              'first_name',
              'last_name',
              'gender',
              'genre_interests',
              'initial_lexile_measure',
              'bookmarked_books',
              'type',
              'status',
              'parent_emails'
            ])

            assert.equal(createdStudent.type, Models.UserType.Student);
            assert.isEmpty(createdStudent.bookmarked_books);
            assert.isNull(createdStudent.genre_interests);
            assert.isNull(createdStudent.date_activated);
            assert.equal(createdStudent.status, Models.StudentStatus.Pending);

            createdStudentId = createdStudent._id;

            delete createdStudent.bookmarked_books;
            delete createdStudent.type;
            delete createdStudent.status;
            delete createdStudent._id;
            delete createdStudent.date_created;
            delete createdStudent.date_activated;
            delete createdStudent.genre_interests;

            assert.deepEqual(createdStudent, validReqBody);
            return classCollection.findOne({ _id: bonnieClass._id })
          })
          .then((updatedClass: Models.IClass) => {
            assert.lengthOf(updatedClass.student_ids, bonnieClass.student_ids.length + 1);
            assert.sameDeepMembers(updatedClass.student_ids, [
              ...bonnieClass.student_ids,
              createdStudentId
            ])
          })
      })

    })

    describe('#deletePendingStudent', function () {

      const pendingStudent = _.find(initialUsers, { status: Models.StudentStatus.Pending }) as Models.IStudent;
      assert.isDefined(pendingStudent);

      it('should 401 if not authenticated', function () {
        return agent
          .del(`/classes/${bonnieClass._id}/students/${pendingStudent._id}`)
          .expect(401);
      });

      it('should 404 if class does not exist', function () {
        return agent
          .del(`/classes/invalid-class/students/${pendingStudent._id}`)
          .set(SC.AuthHeaderField, bonnieToken)
          .expect(404);
      });

      it('should 403 if requester does not teach the class', function () {
        return agent
          .del(`/classes/${bonnieClass._id}/students/${pendingStudent._id}`)
          .set(SC.AuthHeaderField, mikePhillipsToken)
          .expect(403)
          .then(checkErrMsg(`Educator ${mikePhillips._id} does not teach class ${bonnieClass._id}`))
      });

      it('should 400 if student not in teacher\'s class', function () {
        return agent
          .del(`/classes/${bonnieClass._id}/students/${katelynn._id}`)
          .set(SC.AuthHeaderField, bonnieToken)
          .expect(400)
          .then(checkErrMsg(`Student ${katelynn._id} is not in class ${bonnieClass._id}`))
      });

      it('should 400 if student is already activated', function () {
        return agent
          .del(`/classes/${bonnieClass._id}/students/${chase._id}`)
          .set(SC.AuthHeaderField, bonnieToken)
          .expect(400)
          .then(checkErrMsg(`Student ${chase._id} cannot be deleted as they are already active`))
      });

      it('should 200 and delete the student', function () {
        return agent
          .del(`/classes/${bonnieClass._id}/students/${pendingStudent._id}`)
          .set(SC.AuthHeaderField, bonnieToken)
          .expect(200)
          .then(() => usersCollection.findOne({ _id: pendingStudent._id }))
          .then(prevExistingStudent => {
            assert.isNull(prevExistingStudent);
            return classCollection.findOne({ _id: bonnieClass._id })
          })
          .then((updatedClass: Models.IClass) => {
            assert.sameDeepMembers(updatedClass.student_ids, _.without(bonnieClass.student_ids, pendingStudent._id))
          })
      });

    })


    describe('#createGenreInterests', function () {

      const genreIds = _.map(initialGenres, '_id');

      let validGenreMap: Models.GenreInterestMap = {};
      _.each(genreIds, id => validGenreMap[id] = _.random(1, 4) as 1 | 2 | 3 | 4)

      it('should 401 when no auth token in header', function () {
        return agent
          .post(`/students/${chase._id}/genre_interests`)
          .expect(401);
      });

      it('should 403 if student making request on behalf another student', function () {
        return agent
          .post(`/students/${chase._id}/genre_interests`)
          .set(SC.AuthHeaderField, katelynnToken)
          .expect(403)
          .then(checkErrMsg(`User ${katelynn._id} cannot act as an agent for user ${chase._id}`))
      });

      it('should 400 if some genre ids are missing', function () {

        const copy = _.cloneDeep(validGenreMap);
        delete copy[initialGenres[0]._id];

        return agent
          .post(`/students/${chase._id}/genre_interests`)
          .set(SC.AuthHeaderField, chaseToken)
          .send(copy)
          .expect(400)
          .then(checkErrMsg('There is a discrepancy between existing genres and genres user provided interest levels for.'))

      });

      it('should 400 if values are not between 1 and 4', function () {

        const copy: any = _.cloneDeep(validGenreMap);
        copy[initialGenres[0]._id] = 5;

        return agent
          .post(`/students/${chase._id}/genre_interests`)
          .set(SC.AuthHeaderField, chaseToken)
          .send(copy)
          .expect(400)

      });

      it('should 400 if same number of genre keys, but one is invalid', function () {

        const copy: any = _.cloneDeep(validGenreMap);
        const invalidGenreId = shortid.generate();
        copy[invalidGenreId] = 4;
        delete copy[initialGenres[0]._id];

        return agent
          .post(`/students/${chase._id}/genre_interests`)
          .set(SC.AuthHeaderField, chaseToken)
          .send(copy)
          .expect(400)
          .then(checkErrMsg(`There is a discrepancy between existing genres and genres user provided interest levels for.`))

      });

      it('should 404 if user does not exist', function () {

        const invalidId = shortid.generate();

        return agent
          .post(`/students/${invalidId}/genre_interests`)
          .set(SC.AuthHeaderField, austinToken)
          .send(validGenreMap)
          .expect(404)
          .then(checkErrMsg(`User ${invalidId} does not exist.`))

      });

      it('should 400 if user is not Student', function () {

        return agent
          .post(`/students/${austin._id}/genre_interests`)
          .set(SC.AuthHeaderField, austinToken)
          .send(validGenreMap)
          .expect(400)
          .then(checkErrMsg(`User ${austin._id} is not a student`))

      });

      it('should 403 if user has already posted genre interests', function () {

        return agent
          .post(`/students/${katelynn._id}/genre_interests`)
          .set(SC.AuthHeaderField, katelynnToken)
          .send(validGenreMap)
          .expect(400)
          .then(checkErrMsg(`${Helpers.getFullName(katelynn)} already has created genre interests`))

      });

      it('should 200 and save genre interests', function () {

        return agent
          .post(`/students/${chase._id}/genre_interests`)
          .set(SC.AuthHeaderField, chaseToken)
          .send(validGenreMap)
          .expect(200)
          .then(({ body }) => usersCollection.findOne({ _id: chase._id }))
          .then(user => {
            const expected = _.assign({}, chase, {
              genre_interests: validGenreMap
            })
            assert.deepEqual(expected, user);
          })

      });

    });

    describe('#editGenreInterest', function () {

      const genreId = initialGenres[0]._id;

      const validBody = {
        interest_value: _.random(1, 4)
      }

      it('should 401 when no auth token in header', function () {
        return agent
          .put(`/students/${katelynn._id}/genre_interests/${genreId}`)
          .expect(401);
      });

      it('should 403 if student making request on behalf another student', function () {
        return agent
          .put(`/students/${chase._id}/genre_interests/${genreId}`)
          .set(SC.AuthHeaderField, katelynnToken)
          .expect(403)
          .then(checkErrMsg(`User ${katelynn._id} cannot act as an agent for user ${chase._id}`))
      });

      it('should 400 if interest value is invalid', function () {
        const copy = _.cloneDeep(validBody);
        copy.interest_value = 5;
        return agent
          .put(`/students/${katelynn._id}/genre_interests/${genreId}`)
          .set(SC.AuthHeaderField, katelynnToken)
          .send(copy)
          .expect(400);
      });

      it('should 403 if student has not created genre interests', function () {
        return agent
          .put(`/students/${chase._id}/genre_interests/${genreId}`)
          .set(SC.AuthHeaderField, chaseToken)
          .send(validBody)
          .expect(403)
          .then(checkErrMsg('Student cannot edit genre interests, until they have been created.'))
      });

      it('should 404 if genre id is invalid', function () {
        const invalidGenreId = shortid.generate();
        return agent
          .put(`/students/${katelynn._id}/genre_interests/${invalidGenreId}`)
          .set(SC.AuthHeaderField, katelynnToken)
          .send(validBody)
          .expect(404)
          .then(checkErrMsg(`Genre ${invalidGenreId} does not exist.`))
      });

      it('should 200 and update the genre interest', function () {
        return agent
          .put(`/students/${katelynn._id}/genre_interests/${genreId}`)
          .set(SC.AuthHeaderField, katelynnToken)
          .send(validBody)
          .expect(200)
          .then(() => usersCollection.findOne({ _id: katelynn._id }))
          .then(user => {
            const expectedGenreInterests = _.assign({}, katelynn.genre_interests, {
              [genreId]: validBody.interest_value
            })
            assert.deepEqual(user.genre_interests, expectedGenreInterests);
          })
      });

    });

    describe('#bookmarkBook', function () {

      // chase has not bookmarked this book
      const validBody = {
        bookId: 'baseball-id'
      }

      it('should 401 if not authenticated', function () {
        return agent
          .post(`/students/${chase._id}/bookmarked_books`)
          .expect(401);
      });

      it('should 403 if student on behalf another student', function () {
        return agent
          .post(`/students/${chase._id}/bookmarked_books`)
          .set(SC.AuthHeaderField, katelynnToken)
          .send(validBody)
          .expect(403)
      });

      it('should 404 if the user does not exist', function () {
        const invalidUserId = shortid.generate();
        return agent
          .post(`/students/${invalidUserId}/bookmarked_books`)
          .send(validBody)
          .set(SC.AuthHeaderField, austinToken)
          .expect(404)
          .then(checkErrMsg(`User ${invalidUserId} does not exist.`))
      });

      it('should 400 if the user is not a student', function () {
        return agent
          .post(`/students/${bonnie._id}/bookmarked_books`)
          .set(SC.AuthHeaderField, austinToken)
          .send(validBody)
          .expect(400)
          .then(checkErrMsg(`User ${bonnie._id} is not a student`))
      });

      it('should 404 if the book does not exist', function () {
        const invalidBookId = shortid.generate()
        return agent
          .post(`/students/${chase._id}/bookmarked_books`)
          .set(SC.AuthHeaderField, chaseToken)
          .send({ bookId: invalidBookId })
          .expect(404)
          .then(checkErrMsg(`Book ${invalidBookId} does not exist.`))
      });

      it('should 400 if the book is already bookmarked', function () {
        const idOfBookAlreadyBookmarked = chase.bookmarked_books[0];
        return agent
          .post(`/students/${chase._id}/bookmarked_books`)
          .set(SC.AuthHeaderField, chaseToken)
          .send({ bookId: idOfBookAlreadyBookmarked })
          .expect(400)
          .then(checkErrMsg(`${Helpers.getFullName(chase)} already bookmarked book ${idOfBookAlreadyBookmarked}.`))
      });

      it('should 200 and bookmark the book', function () {
        return agent
          .post(`/students/${chase._id}/bookmarked_books`)
          .set(SC.AuthHeaderField, chaseToken)
          .send(validBody)
          .expect(200)
          .then(() => usersCollection.findOne({ _id: chase._id }))
          .then((updatedChase: Models.IStudent) => assert.sameDeepOrderedMembers(
            updatedChase.bookmarked_books,
            [
              validBody.bookId,
              ...chase.bookmarked_books
            ]
          ))
      });

    })

    describe('#unbookmarkBook', function () {

      const cmBookmarkedBookId = chase.bookmarked_books[0];

      it('should 401 if not authenticated', function () {
        return agent
          .del(`/students/${chase._id}/bookmarked_books/${cmBookmarkedBookId}`)
          .expect(401);
      });

      it('should 403 if unbookmark on behalf another student', function () {
        return agent
          .del(`/students/${chase._id}/bookmarked_books/${cmBookmarkedBookId}`)
          .set(SC.AuthHeaderField, katelynnToken)
          .expect(403);
      });

      it('should 404 if the user does not exist', function () {
        const invalidUserId = shortid.generate();
        return agent
          .del(`/students/${invalidUserId}/bookmarked_books/${cmBookmarkedBookId}`)
          .set(SC.AuthHeaderField, austinToken)
          .expect(404)
          .then(checkErrMsg(`User ${invalidUserId} does not exist.`))
      });

      it('should 400 if the user is not a student', function () {
        return agent
          .del(`/students/${bonnie._id}/bookmarked_books/${cmBookmarkedBookId}`)
          .set(SC.AuthHeaderField, austinToken)
          .expect(400)
          .then(checkErrMsg(`User ${bonnie._id} is not a student`))
      });

      it('should 404 if the book does not exist', function () {
        const invalidBookId = shortid.generate()
        return agent
          .del(`/students/${chase._id}/bookmarked_books/${invalidBookId}`)
          .set(SC.AuthHeaderField, chaseToken)
          .expect(404)
          .then(checkErrMsg(`Book ${invalidBookId} does not exist.`))
      });

      it('should 400 if the book was not book marked', function () {
        const idOfBookChaseDidNotBookmark = _.difference(_.map(initialBooks, '_id'), chase.bookmarked_books)[0] as string;
        return agent
          .del(`/students/${chase._id}/bookmarked_books/${idOfBookChaseDidNotBookmark}`)
          .set(SC.AuthHeaderField, chaseToken)
          .expect(400)
          .then(checkErrMsg(`${Helpers.getFullName(chase)} never bookmarked book ${idOfBookChaseDidNotBookmark}.`))
      });

      it('should 400 if there is a non-collected book request for the book', function () {
        const uncollectedBookRequest = _.find(initialBookRequests, {
          student_id: chase._id,
          status: Models.BookRequestStatus.Requested
        })
        assert.isDefined(uncollectedBookRequest, 'Needed for test')
        return agent
          .del(`/students/${chase._id}/bookmarked_books/${uncollectedBookRequest.book_id}`)
          .set(SC.AuthHeaderField, chaseToken)
          .expect(400)
          .then(checkErrMsg(`A request (${uncollectedBookRequest._id}) exists with status ${uncollectedBookRequest.status}. You cannot unbookmark this book.`))
      });

      it('should 200 and unbookmark the book', function () {
        return agent
          .del(`/students/${chase._id}/bookmarked_books/${cmBookmarkedBookId}`)
          .set(SC.AuthHeaderField, chaseToken)
          .expect(200)
          .then(() => usersCollection.findOne({ _id: chase._id }))
          .then((updatedChase: Models.IStudent) => assert.sameDeepOrderedMembers(
            updatedChase.bookmarked_books,
            _.without(chase.bookmarked_books, cmBookmarkedBookId)
          ))
      });
    })

    describe('#createBookRequest', function () {

      const validJBRequest = {
        bookId: 'hatchet-id'
      }

      it('should 401 if not authenticated', function () {
        return agent
          .post(`/students/${jb._id}/book_requests`)
          .expect(401);
      });

      it('should 404 if the book does not exist', function () {
        const invalidBookId = shortid.generate();
        return agent
          .post(`/students/${jb._id}/book_requests`)
          .set(SC.AuthHeaderField, jbToken)
          .send({ bookId: invalidBookId })
          .expect(404)
          .then(checkErrMsg(`Book ${invalidBookId} does not exist.`))
      });

      it('should 404 if student does not exist', function () {
        const invalidUserId = shortid.generate();
        return agent
          .post(`/students/${invalidUserId}/book_requests`)
          .set(SC.AuthHeaderField, austinToken)
          .send(validJBRequest)
          .expect(404)
          .then(checkErrMsg(`User ${invalidUserId} does not exist.`))
      });

      it('should 400 if user is not a student', function () {
        return agent
          .post(`/students/${bonnie._id}/book_requests`)
          .set(SC.AuthHeaderField, austinToken)
          .send(validJBRequest)
          .expect(400)
          .then(checkErrMsg(`User ${bonnie._id} is not a student`))
      });

      it('should 403 if student requesting book on behalf another student', function () {
        return agent
          .post(`/students/${jb._id}/book_requests`)
          .set(SC.AuthHeaderField, chaseToken)
          .send(validJBRequest)
          .expect(403)
      });

      it('should 400 if user has an outstanding request', function () {
        const chaseRequest = _.find(initialBookRequests, { student_id: chase._id })
        assert.isDefined(chaseRequest);
        return agent
          .post(`/students/${chase._id}/book_requests`)
          .set(SC.AuthHeaderField, chaseToken)
          .send({ bookId: chaseRequest.book_id })
          .expect(400)
          .then(checkErrMsg(`A request (${chaseRequest._id}) exists. Cannot create a new book request.`))

      })

      it('should 200 and create the book request', function () {
        return agent
          .post(`/students/${jb._id}/book_requests`)
          .set(SC.AuthHeaderField, jbToken)
          .send(validJBRequest)
          .expect(200)
          .then(({ body }) => {
            assert.hasAllKeys(body, [
              '_id',
              'student_id',
              'book_id',
              'status',
              'date_requested'
            ])
            assert.equal(body.status, Models.BookRequestStatus.Requested);
            return bookRequestCollection.findOne({ _id: body._id })
          })
          .then(assert.isNotNull)
      });

    });

    describe('#deleteBookRequest', function () {

      const cmRequestedRequest = _.find(initialBookRequests, { student_id: chase._id });
      const kkOrderedRequest = _.find(initialBookRequests, { student_id: katelynn._id });
      assert.isDefined(cmRequestedRequest, 'Needed for test');
      assert.isDefined(kkOrderedRequest, 'Needed for test');

      it('should 401 if not authenticated', function () {
        return agent
          .del(`/students/${katelynn._id}/book_requests/${kkOrderedRequest._id}`)
          .expect(401);
      });

      it('should 404 if the request does not exist', function () {
        const invalidReqId = shortid.generate();
        return agent
          .del(`/students/${katelynn._id}/book_requests/${invalidReqId}`)
          .set(SC.AuthHeaderField, katelynnToken)
          .expect(404)
          .then(checkErrMsg(`Request ${invalidReqId} does not exist.`))
      });

      it('should 404 if student does not exist', function () {
        const invalidUserId = shortid.generate();
        return agent
          .del(`/students/${invalidUserId}/book_requests/${kkOrderedRequest._id}`)
          .set(SC.AuthHeaderField, austinToken)
          .expect(404)
          .then(checkErrMsg(`User ${invalidUserId} does not exist.`))
      });

      it('should 400 if user is not a student', function () {
        return agent
          .del(`/students/${bonnie._id}/book_requests/${kkOrderedRequest._id}`)
          .set(SC.AuthHeaderField, austinToken)
          .expect(400)
          .then(checkErrMsg(`User ${bonnie._id} is not a student`))
      });

      it('should 403 if student deleting requesting book on behalf another student', function () {
        return agent
          .del(`/students/${katelynn._id}/book_requests/${kkOrderedRequest._id}`)
          .set(SC.AuthHeaderField, chaseToken)
          .expect(403)
      });

      it('should 400 if student deleting requesting that isn\'t theres', function () {
        return agent
          .del(`/students/${katelynn._id}/book_requests/${cmRequestedRequest._id}`)
          .set(SC.AuthHeaderField, katelynnToken)
          .expect(400)
          .then(checkErrMsg('student_id in request does not match :studentId param'))
      });

      it('should 400 if request is active (non Requested status)', function () {
        return agent
          .del(`/students/${katelynn._id}/book_requests/${kkOrderedRequest._id}`)
          .set(SC.AuthHeaderField, katelynnToken)
          .expect(400)
          .then(checkErrMsg(`Non-Admins can only delete requests with status = Requested.`))
      })

      it('should 200 and create the book request', function () {
        return agent
          .del(`/students/${chase._id}/book_requests/${cmRequestedRequest._id}`)
          .set(SC.AuthHeaderField, chaseToken)
          .expect(200)
          .then(() => bookRequestCollection.findOne({ _id: cmRequestedRequest._id }))
          .then(assert.isNull)
      });

    })

    describe('#updateBookRequestStatus', function () {

      const request = _.sample(initialBookRequests);
      assert.isDefined(request, 'Needed for test');

      it('should 401 if not authenticated', function () {
        return agent
          .put(`/requests/${request._id}/status`)
          .expect(401);
      });

      it('should 403 if not admin', function () {
        return agent
          .put(`/requests/${request._id}/status`)
          .set(SC.AuthHeaderField, katelynnToken)
          .expect(403);
      });

      it('should 404 if the request does not exist', function () {
        const invalidReqId = shortid.generate();
        return agent
          .put(`/requests/${invalidReqId}/status`)
          .set(SC.AuthHeaderField, austinToken)
          .send({ updated_status: Models.BookRequestStatus.Collected })
          .expect(404)
          .then(checkErrMsg(`Request ${invalidReqId} does not exist`))
      });

      it('should 400 if status is invalid', function () {
        return agent
          .put(`/requests/${request._id}/status`)
          .set(SC.AuthHeaderField, austinToken)
          .send({ updated_status: 'blah' })
          .expect(400)
      })

      it('should 200 and update the status of the book request', function () {
        return agent
          .put(`/requests/${request._id}/status`)
          .set(SC.AuthHeaderField, austinToken)
          .send({ updated_status: Models.BookRequestStatus.Collected })
          .expect(200)
          .then(() => bookRequestCollection.findOne({ _id: request._id }))
          .then(updatedReq => assert.deepEqual(updatedReq, {
            ...request,
            status: Models.BookRequestStatus.Collected
          }))
      });

    });

    describe('#whoami', function () {

      it('should 401 if not authenticated', function () {
        return agent
          .get('/whoami')
          .expect(401);
      });

      it('should 400 if valid token not corresponding to user', function() {
        const idOfOldUser = shortid.generate();
        return agent
          .get('/whoami')
          .set(SC.AuthHeaderField, genAuthToken(Models.UserType.Student, idOfOldUser))
          .expect(404)
          .then(checkErrMsg(`Valid token, but user ${idOfOldUser} no longer exists.`))
      })

      it('should return the admin', function () {
        return agent
          .get('/whoami')
          .set(SC.AuthHeaderField, austinToken)
          .expect(200)
          .then(({ body }) => assert.deepEqual(body, austin))
      });

      it('should return the studentDTO', function () {
        return agent
          .get('/whoami')
          .set(SC.AuthHeaderField, katelynnToken)
          .expect(200)
          .then(({ body }) => {
            assert.hasAllKeys(body, [
              "book_requests",
              "book_reviews",
              "bookmarked_books",
              "current_lexile_measure",
              "info",
              "passed_quiz_books",
              "prize_orders",
              "prizes_ordered",
              "quiz_submissions",
              "reading_logs",
              "class"
            ])
            assert.deepEqual(body.info, katelynn);
            assert.sameDeepMembers(body.reading_logs, _.filter(initialReadingLogs, { student_id: katelynn._id }));
            assert.sameDeepMembers(body.book_requests, _.filter(initialBookRequests, { student_id: katelynn._id }));
            assert.sameDeepMembers(body.prize_orders, _.filter(initialPrizeOrders, { student_id: katelynn._id }));
            assert.sameDeepMembers(body.quiz_submissions, _.filter(initialQuizSubmissions, { student_id: katelynn._id }));
            assert.isNumber(body.current_lexile_measure);
          })
      })

      it('should return the educator dto', function() {
        return agent
          .get('/whoami')
          .set(SC.AuthHeaderField, bonnieToken)
          .expect(200)
          .then(({ body }) => {
            assert.hasAllKeys(body, [
              "educator",
              "student_progress",
              "students"
            ])
            assert.deepEqual(body.educator, bonnie);
            assert.sameDeepMembers(body.students, [
              chase,
              _.find(initialUsers, { _id: 'sam-smith' })
            ])
          })
      })

    });

    describe('#getStudent', function() {

      it('should 401 if not authenticated', function() {
        return agent
          .get(`/students/${chase._id}`)
          .expect(401)
      });

      it('should 403 if student makes request', function() {
        return agent
          .get(`/students/${chase._id}`)
          .set(SC.AuthHeaderField, chaseToken)
          .expect(403)
      });

      it('should 404 if user does not exist', function() {
        return agent
          .get(`/students/${shortid.generate()}`)
          .set(SC.AuthHeaderField, austinToken)
          .expect(404)
      });

      it('should 404 if user is not a student', function() {
        return agent
          .get(`/students/${bonnie._id}`)
          .set(SC.AuthHeaderField, austinToken)
          .expect(400)
          .then(checkErrMsg(`User ${bonnie._id} is not a student`))
      });

      it('should 403 if student is not in teachers class', function() {
        return agent
          .get(`/students/${katelynn._id}`)
          .set(SC.AuthHeaderField, bonnieToken)
          .expect(403)
          .then(checkErrMsg(`Teacher ${bonnie._id} does not have access to student ${katelynn._id}`))
      });

      it('should 200 and return the student if admin makes call', function() {
        return agent
          .get(`/students/${chase._id}`)
          .set(SC.AuthHeaderField, austinToken)
          .expect(200)
      });

      it('should 200 and return the student if teacher of student makes call', function() {
        return agent
          .get(`/students/${chase._id}`)
          .set(SC.AuthHeaderField, bonnieToken)
          .expect(200)
          .then(({ body }) => assert.deepEqual(body.info, chase))
      });

    });

    describe('#getBooksForStudent', function() {

      it('should 401 if not authenticated', function() {
        return agent
          .get(`/students/${chase._id}/books`)
          .expect(401)
      });

      it('should 400 if genre interests null', function() {
        return agent
          .get(`/students/${jb._id}/books`)
          .set(SC.AuthHeaderField, jbToken)
          .expect(400)
          .then(checkErrMsg(`Student ${jb._id} has not provided genre interests`))
      });

      it('should 404 if student does not exist', function() {
        return agent
          .get(`/students/${shortid.generate()}/books`)
          .set(SC.AuthHeaderField, austinToken)
          .expect(404)
      });

      it('should 400 if user not a student', function() {
        return agent
          .get(`/students/${bonnie._id}/books`)
          .set(SC.AuthHeaderField, austinToken)
          .expect(400)
          .then(checkErrMsg(`User ${bonnie._id} is not a student`))
      });

      it('should 200 and return the book recommendations', function() {
        return agent
          .get(`/students/${katelynn._id}/books`)
          .set(SC.AuthHeaderField, katelynnToken)
          .expect(200)
          .then(({ body }) => {
            assert.hasAllKeys(body, [
              'match_scores',
              'books'
            ])
            assert.sameDeepMembers(body.books, initialBooks);
            assert.hasAllKeys(body.match_scores, _.map(initialBooks, '_id'))
          });
      });

    });

  });

  after(async function () {
    await Promise.all([
      bookCollection.drop(),
      genreCollection.drop(),
      quizCollection.drop(),
      quizSubmissionCollection.drop(),
      usersCollection.drop(),
      bookReviewCollection.drop(),
      prizeCollection.drop(),
      prizeOrderCollection.drop(),
      authorCollection.drop(),
      bookRequestCollection.drop()
    ]);
    db.close();
  })

})