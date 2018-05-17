import * as fs from 'fs';
import * as shortid from 'shortid';
import * as jwt from 'jsonwebtoken';
import * as faker from 'faker';
import * as monk from 'monk';
import * as supertest from 'supertest';
import { assert } from 'chai';

import * as Constants from '../constants';
import { MongoUserData } from '../data/users';
import { MongoBookData } from '../data/books';
import { MongoQuizData } from '../data/quizzes';
import { MongoBookReviewData } from '../data/book_reviews';
import { MongoGenreData } from '../data/genres';
import App from '..';
import _ = require('lodash');
import { IUser, UserType } from '../models/user';
import { IGenre, mockGenre } from '../models/genre';
import { mockBook, IBook } from '../models/book';

// Load all the data

const initialBooks = JSON.parse(fs.readFileSync('test_data/books.json', 'utf8'));
const initialGenres: IGenre[] = JSON.parse(fs.readFileSync('test_data/genres.json', 'utf8'));
const initialQuizzes = JSON.parse(fs.readFileSync('test_data/quizzes.json', 'utf8'));
const initialUsers: IUser[] = JSON.parse(fs.readFileSync('test_data/users.json', 'utf8'));
const initialQuizSubmissions = JSON.parse(fs.readFileSync('test_data/quiz_submissions.json', 'utf8'));
const initialBookReviews = JSON.parse(fs.readFileSync('test_data/book_reviews.json', 'utf8'));

// convenience variables

const austin = _.find(initialUsers, { _id: 'austin-kyker' });
const austinToken = genAuthTokenForUser(austin);

const katelynn = _.find(initialUsers, { _id: 'katelynn-kyker' });
const katelynnToken = genAuthTokenForUser(katelynn);

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

async function setData(collection: monk.ICollection, data: any) {
  await collection.remove({});
  await collection.insert(data);
}

const mongoBookData = new MongoBookData(connectionStr);
const mongoUserData = new MongoUserData(connectionStr);
const mongoGenreData = new MongoGenreData(connectionStr);
const mongoQuizData = new MongoQuizData(connectionStr);
const mongoBookReviewData = new MongoBookReviewData(connectionStr);

const app = new App(
  mongoBookData,
  mongoUserData,
  mongoGenreData,
  mongoQuizData,
  mongoBookReviewData
)

const agent = supertest(app.server);

function genAuthToken(type: UserType, id?: string): string {
  return jwt.sign({ _id: id || shortid.generate(), type }, Constants.JWTSecret, { expiresIn: '1y' });
}

function genAuthTokenForUser(user: IUser): string {
  return genAuthToken(user.type, user._id);
}

function decodeAuthToken(token: string): { _id: string, type: string } {
  return <{ _id: string, type: string }>jwt.verify(token, Constants.JWTSecret);
}

function checkErrMsg(msg: string) {
  return ({ body }: any) => {
    assert.equal(body.message, msg);
  };
}


