import * as monk from 'monk';
import * as shortid from 'shortid';
import * as _ from 'lodash';

import { Models as M } from 'reading_rewards';

type IQuizSubmission = M.IQuizSubmission;
type IQuiz = M.IQuiz;

export interface IQuizData {
  createQuiz: (quiz: IQuiz) => Promise<IQuiz>;
  getQuizForBook: (bookId: string) => Promise<IQuiz>;
  getGenericQuiz: () => Promise<IQuiz>;
  getQuizById: (quizId: string) => Promise<IQuiz>;
  deleteQuiz: (quizId: string) => Promise<IQuiz>;
  updateQuiz: (quiz: IQuiz) => Promise<IQuiz>;
  getAllQuizzes: () => Promise<IQuiz[]>;

  createQuizSubmission: (quizSubmission: IQuizSubmission) => Promise<IQuizSubmission>;
  getSubmissionById: (submissionId: string) => Promise<IQuizSubmission>;
  getSubmissionsForQuiz: (quizId: string) => Promise<IQuizSubmission[]>;
  getSubmissionsForStudent: (userId: string) => Promise<IQuizSubmission[]>;
  getSubmissionsForStudents: (studentIds: string[]) => Promise<IQuizSubmission[]>;
  updateQuizSubmission: (quizSubmission: IQuizSubmission) => Promise<IQuizSubmission>;
  getAllBookQuizSubmissions: () => Promise<IQuizSubmission[]>

  createArticleQuizSubmission: (articleQuizSub: M.IArticleQuizSubmission) => Promise<M.IArticleQuizSubmission>
  getArticleQuizSubmissionsForStudent: (studentId: string) => Promise<M.IArticleQuizSubmission[]>
  getAllArticleQuizSubmissions: () => Promise<M.IArticleQuizSubmission[]>
  
}

export class MongoQuizData implements IQuizData {

  private quizzes: monk.ICollection;
  private bookQuizSubmissions: monk.ICollection;
  private articleQuizSubmissions: monk.ICollection;
  

  constructor(mongoConnectionStr: string) {
    let db = monk.default(mongoConnectionStr);
    this.quizzes = db.get('quizzes', { castIds: false });
    this.bookQuizSubmissions = db.get('quiz_submissions', { castIds: false });
    this.articleQuizSubmissions = db.get('article_quiz_submissions', { castIds: false })
  }

  createArticleQuizSubmission(sub: M.IArticleQuizSubmission) {
    return this.articleQuizSubmissions.insert(sub)
  }

  getArticleQuizSubmissionsForStudent(studentId: string) {
    return this.articleQuizSubmissions.find({ student_id: studentId })
  }

  getAllArticleQuizSubmissions() {
    return this.articleQuizSubmissions.find({})
  }

  // Quiz Related

  createQuiz(quiz: IQuiz): Promise<IQuiz> {
    const copy: IQuiz = _.cloneDeep(quiz);
    copy._id = shortid.generate();
    return this.quizzes.insert(copy);
  }

  getAllQuizzes(): Promise<IQuiz[]> {
    return this.quizzes.find({});
  }

  getQuizById(quizId: string): Promise<IQuiz> {
    return this.quizzes.findOne({ _id: quizId })
  }

  getQuizForBook(bookId: string): Promise<IQuiz> {
    return this.quizzes.findOne({ book_id: bookId })
  }

  async getGenericQuiz(): Promise<IQuiz> {
    const genericQuizzes = await this.quizzes.find({ book_id: { $exists: false } });
    return _.sample(genericQuizzes);
  }

  updateQuiz(quiz: IQuiz): Promise<IQuiz> {
    return this.quizzes.findOneAndUpdate({ _id: quiz._id }, quiz)
  }

  deleteQuiz(quizId: string): Promise<IQuiz> {
    return this.quizzes.findOneAndDelete({ _id: quizId })
  }

  // Quiz Submission Related

  createQuizSubmission(quizSubmission: IQuizSubmission): Promise<IQuizSubmission> {
    const copy = _.cloneDeep(quizSubmission);
    copy._id = shortid.generate();
    return this.bookQuizSubmissions.insert(copy);
  }

  updateQuizSubmission(quizSubmission: IQuizSubmission): Promise<IQuizSubmission> {
    return this.bookQuizSubmissions.findOneAndUpdate({ _id: quizSubmission._id }, quizSubmission);
  }

  getAllBookQuizSubmissions() {
    return this.bookQuizSubmissions.find({})
  }

  getSubmissionById(submissionId: string): Promise<IQuizSubmission> {
    return this.bookQuizSubmissions.findOne({ _id: submissionId });
  }

  getSubmissionsForQuiz(quizId: string): Promise<IQuizSubmission[]> {
    return this.bookQuizSubmissions.find({ quiz_id: quizId });
  }

  getSubmissionsForStudent(studentId: string): Promise<IQuizSubmission[]> {
    return this.bookQuizSubmissions.find({ student_id: studentId });
  }

  getSubmissionsForStudents(studentIds: string[]): Promise<IQuizSubmission[]> {
    return this.bookQuizSubmissions.find({ student_id: { $in: studentIds } });
  }

}
