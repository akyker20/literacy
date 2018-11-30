import * as monk from 'monk';
import * as Path from 'path';
import * as fs from 'fs';
import { Models as M } from 'reading_rewards';

const DataDir = (process.env.NODE_ENV === 'production') ?
  Path.join(__dirname, '../bootstrap_prod_data') :
  Path.join(__dirname, '../bootstrap_dev_data');


const initialArticles: M.IArticle[] = JSON.parse(fs.readFileSync(Path.join(DataDir, 'articles.json'), 'utf8'))
const initialArticleVersions: M.IArticleVersion[] = JSON.parse(fs.readFileSync(Path.join(DataDir, 'article_versions.json'), 'utf8'))
const initialSchools: M.ISchool[] = JSON.parse(fs.readFileSync(Path.join(DataDir, 'schools.json'), 'utf8'))
const initialInitiatives: M.IInitiative[] = JSON.parse(fs.readFileSync(Path.join(DataDir, 'initiatives.json'), 'utf8'))
const initialClassInitiatives: M.IClassInitiative[] = JSON.parse(fs.readFileSync(Path.join(DataDir, 'class_initiatives.json'), 'utf8'))
const initialUsers: M.IUser[] = JSON.parse(fs.readFileSync(Path.join(DataDir, 'users.json'), 'utf8'))
const initialSeries: M.ISeries[] = JSON.parse(fs.readFileSync(Path.join(DataDir, 'series.json'), 'utf8'))
const initialAuthors: M.IAuthor[] = JSON.parse(fs.readFileSync(Path.join(DataDir, 'authors.json'), 'utf8'))
const initialGenres: M.IGenre[] = JSON.parse(fs.readFileSync(Path.join(DataDir, 'genres.json'), 'utf8'))
const initialPrizes: M.IPrize[] = JSON.parse(fs.readFileSync(Path.join(DataDir, 'prizes.json'), 'utf8'));
const initialBooks: M.IBook[] = JSON.parse(fs.readFileSync(Path.join(DataDir, 'books.json'), 'utf8'));
const initialQuizzes: M.IQuiz[] = JSON.parse(fs.readFileSync(Path.join(DataDir, 'quizzes.json'), 'utf8'));
const initialClasses: M.IClass[] = JSON.parse(fs.readFileSync(Path.join(DataDir, 'classes.json'), 'utf8'));

// Configure database

const host = process.env.MONGO_HOST || 'localhost';
const port = process.env.MONGO_PORT || 27017;
const dbName = process.env.MONGO_DB_NAME || 'rr_local';

const connectionStr = `mongodb://${host}:${port}/${dbName}`;
const db = monk.default(connectionStr);


const articlesCollection = db.get('articles', { castIds: false });
const articleVersionsCollection = db.get('article_versions', { castIds: false });
const schoolCollection = db.get('schools', { castIds: false });
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
const initiativeCollection = db.get('initiatives', { castIds: false });
const classInitiativeCollection = db.get('class_initiatives', { castIds: false });
const classCollection = db.get('classes', { castIds: false });

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
  setData(schoolCollection, initialSchools),
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
  setData(bookRequestCollection, []),
  setData(classInitiativeCollection, initialClassInitiatives),
  setData(initiativeCollection, initialInitiatives),
  setData(classCollection, initialClasses),
  setData(articlesCollection, initialArticles),
  setData(articleVersionsCollection, initialArticleVersions)
]).then(() => process.exit(0))