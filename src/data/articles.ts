import * as monk from 'monk';
import { Models as M } from 'reading_rewards';

export interface IArticleData {
  createArticle: (article: M.IArticle) => Promise<M.IArticle>;
  updateArticle: (article: M.IArticle) => Promise<M.IArticle>;
  getAllArticles: () => Promise<M.IArticle[]>;
  getArticleById: (id: string) => Promise<M.IArticle>;
  getVersionsForArticle: (articleId: string) => Promise<M.IArticleVersion[]>;
}

export class MongoArticleData implements IArticleData {

  private articles: monk.ICollection;
  private articleVersions: monk.ICollection;

  constructor(mongoConnectionStr: string) {
    let db = monk.default(mongoConnectionStr);
    this.articles = db.get('articles', { castIds: false });
    this.articleVersions = db.get('article_versions', { castIds: false })
  }

  public createArticle(article: M.IArticle) {
    return this.articles.insert(article)
  }

  public updateArticle(article: M.IArticle) {
    return this.articles.findOneAndUpdate({ _id: article._id }, article)
  }

  public getArticleById(id: string) {
    return this.articles.findOne({ _id: id })
  }

  public getAllArticles() {
    return this.articles.find({});
  }

  public getVersionsForArticle(articleId: string) {
    return this.articleVersions.find({ article_id: articleId })
  }

}
