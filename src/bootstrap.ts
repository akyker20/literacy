import * as monk from 'monk';
import * as Path from 'path';
import * as fs from 'fs';
import { Models as M } from 'reading_rewards';

const initialUsers: M.IUser[] = JSON.parse(fs.readFileSync(Path.join(__dirname, '../bootstrap_data/users.json'), 'utf8'))
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

const bookRequestCollection = db.get('book_requests', { castIds: false });
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

const bookReviews: M.IBookReview[] = [];

async function setData(collection: monk.ICollection, data: any) {
  await collection.drop();
  await collection.insert(data);
}

Promise.all([
  setData(seriesCollection, initialSeries),
  setData(authorCollection, initialAuthors),
  setData(usersCollection, initialUsers),
  setData(bookCollection, initialBooks),
  setData(genreCollection, initialGenres),
  setData(quizCollection, quizzes),
  setData(prizeCollection, initialPrizes),
  setData(quizSubmissionsCollection, []),
  setData(prizeOrdersCollection, []),
  setData(bookReviewsCollection, bookReviews),
  setData(readingLogCollection, []),
  setData(bookRequestCollection, [])
]).then(() => process.exit(0))