describe('End to End tests', function() {

  beforeEach(async function () {
    await Promise.all([
      setData(bookCollection, initialBooks),
      setData(bookReviewCollection, initialBookReviews),
      setData(genreCollection, initialGenres),
      setData(quizCollection, initialQuizzes),
      setData(quizSubmissionCollection, initialQuizSubmissions),
      setData(usersCollection, initialUsers)
    ]);
  });

  describe('Genre Routes', function() {

    describe('#createGenre', function() {

      const validGenreBody: IGenre = {
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
          .set(Constants.AuthHeaderField, katelynnToken)
          .expect(403);
      });

      it('should save the genre', function() {
        return agent
          .post('/genres')
          .set(Constants.AuthHeaderField, austinToken)
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

    describe('#deleteGenre', function() {

      const idOfGenreToDelete = initialGenres[0]._id;

      it('should 401 when no auth token in header', function () {
        return agent
          .del(`/genres/${idOfGenreToDelete}`)
          .expect(401);
      });

      it('should 404 if genre does not exist', function () {
        return agent
          .del(`/genres/${shortid.generate()}`)
          .set(Constants.AuthHeaderField, austinToken)
          .expect(404)
          .then(checkErrMsg('No genre was deleted'))
      });

      it('should 403 if non-admin making request', function () {
        return agent
          .del(`/genres/${idOfGenreToDelete}`)
          .set(Constants.AuthHeaderField, katelynnToken)
          .expect(403);
      });

      it('should delete the genre', function() {
        return agent
          .del(`/genres/${idOfGenreToDelete}`)
          .set(Constants.AuthHeaderField, austinToken)
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

    describe('#getGenres', function() {

      it('should 401 when no auth token in header', function () {
        return agent
          .get('/genres')
          .expect(401);
      });

      it('should return all genres', function() {
        return agent
          .get('/genres')
          .set(Constants.AuthHeaderField, katelynnToken)
          .expect(200)
          .then(({ body }) => assert.sameDeepMembers(body, initialGenres))
      })

    })

    describe('#updateGenres', function() {

      const genreToUpdate = _.sample(initialGenres);
      const genreId = genreToUpdate._id;
      const update: IGenre = mockGenre({
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
          .set(Constants.AuthHeaderField, katelynnToken)
          .expect(403);
      });

      it('should update the genre', function() {
        return agent
          .put(`/genres/${genreId}`)
          .set(Constants.AuthHeaderField, austinToken)
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

  describe('Book Routes', function() {

    describe('#createBook', function() {

      let validBookBody = mockBook({
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
          .set(Constants.AuthHeaderField, austinToken)
          .send(invalidBody)
          .expect(400)
          .then(checkErrMsg(`Genre ids ${invalidId} are invalid.`))
      });

      it('should 403 if non-admin making request', function () {
        return agent
          .post(`/books`)
          .set(Constants.AuthHeaderField, katelynnToken)
          .expect(403);
      });

      it('should save the book', function() {
        return agent
          .post('/books')
          .set(Constants.AuthHeaderField, austinToken)
          .send(validBookBody)
          .expect(200)
          .then(({ body }) => {
            assert.containsAllKeys(body, ['_id', ... _.keys(validBookBody)]);
            delete body._id;
            assert.deepEqual(body, validBookBody);
            return bookCollection.find({})
          })
          .then(allBooks => assert.lengthOf(allBooks, initialBooks.length + 1))
      })

    })

    describe('#deleteBook', function() {

      const idOfBookToDelete = initialBooks[0]._id;

      it('should 401 when no auth token in header', function () {
        return agent
          .del(`/books/${idOfBookToDelete}`)
          .expect(401);
      });

      it('should 404 if book does not exist', function () {
        return agent
          .del(`/books/${shortid.generate()}`)
          .set(Constants.AuthHeaderField, austinToken)
          .expect(404)
          .then(checkErrMsg('No book was deleted'))
      });

      it('should 403 if non-admin making request', function () {
        return agent
          .del(`/books/${idOfBookToDelete}`)
          .set(Constants.AuthHeaderField, katelynnToken)
          .expect(403);
      });

      it('should delete the book', function() {
        return agent
          .del(`/books/${idOfBookToDelete}`)
          .set(Constants.AuthHeaderField, austinToken)
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

    describe('#getBooks', function() {

      it('should 401 when no auth token in header', function () {
        return agent
          .get('/books')
          .expect(401);
      });

      it('should return all books when no query param provided', function() {
        return agent
          .get('/books')
          .set(Constants.AuthHeaderField, katelynnToken)
          .expect(200)
          .then(({ body }) => assert.sameDeepMembers(body, initialBooks))
      })

      it('should return books with matching titles to query', function() {
        return agent
          .get('/books?q=Harry+Potter')
          .set(Constants.AuthHeaderField, katelynnToken)
          .expect(200)
          .then(({ body }) => assert.sameDeepMembers(body, [_.find(initialBooks, { _id: "harry-potter-id" })]))
      })

    })

    describe('#updateBook', function() {

      const bookToUpdate = _.sample(initialBooks);
      const bookId = bookToUpdate._id;
      const update: IBook = mockBook({
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
          .set(Constants.AuthHeaderField, katelynnToken)
          .expect(403);
      });

      it('should update the book', function() {
        return agent
          .put(`/books/${bookId}`)
          .set(Constants.AuthHeaderField, austinToken)
          .send(update)
          .expect(200)
          .then(({ body }) => {
            assert.deepEqual(body, { updatedBook: update })
            return bookCollection.findOne({ _id: bookId })
          })
          .then(book => assert.deepEqual(book, update))
      })

    })

  })

  after(async function() {
    await Promise.all([
      bookCollection.drop(),
      genreCollection.drop(),
      quizCollection.drop(),
      quizSubmissionCollection.drop(),
      usersCollection.drop(),
      bookReviewCollection.drop()
    ]);
    db.close();
  })


})