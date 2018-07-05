import * as bcrypt from 'bcryptjs';
import * as monk from 'monk';
import { Models as M, Mockers } from 'reading_rewards';
import * as _ from 'lodash';

import { HashedPassSaltLen } from './constants';

const genres: M.IGenre[] = [
  {
    _id: 'history',
    title: 'History',
    description: 'Some description of genre'
  },
  {
    _id: 'science',
    title: 'Science',
    description: 'Some description of genre'
  },
  {
    _id: 'science-fiction',
    title: 'Science Fiction',
    description: 'Some description of genre'
  },
  {
    _id: 'poetry',
    title: 'Poetry',
    description: 'Some description of genre'
  },
  {
    _id: 'sports',
    title: 'Sports',
    description: 'Some description of genre'
  }
]

const books = _.times(500, i => Mockers.mockBook({
  genres: _.sampleSize(genres, _.random(3)).map(g => g._id)
}))

const quizzes: M.IQuiz[] = [
  {
    _id: 'quiz-id',
    date_created: new Date().toISOString(),
    questions: [
      {
        type: M.QuestionTypes.LongAnswer,
        prompt: 'Describe the main character.',
        points: 1
      },
      {
        type: M.QuestionTypes.LongAnswer,
        prompt: 'Summarize the book in under 100 words.',
        points: 1
      },
      {
        type: M.QuestionTypes.LongAnswer,
        prompt: 'What was your favorite part of the book?',
        points: 1
      },
      {
        type: M.QuestionTypes.LongAnswer,
        prompt: 'How did the book end?',
        points: 1
      }
    ]
  }
]

const austin: M.IUser = {
  _id: 'austin-kyker',
  email: 'akyker20@gmail.com',
  first_name: 'Austin',
  last_name: 'Kyker',
  type: M.UserType.ADMIN,
  date_created: new Date().toISOString(),
  hashed_password: bcrypt.hashSync('password', HashedPassSaltLen)
}

const katelynnGenreInterests: M.GenreInterestMap = {};
_.forEach(genres, genre => katelynnGenreInterests[genre._id as string] = _.random(1, 4) as any)

const katelynn: M.IStudent = {
  _id: 'katelynn-kyker',
  email: 'kkyker@gmail.com',
  first_name: 'Katelynn',
  last_name: 'Kyker',
  type: M.UserType.STUDENT,
  date_created: new Date().toISOString(),
  hashed_password: bcrypt.hashSync('password', HashedPassSaltLen),
  initial_lexile_measure: 700,
  gender: M.Gender.Female,
  parent_emails: ['jkyker217@gmail.com'],
  genre_interests: katelynnGenreInterests,
  bookmarked_books: _.sampleSize(books, _.random(5)).map(book => ({
    bookId: book._id,
    date: new Date().toISOString()
  }))
}

const users: M.IUser[] = [
  austin,
  katelynn
]

const connectionStr = `mongodb://localhost:27017/local`;
const db = monk.default(connectionStr);

const bookCollection = db.get('books', { castIds: false });
const genreCollection = db.get('genres', { castIds: false });
const usersCollection = db.get('users', { castIds: false });
const quizCollection = db.get('quizzes', { castIds: false })

async function setData(collection: monk.ICollection, data: any) {
  await collection.drop();
  await collection.insert(data);
}

Promise.all([
  setData(usersCollection, users),
  setData(bookCollection, books),
  setData(genreCollection, genres),
  setData(quizCollection, quizzes)
]).then(() => process.exit(0))