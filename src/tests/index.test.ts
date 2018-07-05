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
import { Models, Mockers, Constants as SC } from 'reading_rewards';
import { assert } from 'chai';

import * as Constants from '../constants';
import { MongoUserData } from '../data/users';
import { MongoBookData } from '../data/books';
import { MongoQuizData } from '../data/quizzes';
import { MongoBookReviewData } from '../data/book_reviews';
import { MongoGenreData } from '../data/genres';
import App from '..';
import { MongoPrizeData } from '../data/prizes';
import { MongoPrizeOrderData } from '../data/prize_orders';


// Load all the data

const initialBooks: Models.IBook[] = JSON.parse(fs.readFileSync(Path.join(__dirname, '../../test_data/books.json'), 'utf8'));
const initialGenres: Models.IGenre[] = JSON.parse(fs.readFileSync(Path.join(__dirname, '../../test_data/genres.json'), 'utf8'));
const initialQuizzes: Models.IQuiz[] = JSON.parse(fs.readFileSync(Path.join(__dirname, '../../test_data/quizzes.json'), 'utf8'));
const initialUsers: Models.IUser[] = JSON.parse(fs.readFileSync(Path.join(__dirname, '../../test_data/users.json'), 'utf8'));
const initialQuizSubmissions = JSON.parse(fs.readFileSync(Path.join(__dirname, '../../test_data/quiz_submissions.json'), 'utf8'));
const initialBookReviews: Models.IBookReview[] = JSON.parse(fs.readFileSync(Path.join(__dirname, '../../test_data/book_reviews.json'), 'utf8'));
const initialPrizes: Models.IPrize[] = JSON.parse(fs.readFileSync(Path.join(__dirname, '../../test_data/prizes.json'), 'utf8'));
const initialPrizeOrders: Models.IPrizeOrder[] = JSON.parse(fs.readFileSync(Path.join(__dirname, '../../test_data/prize_orders.json'), 'utf8'));

// convenience variables

const austin = _.find(initialUsers, { _id: 'austin-kyker' });
const austinToken = genAuthTokenForUser(austin);

const bonnie = _.find(initialUsers, { _id: 'bonnie-stewart' }) as Models.IEducator;
const bonnieToken = genAuthTokenForUser(bonnie);

const katelynn = _.find(initialUsers, { _id: 'katelynn-kyker' }) as Models.IStudent;
const katelynnToken = genAuthTokenForUser(katelynn);

const chase = _.find(initialUsers, { _id: 'chase-malik' }) as Models.IStudent;
const chaseToken = genAuthTokenForUser(chase);

let dbHost = process.env.MONGO_HOST || 'localhost';
let dbPort = process.env.MONGO_PORT || '27017';
let dbName = process.env.MONGO_DB_NAME || 'ete';

const connectionStr = `mongodb://${dbHost}:${dbPort}/${dbName}`;

const db = monk.default(connectionStr);
db.addMiddleware(require('monk-middleware-debug'))

const bookCollection = db.get('books', { castIds: false });
const bookReviewCollection = db.get('book_reviews', { castIds: false });
const quizCollection = db.get('quizzes', { castIds: false });
const quizSubmissionCollection = db.get('quiz_submissions', { castIds: false });
const usersCollection = db.get('users', { castIds: false });
const genreCollection = db.get('genres', { castIds: false });
const prizeCollection = db.get('prizes', { castIds: false });
const prizeOrderCollection = db.get('prize_orders', { castIds: false });

async function setData(collection: monk.ICollection, data: any) {
  await collection.remove({});
  await collection.insert(data);
}

const mongoBookData = new MongoBookData(connectionStr);
const mongoUserData = new MongoUserData(connectionStr);
const mongoGenreData = new MongoGenreData(connectionStr);
const mongoQuizData = new MongoQuizData(connectionStr);
const mongoBookReviewData = new MongoBookReviewData(connectionStr);
const mongoPrizeData = new MongoPrizeData(connectionStr);
const mongoPrizeOrderData = new MongoPrizeOrderData(connectionStr);

