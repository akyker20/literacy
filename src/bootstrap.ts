import * as bcrypt from 'bcryptjs';
import * as monk from 'monk';
import * as faker from 'faker';
import * as Path from 'path';
import * as fs from 'fs';
import { Models as M, Mockers } from 'reading_rewards';
import * as _ from 'lodash';

import { HashedPassSaltLen } from './constants';

const initialSeries: M.ISeries[] = JSON.parse(fs.readFileSync(Path.join(__dirname, '../bootstrap_data/series.json'), 'utf8'))
const initialAuthors: M.IAuthor[] = JSON.parse(fs.readFileSync(Path.join(__dirname, '../bootstrap_data/authors.json'), 'utf8'))
const initialGenres: M.IGenre[] = JSON.parse(fs.readFileSync(Path.join(__dirname, '../bootstrap_data/genres.json'), 'utf8'))
const initialPrizes: M.IPrize[] = JSON.parse(fs.readFileSync(Path.join(__dirname, '../bootstrap_data/prizes.json'), 'utf8'));
const initialBooks: M.IBook[] = JSON.parse(fs.readFileSync(Path.join(__dirname, '../bootstrap_data/books.json'), 'utf8'));
const initialQuizzes: M.IQuiz[] = JSON.parse(fs.readFileSync(Path.join(__dirname, '../bootstrap_data/quizzes.json'), 'utf8'));

// Configure database

const host = process.env.MONGO_HOST || 'localhost';
const port = process.env.MONGO_PORT || 27017;
const dbName = process.env.MONGO_DB_NAME || 'local';

const connectionStr = `mongodb://${host}:${port}/${dbName}`;
const db = monk.default(connectionStr);

const seriesCollection = db.get('series', { castIds: false });
const authorCollection = db.get('authors', { castIds: false });
const bookCollection = db.get('books', { castIds: false });
const genreCollection = db.get('genres', { castIds: false });
const usersCollection = db.get('users', { castIds: false });
const quizCollection = db.get('quizzes', { castIds: false })
const prizeCollection = db.get('prizes', { castIds: false });
const readingLogCollection = db.get('reading_logs', { castIds: false });
const quizSubmissionsCollection = db.get('quiz_submissions', { castIds: false })
const prizeOrdersCollection = db.get('prize_orders', { castIds: false })
const bookReviewsCollection = db.get('book_reviews', { castIds: false });

const quizzes: M.IQuiz[] = [
  ...initialQuizzes,
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
_.forEach(initialGenres, genre => katelynnGenreInterests[genre._id as string] = _.random(1, 4) as any)

const katelynn: M.IStudent = {
  _id: 'katelynn-kyker',
  email: 'kkyker@gmail.com',
  first_name: 'Katelynn',
  last_name: 'Kyker',
  status: M.StudentStatus.Active,
  type: M.UserType.STUDENT,
  date_created: new Date().toISOString(),
  date_activated: new Date().toISOString(),
  hashed_password: bcrypt.hashSync('password', HashedPassSaltLen),
  initial_lexile_measure: 700,
  gender: M.Gender.Female,
  parent_emails: ['jkyker217@gmail.com'],
  genre_interests: katelynnGenreInterests,
  bookmarked_books: _.sampleSize(initialBooks, _.random(5)).map(book => ({
    bookId: book._id,
    date: new Date().toISOString()
  }))
}

const bonnie: M.IEducator = {
  _id: 'bonnie-stewart',
  email: 'bonnie@gmail.com',
  first_name: 'Bonnie',
  last_name: 'Stewart',
  type: M.UserType.EDUCATOR,
  date_created: new Date().toISOString(),
  hashed_password: bcrypt.hashSync('password', HashedPassSaltLen),
  student_ids: [katelynn._id],
  notification_settings: {
    reading_logs: true,
    quiz_submissions: true,
    prizes_ordered: true
  }
}

const users: M.IUser[] = [
  austin,
  katelynn,
  bonnie
]

const bookReviews: M.IBookReview[] = [];
_.forEach(initialBooks, book => _.times(_.random(1, 10), i => {
  bookReviews.push(Mockers.mockBookReview({
    book_id: book._id as string,
    student_id: katelynn._id as string,
    review: faker.lorem.sentences(_.random(3, 10)),
    student_initials: `${faker.name.firstName().charAt(0)}${faker.name.lastName().charAt(0)}`.toUpperCase()
  }))
}))


async function setData(collection: monk.ICollection, data: any) {
  await collection.drop();
  await collection.insert(data);
}

Promise.all([
  setData(seriesCollection, initialSeries),
  setData(authorCollection, initialAuthors),
  setData(usersCollection, users),
  setData(bookCollection, initialBooks),
  setData(genreCollection, initialGenres),
  setData(quizCollection, quizzes),
  setData(prizeCollection, initialPrizes),
  setData(quizSubmissionsCollection, []),
  setData(prizeOrdersCollection, []),
  setData(bookReviewsCollection, bookReviews),
  setData(readingLogCollection, [])
]).then(() => process.exit(0))