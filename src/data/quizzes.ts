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

  submitQuiz: (quizSubmission: IQuizSubmission) => Promise<IQuizSubmission>;
  updateQuizSubmission: (quizSubmission: IQuizSubmission) => Promise<IQuizSubmission>;
  getSubmissionsForQuiz: (quizId: string) => Promise<IQuizSubmission[]>;
  getSubmissionsForStudent: (userId: string) => Promise<IQuizSubmission[]>;
  getSubmissionsForStudents: (studentIds: string[]) => Promise<IQuizSubmission[]>;
  getSubmissionById: (submissionId: string) => Promise<IQuizSubmission>;
}

export class MongoQuizData implements IQuizData {
  
  private quizzes: monk.ICollection;
  private quizSubmissions: monk.ICollection; 

  constructor(mongoConnectionStr: string) {
    let db = monk.default(mongoConnectionStr);
    this.quizzes = db.get('quizzes', { castIds: false });
    this.quizSubmissions = db.get('quiz_submissions', { castIds: false });
  }

  // Quiz Related

  getAllQuizzes(): Promise<IQuiz[]> {
    return this.quizzes.find({});
  }

  getQuizById(quizId: string): Promise<IQuiz> {
    return this.quizzes.findOne({ _id: quizId })
  }

  createQuiz(quiz: IQuiz): Promise<IQuiz> {
    const copy: IQuiz = _.cloneDeep(quiz);
    copy._id = shortid.generate();
    return this.quizzes.insert(copy);
  }

  getQuizForBook(bookId: string): Promise<IQuiz> {
    return this.quizzes.findOne({ book_id: bookId })
  }
  
  async getGenericQuiz (): Promise<IQuiz> {
    const genericQuizzes = await this.quizzes.find({ book_id: { $exists: false }});
    return _.sample(genericQuizzes);
  }
  
  deleteQuiz(quizId: string): Promise<IQuiz> {
    return this.quizzes.findOneAndDelete({ _id: quizId })
  }

  updateQuiz(quiz: IQuiz): Promise<IQuiz> {
    return this.quizzes.findOneAndUpdate({ _id: quiz._id }, quiz)
  }

  // Quiz Submission Related

  submitQuiz(quizSubmission: IQuizSubmission): Promise<IQuizSubmission> {
    const copy = _.cloneDeep(quizSubmission);
    copy._id = shortid.generate();
    return this.quizSubmissions.insert(copy);
  }

  updateQuizSubmission(quizSubmission: IQuizSubmission): Promise<IQuizSubmission> {
    return this.quizSubmissions.findOneAndUpdate({ _id: quizSubmission._id }, quizSubmission);
  }

  getSubmissionsForQuiz(quizId: string): Promise<IQuizSubmission[]> {
    return this.quizSubmissions.find({ quiz_id: quizId });
  }

  getSubmissionsForStudent(studentId: string): Promise<IQuizSubmission[]> {
    return this.quizSubmissions.find({ student_id: studentId });
  }

  getSubmissionsForStudents(studentIds: string[]): Promise<IQuizSubmission[]> {
    return this.quizSubmissions.find({ student_id: { $in: studentIds }});
  }

  getSubmissionById(submissionId: string): Promise<IQuizSubmission> {
   return this.quizSubmissions.findOne({ _id: submissionId });
 }
}