const app = new App(
  mongoBookData,
  mongoUserData,
  mongoGenreData,
  mongoQuizData,
  mongoBookReviewData,
  mongoPrizeData,
  mongoPrizeOrderData
)

const agent = supertest(app.server);

function genAuthToken(type: Models.UserType, id?: string): string {
  return jwt.sign({ _id: id || shortid.generate(), type }, Constants.JWTSecret, { expiresIn: '1y' });
}

function genAuthTokenForUser(user: Models.IUser): string {
  return genAuthToken(user.type, user._id);
}

// function decodeAuthToken(token: string): { _id: string, type: string } {
//   return <{ _id: string, type: string }>jwt.verify(token, Constants.JWTSecret);
// }

function checkErrMsg(msg: string) {
  return ({ body }: any) => {
    assert.equal(body.message, msg);
  };
}


describe('End to End tests', function () {

  beforeEach(async function () {
    await Promise.all([
      setData(bookCollection, initialBooks),
      setData(bookReviewCollection, initialBookReviews),
      setData(genreCollection, initialGenres),
      setData(quizCollection, initialQuizzes),
      setData(quizSubmissionCollection, initialQuizSubmissions),
      setData(usersCollection, initialUsers),
      setData(prizeCollection, initialPrizes),
      setData(prizeOrderCollection, initialPrizeOrders)
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

  })

  describe('Prize Routes', function () {

    describe('#createPrizeOrder', function () {

      const validPrizeBody: Models.IPrizeOrderBody = {
        student_id: katelynn._id,
        prize_id: _.sample(initialPrizes)._id
      };

      it('should 401 when no auth token in header', function () {
        return agent
          .post('/prize_orders')
          .expect(401);
      });

      it('should 403 when students submits on behalf another student', function () {
        return agent
          .post('/prize_orders')
          .set(SC.AuthHeaderField, chaseToken)
          .send(validPrizeBody)
          .expect(403)
          .then(checkErrMsg('Only admin can submit prize order for another student.'))
      });

      it('should 400 if student does not exist', function() {
        const invalidId = shortid.generate();
        const invalidPrizeBody = {
          ...validPrizeBody,
          student_id: invalidId
        }
        return agent
          .post('/prize_orders')
          .set(SC.AuthHeaderField, austinToken)
          .send(invalidPrizeBody)
          .expect(400)
          .then(checkErrMsg(`Student ${invalidId} does not exist.`))
      })

      it('should 400 if prize does not exist', function() {
        const invalidId = shortid.generate();
        const invalidPrizeBody = {
          ...validPrizeBody,
          prize_id: invalidId
        }
        return agent
          .post('/prize_orders')
          .set(SC.AuthHeaderField, austinToken)
          .send(invalidPrizeBody)
          .expect(400)
          .then(checkErrMsg(`Prize ${invalidId} does not exist.`))
      })

      it('should save the prize order', function () {
        return agent
          .post('/prize_orders')
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


    describe('#createPrize', function () {

      const validPrizeBody: Models.IPrize = {
        title: 'Some genre title',
        description: 'Some genre description',
        price_usd: 13.5,
        photo_url: 'http://some-url'
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
            assert.containsAllKeys(body, ['_id', 'title', 'description', 'price_usd', 'photo_url']);
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

      it('should 404 if genre does not exist', function () {
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

      it('should 403 if not admin user', function () {
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

    describe('#createBook', function () {

      let validBookBody = Mockers.mockBook({
        genres: [initialGenres[0]._id]
      });
      delete validBookBody._id;


      it('should 401 when no auth token in header', function () {
        return agent
          .post('/books')
          .expect(401);
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

      it('should 403 if non-admin making request', function () {
        return agent
          .post(`/books`)
          .set(SC.AuthHeaderField, katelynnToken)
          .expect(403);
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

      it('should return all books when no query param provided', function () {
        return agent
          .get('/books')
          .set(SC.AuthHeaderField, katelynnToken)
          .expect(200)
          .then(({ body }) => assert.sameDeepMembers(body, initialBooks))
      })

      it('should return books with matching titles to query', function () {
        return agent
          .get('/books?q=Harry+Potter')
          .set(SC.AuthHeaderField, katelynnToken)
          .expect(200)
          .then(({ body }) => assert.sameDeepMembers(body, [_.find(initialBooks, { _id: "harry-potter-id" })]))
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
        genres: _.cloneDeep(bookToUpdate.genres)
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
      const bookNotReadId = 'kings-fifth-id';
      const reviewForBookNotRead = Mockers.mockBookReview({
        student_id: chase._id,
        book_id: bookNotReadId
      });
      delete reviewForBookNotRead.book_lexile_measure;
      delete reviewForBookNotRead.date_created;
      delete reviewForBookNotRead._id;

      const bookChaseReadId = 'hobbit-id';
      const reviewForBookRead = Mockers.mockBookReview({
        student_id: chase._id,
        book_id: bookChaseReadId
      });
      delete reviewForBookRead.book_lexile_measure;
      delete reviewForBookRead.date_created;
      delete reviewForBookRead._id;

      it('should 401 when no auth token in header', function () {
        return agent
          .post(`/book_reviews`)
          .expect(401);
      });

      it('should 403 if student has not submitted a quiz for book', function () {
        return agent
          .post(`/book_reviews`)
          .set(SC.AuthHeaderField, chaseToken)
          .send(reviewForBookNotRead)
          .expect(403)
          .then(checkErrMsg(`User has not passed a quiz for book ${bookNotReadId}. The user must do this before posting a review.`))
      });

      it('should 403 if student submitting for another student', function () {
        return agent
          .post(`/book_reviews`)
          .set(SC.AuthHeaderField, katelynnToken)
          .send(reviewForBookRead)
          .expect(403)
          .then(checkErrMsg(`User ${katelynn._id} cannot write book review for user ${chase._id}`))
      });

      it('should 200 and create the review', function () {
        return agent
          .post(`/book_reviews`)
          .set(SC.AuthHeaderField, chaseToken)
          .send(reviewForBookRead)
          .expect(200)
          .then(({ body }) => {
            delete body.date_created;
            delete body._id;
            const expected = _.assign({}, reviewForBookRead, {
              book_lexile_measure: 1000
            })
            assert.deepEqual(body, expected);
          })
      });

      it('should 403 if submitting another review for same book', function () {

        // "student_id": "katelynn-kyker",
        // "book_id": "harry-potter-id",
        const copy = _.cloneDeep(initialBookReviews[0]);
        delete copy._id;
        delete copy.date_created;

        return agent
          .post(`/book_reviews`)
          .set(SC.AuthHeaderField, katelynnToken)
          .send(copy)
          .expect(403)
          .then(checkErrMsg(`Student ${katelynn._id} has already posted a book review for book ${copy.book_id}`))
      });

    })

  })

  describe('Quiz Routes', function () {

    describe('#createQuiz', function () {

      let validQuiz = Mockers.mockQuiz({
        questions: _.times(5, () => Mockers.mockQuizQuestion())
      })
      delete validQuiz._id;
      delete validQuiz.date_created;

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

      it('should create a new quiz', function () {
        return agent
          .post(`/quizzes`)
          .set(SC.AuthHeaderField, austinToken)
          .send(validQuiz)
          .expect(200)
          .then(({ body }) => {
            delete body._id;
            delete body.date_created;
            assert.deepEqual(body, validQuiz);
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

      const genericQuiz = _.find(initialQuizzes, { _id: "quiz-id-1" })

      const passingValidSubmissionQuiz1Body = {
        student_id: chase._id,
        book_id: initialBooks[0]._id,
        quiz_id: genericQuiz._id,
        answers: [
          { answer_index: 3 },
          { answer_index: 2 },
          { answer_index: 2 },
          { answer_index: 2 },
          { answer_index: 0 }
        ]
      }

      const failingSubmissionQuiz1Body = {
        student_id: chase._id,
        book_id: initialBooks[0]._id,
        quiz_id: genericQuiz._id,
        answers: [
          { answer_index: 4 },
          { answer_index: 1 },
          { answer_index: 2 },
          { answer_index: 2 },
          { answer_index: 0 }
        ]
      }

      const quizUserAlreadyPassed = {
        student_id: katelynn._id,
        book_id: initialBooks[0]._id,
        quiz_id: genericQuiz._id,
        answers: [
          { answer_index: 3 },
          { answer_index: 2 },
          { answer_index: 2 },
          { answer_index: 2 },
          { answer_index: 0 }
        ]
      }

      const userExhaustedAllAttemptsSubmission = {
        student_id: katelynn._id,
        book_id: initialBooks[0]._id,
        quiz_id: genericQuiz._id,
        answers: [
          { answer_index: 3 },
          { answer_index: 2 },
          { answer_index: 2 },
          { answer_index: 2 },
          { answer_index: 0 }
        ]
      }

      // katelynn already failed quiz for exchange-student-id three times
      // she failed quiz-id-1 twice and quiz-id-2 once
      const quizForBookAlreadyFailedThreeTime = {
        student_id: katelynn._id,
        book_id: 'exchange-student-id',
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
          .post(`/quiz_submissions`)
          .expect(401);
      });

      it('should 400 if quiz is invalid', function () {
        const copy = _.cloneDeep(passingValidSubmissionQuiz1Body);
        copy.quiz_id = shortid.generate();
        return agent
          .post('/quiz_submissions')
          .set(SC.AuthHeaderField, chaseToken)
          .send(copy)
          .expect(400)
          .then(checkErrMsg(`No quiz with id ${copy.quiz_id} exists`))
      })

      it('should 400 if book is invalid', function () {
        const copy = _.cloneDeep(passingValidSubmissionQuiz1Body);
        copy.book_id = shortid.generate();
        return agent
          .post('/quiz_submissions')
          .set(SC.AuthHeaderField, chaseToken)
          .send(copy)
          .expect(400)
          .then(checkErrMsg(`No book with id ${copy.book_id} exists`))
      })

      it('should 403 when students submits on behalf another student', function () {
        return agent
          .post('/quiz_submissions')
          .set(SC.AuthHeaderField, katelynnToken)
          .send(passingValidSubmissionQuiz1Body)
          .expect(403)
          .then(checkErrMsg('Students cannot submit quizzes for other students'))
      })

      it('should 403 if user has already passed quiz', function () {
        return agent
          .post('/quiz_submissions')
          .set(SC.AuthHeaderField, katelynnToken)
          .send(quizUserAlreadyPassed)
          .expect(403)
          .then(checkErrMsg(`User has already passed quiz for book ${quizUserAlreadyPassed.book_id}`))
      })

      it('should 403 if user has already failed three times', function () {
        return agent
          .post('/quiz_submissions')
          .set(SC.AuthHeaderField, katelynnToken)
          .send(quizForBookAlreadyFailedThreeTime)
          .expect(403)
          .then(checkErrMsg(`User has exhausted all attempts to pass quiz for book ${quizForBookAlreadyFailedThreeTime.book_id}`))
      })

      it('should prevent user from attempting another quiz without waiting', function () {

        const latestSubmissionDate = moment().subtract(SC.MinHoursBetweenBookQuizAttempt, 'h').add(1, 'm').toISOString();
        const nextPossibleSubmissionDate = moment(latestSubmissionDate).add(SC.MinHoursBetweenBookQuizAttempt, 'h').toISOString();

        const recentSubmission = Mockers.mockQuizSubmission({
          quiz_id: 'quiz-id-1',
          book_id: initialBooks[0]._id,
          student_id: katelynn._id,
          date_created: latestSubmissionDate,
          answers: _.times(5, () => ({ answer_index: 2 }))
        })

        return quizSubmissionCollection.insert(recentSubmission)
          .then(() => {

            return agent
              .post('/quiz_submissions')
              .set(SC.AuthHeaderField, katelynnToken)
              .send(userExhaustedAllAttemptsSubmission)
              .expect(403)
              .then(checkErrMsg(`User must wait till ${nextPossibleSubmissionDate} to attempt another quiz.`))

          })

      })

      it('should 200 and return passed quiz', function () {
        return agent
          .post('/quiz_submissions')
          .set(SC.AuthHeaderField, chaseToken)
          .send(passingValidSubmissionQuiz1Body)
          .expect(200)
          .then(({ body }) => {
            delete body._id;
            delete body.date_created;
            assert.deepEqual(body, _.assign({}, passingValidSubmissionQuiz1Body, {
              passed: true,
              score: 100
            }))
            return quizSubmissionCollection.find({})
          })
          .then(submissions => assert.lengthOf(submissions, initialQuizSubmissions.length + 1))
      })

      it('should 200 and return failed quiz', function () {
        return agent
          .post('/quiz_submissions')
          .set(SC.AuthHeaderField, chaseToken)
          .send(failingSubmissionQuiz1Body)
          .expect(200)
          .then(({ body }) => {
            delete body._id;
            delete body.date_created;
            assert.deepEqual(body, _.assign({}, failingSubmissionQuiz1Body, {
              passed: false,
              score: 60
            }))
          })
      })

    })

    describe('#getQuizForBook', function () {

      const bookWithQuiz = _.find(initialBooks, { _id: 'harry-potter-id' });
      const bookWithoutQuiz = _.find(initialBooks, { _id: 'hobbit-id' })

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
        const quizForHarryPotter = _.find(initialQuizzes, { book_id: bookWithQuiz._id })
        return agent
          .get(`/books/${bookWithQuiz._id}/quiz`)
          .set(SC.AuthHeaderField, chaseToken)
          .expect(200)
          .then(({ body }) => assert.deepEqual(body, quizForHarryPotter))
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

    describe('User Routes', function () {

      describe('#createEducator', function () {

        const validReqBody: Models.IUserBody = {
          first_name: 'Bonnie',
          last_name: 'Stewart',
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
                'email',
                'first_name',
                'hashed_password',
                'last_name',
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
                type: Models.UserType.EDUCATOR,
                student_ids: []
              });

              assert.deepEqual(expected, body);
              return usersCollection.find({});

            })
            .then(allUsers => assert.lengthOf(allUsers, initialUsers.length + 1))
        });

      });

      describe('#updateStudentsForEducator', function () {

        const invalidWithBadStudent = [katelynn._id, shortid.generate()];
        const invalidWithEducator = [katelynn._id, austin._id];
        const validStudentIds = [katelynn._id, chase._id];

        it('should 401 when no auth token in header', function () {
          return agent
            .put(`/educators/${bonnie._id}/students`)
            .expect(401);
        });

        it('should 403 if non-admin making request', function () {
          return agent
            .put(`/educators/${bonnie._id}/students`)
            .set(SC.AuthHeaderField, chaseToken)
            .expect(403);
        });

        it('should 403 if educator making request on behalf another educator', function () {
          return agent
            .put(`/educators/${bonnie._id}/students`)
            .set(SC.AuthHeaderField, genAuthToken(Models.UserType.EDUCATOR, shortid.generate()))
            .expect(403);
        });

        it('should 400 if invalid student ids in body', function () {
          return agent
            .put(`/educators/${bonnie._id}/students`)
            .set(SC.AuthHeaderField, bonnieToken)
            .send({ student_ids: invalidWithBadStudent })
            .expect(400);
        });

        it('should 400 if not all ids are for student users', function () {
          return agent
            .put(`/educators/${bonnie._id}/students`)
            .set(SC.AuthHeaderField, bonnieToken)
            .send({ student_ids: invalidWithEducator })
            .expect(400);
        });

        it('should 200 and save students on educator', function () {
          return agent
            .put(`/educators/${bonnie._id}/students`)
            .set(SC.AuthHeaderField, bonnieToken)
            .send({ student_ids: validStudentIds })
            .expect(200)
            .then(() => usersCollection.findOne({ _id: bonnie._id }))
            .then(user => assert.sameDeepMembers(user.student_ids, validStudentIds))
        });

      })
      
      describe('#updateStudentsParentsEmails', function() {

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

      describe('#createStudent', function () {

        const validReqBody: Models.IStudentBody = {
          first_name: 'Taylor',
          last_name: 'Jones',
          gender: Models.Gender.Female,
          initial_lexile_measure: 400,
          email: 'tjones@parktudor.org',
          password: 'taylors_password',
          parent_emails: []
        }

        it('should 401 when no auth token in header', function () {
          return agent
            .post(`/students`)
            .expect(401);
        });

        it('should 403 if non-admin making request', function () {
          return agent
            .post('/students')
            .set(SC.AuthHeaderField, chaseToken)
            .expect(403);
        });

        it('should 200 and save the student', function () {

          return agent
            .post('/students')
            .set(SC.AuthHeaderField, austinToken)
            .send(validReqBody)
            .expect(200)
            .then(({ body }) => {

              assert.hasAllKeys(body, [
                '_id',
                'date_created',
                'email',
                'first_name',
                'last_name',
                'gender',
                'genre_interests',
                'hashed_password',
                'initial_lexile_measure',
                'bookmarked_books',
                'type',
                'parent_emails'
              ])

              // bcrypt will produce different hashes for the same
              // string. In other words, hash(validReqBody.password) !== body.hashed_password
              assert.isTrue(bcrypt.compareSync(validReqBody.password, body.hashed_password));

              delete body._id;
              delete body.date_created;
              delete body.hashed_password;
              delete validReqBody.password;

              const expected = _.assign({}, validReqBody, {
                type: Models.UserType.STUDENT,
                genre_interests: null,
                bookmarked_books: []
              });

              assert.deepEqual(expected, body);
              return usersCollection.find({});

            })
            .then(allUsers => assert.lengthOf(allUsers, initialUsers.length + 1))
        })

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

        it('should 403 if user is not STUDENT', function () {

          return agent
            .post(`/students/${austin._id}/genre_interests`)
            .set(SC.AuthHeaderField, austinToken)
            .send(validGenreMap)
            .expect(403)
            .then(checkErrMsg(`Can only post genre interests for student users`))

        });

        it('should 403 if user has already posted genre interests', function () {

          return agent
            .post(`/students/${katelynn._id}/genre_interests`)
            .set(SC.AuthHeaderField, katelynnToken)
            .send(validGenreMap)
            .expect(403)
            .then(checkErrMsg('User already has created genre interests'))

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
            .then(checkErrMsg('User cannot edit genre interests, until they have been created.'))
        });

        it('should 400 if genre id is invalid', function () {
          const invalidGenreId = shortid.generate();
          return agent
            .put(`/students/${katelynn._id}/genre_interests/${invalidGenreId}`)
            .set(SC.AuthHeaderField, katelynnToken)
            .send(validBody)
            .expect(400)
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

      describe('#bookmarkBook', function() {

        const validReqBody = {
          bookId: 'harry-potter-id'
        }

        const invalidReqBody = {
          bookId: shortid.generate()
        }

        it('should 401 when no auth token in header', function () {
          return agent
            .post(`/students/${katelynn._id}/bookmarked_books`)
            .expect(401);
        });

        it('should 404 if user does not exist', function () {
          const invalidUserId = shortid.generate()
          return agent
            .post(`/students/${invalidUserId}/bookmarked_books`)
            .set(SC.AuthHeaderField, austinToken)
            .send(validReqBody)
            .expect(404)
            .then(checkErrMsg(`User ${invalidUserId} does not exist.`))
        });

        it('should 403 if user is not a student', function () {
          return agent
            .post(`/students/${austin._id}/bookmarked_books`)
            .set(SC.AuthHeaderField, austinToken)
            .send(validReqBody)
            .expect(403)
            .then(checkErrMsg(`User ${austin._id} is not a student.`))
        });

        it('should 403 if student making request on behalf another student', function () {
          return agent
            .post(`/students/${chase._id}/bookmarked_books`)
            .set(SC.AuthHeaderField, katelynnToken)
            .expect(403)
            .then(checkErrMsg(`User ${katelynn._id} cannot act as an agent for user ${chase._id}`))
        });

        it('should 400 if book does not exist', function () {
          return agent
            .post(`/students/${chase._id}/bookmarked_books`)
            .set(SC.AuthHeaderField, chaseToken)
            .send(invalidReqBody)
            .expect(400)
            .then(checkErrMsg(`Book ${invalidReqBody.bookId} does not exist.`))
        });

        it('should 400 if book is already bookmarked', function () {
          return agent
            .post(`/students/${katelynn._id}/bookmarked_books`)
            .set(SC.AuthHeaderField, katelynnToken)
            .send(validReqBody)
            .expect(400)
            .then(checkErrMsg(`Student ${katelynn._id} already bookmarked book ${validReqBody.bookId}.`))
        });

        it('should 200 and bookmark book', function () {
          return agent
            .post(`/students/${chase._id}/bookmarked_books`)
            .set(SC.AuthHeaderField, chaseToken)
            .send(validReqBody)
            .expect(200)
            .then(() => mongoUserData.getUserById(chase._id))
            .then((student: Models.IStudent) => {
              assert.lengthOf(student.bookmarked_books, chase.bookmarked_books.length + 1);
              assert.equal(_.last(student.bookmarked_books).bookId, validReqBody.bookId);
            })
        });

      });

      describe('#unbookmarkBook', function() {

        it('should 401 when no auth token in header', function () {
          return agent
            .del(`/students/${katelynn._id}/bookmarked_books/harry-potter-id`)
            .expect(401);
        });

        it('should 404 if user does not exist', function () {
          const invalidUserId = shortid.generate()
          return agent
            .del(`/students/${invalidUserId}/bookmarked_books/harry-potter-id`)
            .set(SC.AuthHeaderField, austinToken)
            .expect(404)
            .then(checkErrMsg(`User ${invalidUserId} does not exist.`))
        });

        it('should 403 if user is not a student', function () {
          return agent
            .del(`/students/${austin._id}/bookmarked_books/harry-potter-id`)
            .set(SC.AuthHeaderField, austinToken)
            .expect(403)
            .then(checkErrMsg(`User ${austin._id} is not a student.`))
        });

        it('should 403 if student making request on behalf another student', function () {
          return agent
            .del(`/students/${chase._id}/bookmarked_books/harry-potter-id`)
            .set(SC.AuthHeaderField, katelynnToken)
            .expect(403)
            .then(checkErrMsg(`User ${katelynn._id} cannot act as an agent for user ${chase._id}`))
        });

        it('should 400 if book does not exist', function () {
          const invalidBookId = shortid.generate()
          return agent
            .del(`/students/${chase._id}/bookmarked_books/${invalidBookId}`)
            .set(SC.AuthHeaderField, chaseToken)
            .expect(400)
            .then(checkErrMsg(`Book ${invalidBookId} does not exist.`))
        });

        it('should 400 if book isn\'t bookmarked', function () {
          const unbookmarkedBookId = 'hobbit-id';
          return agent
            .del(`/students/${chase._id}/bookmarked_books/${unbookmarkedBookId}`)
            .set(SC.AuthHeaderField, chaseToken)
            .expect(400)
            .then(checkErrMsg(`Student ${chase._id} never bookmarked book ${unbookmarkedBookId}.`))
        });

        it('should 200 and unbookmark book', function () {
          const { bookId: idOfBookToUnbookmark } = katelynn.bookmarked_books[0];
          return agent
            .del(`/students/${katelynn._id}/bookmarked_books/${idOfBookToUnbookmark}`)
            .set(SC.AuthHeaderField, katelynnToken)
            .expect(200)
            .then(() => mongoUserData.getUserById(katelynn._id))
            .then((student: Models.IStudent) => {
              assert.lengthOf(student.bookmarked_books, katelynn.bookmarked_books.length - 1);
              assert.notInclude(_.map(student.bookmarked_books, 'bookId'), idOfBookToUnbookmark)
            })
        });

      });

    })

  })

  after(async function () {
    await Promise.all([
      bookCollection.drop(),
      genreCollection.drop(),
      quizCollection.drop(),
      quizSubmissionCollection.drop(),
      usersCollection.drop(),
      bookReviewCollection.drop(),
      prizeCollection.drop(),
      prizeOrderCollection.drop()
    ]);
    db.close();
  })


})