import * as monk from 'monk';
import * as Path from 'path';
import * as fs from 'fs';
import { Models as M } from 'reading_rewards';

const DataDir = (process.env.NODE_ENV === 'production') ?
  Path.join(__dirname, '../bootstrap_prod_data') :
  Path.join(__dirname, '../bootstrap_dev_data');


const initialArticles: M.IArticle[] = JSON.parse(fs.readFileSync(Path.join(DataDir, 'articles.json'), 'utf8'))
const initialArticleVersions: M.IArticleVersion[] = JSON.parse(fs.readFileSync(Path.join(DataDir, 'article_versions.json'), 'utf8'))

// Configure database

const host = process.env.MONGO_HOST || 'localhost';
const port = process.env.MONGO_PORT || 27017;
const dbName = process.env.MONGO_DB_NAME || 'rr_local';

const connectionStr = `mongodb://${host}:${port}/${dbName}`;
const db = monk.default(connectionStr);


const articlesCollection = db.get('articles', { castIds: false });
const articleVersionsCollection = db.get('article_versions', { castIds: false });

async function setData(collection: monk.ICollection, data: any) {
  await collection.drop();
  await collection.insert(data);
}

Promise.all([
  setData(articlesCollection, initialArticles),
  setData(articleVersionsCollection, initialArticleVersions)
]).then(() => process.exit(0))