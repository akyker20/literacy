import App from '.';
import { MongoUserData } from "./data/users";
import { MongoBookData } from "./data/books";
import { MongoQuizData } from "./data/quizzes";
import { MongoBookReviewData } from "./data/book_reviews";
import { MongoGenreData } from "./data/genres";
import { MongoPrizeOrderData } from './data/prize_orders';
import { MongoPrizeData } from './data/prizes';
import { SlackNotifications } from './notifications/slack';
import { isProd } from './helpers';
import { MongoReadingLogData } from './data/reading_log';

const dbHost = process.env.MONGO_HOST || 'localhost';
const dbPort = process.env.MONGO_PORT || '27017';
const dbName = process.env.MONGO_DB_NAME || 'local';

const connectionStr = `mongodb://${dbHost}:${dbPort}/${dbName}`;

const mongoBookData = new MongoBookData(connectionStr);
const mongoUserData = new MongoUserData(connectionStr);
const mongoGenreData = new MongoGenreData(connectionStr);
const mongoQuizData = new MongoQuizData(connectionStr);
const mongoBookReviewData = new MongoBookReviewData(connectionStr);
const mongoPrizeOrderData = new MongoPrizeOrderData(connectionStr);
const mongoPrizeData = new MongoPrizeData(connectionStr);
const readingLogData = new MongoReadingLogData(connectionStr);

const prodEventsSlackWebhookUrl = 'https://hooks.slack.com/services/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';
const devChannelSlackWebhookUrl = 'https://hooks.slack.com/services/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';
const slackWebhookUrl = isProd() ?
  prodEventsSlackWebhookUrl :
  devChannelSlackWebhookUrl;
const slackNotifications = new SlackNotifications(slackWebhookUrl);


const app = new App(
  mongoBookData,
  mongoUserData,
  mongoGenreData,
  mongoQuizData,
  mongoBookReviewData,
  mongoPrizeData,
  mongoPrizeOrderData,
  readingLogData,
  slackNotifications
)

app.listen(5000);