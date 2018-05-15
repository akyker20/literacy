import * as monk from 'monk';
import * as _ from 'lodash';

export enum QuestionTypes {
  MultipleChoice = 'mc',
  LongAnswer = 'la'
}

export interface IQuestion {
  type: QuestionTypes;
  question: string;
}

export interface IMultipleChoiceQuestion extends IQuestion {
  type: QuestionTypes.MultipleChoice;
  correct_answer_index: number;
  possible_answers: string[];
}

export interface ILongAnswerQuestion extends IQuestion {
  type: QuestionTypes.LongAnswer;
}

export interface IQuiz {
  _id?: string;
  book?: string;
  date_created: string;
  questions: IQuestion[];
}

export interface IQuizSubmissionBody {
  quiz_id: string;
  student_id: string;
  book_id: string;
  answers: any[];
}

export interface IQuizSubmission extends IQuizSubmissionBody {
  _id?: string;
  passed: boolean;
  date_submitted: string;
  book_lexile_score: number;
  comprehension?: 1|2|3|4|5;
}

export interface IQuizData {
  createQuiz: (quiz: IQuiz) => Promise<IQuiz>;
  getQuizForBook: (bookId: string) => Promise<IQuiz>;
  getGenericQuiz: () => Promise<IQuiz>;
  deleteQuiz: (quizId: string) => Promise<IQuiz>;
  updateQuiz: (quiz: IQuiz) => Promise<IQuiz>;

  submitQuiz: (quizSubmission: IQuizSubmission) => Promise<IQuizSubmission>;
  updateQuizSubmission: (quizSubmission: IQuizSubmission) => Promise<IQuizSubmission>;
  getSubmissionsForQuiz: (quizId: string) => Promise<IQuizSubmission[]>;
  getSubmissionsForUser: (userId: string) => Promise<IQuizSubmission[]>;
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

  createQuiz(quiz: IQuiz): Promise<IQuiz> {
    return this.quizzes.insert(quiz);
  }

  getQuizForBook(bookId: string): Promise<IQuiz> {
    return this.quizzes.findOne({ book: bookId })
  }
  
  async getGenericQuiz (): Promise<IQuiz> {
    const genericQuizzes = this.quizzes.find({ book: { $exists: false }});
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
    return this.quizSubmissions.insert(quizSubmission);
  }

  updateQuizSubmission(quizSubmission: IQuizSubmission): Promise<IQuizSubmission> {
    return this.quizSubmissions.findOneAndUpdate({ _id: quizSubmission._id }, quizSubmission);
  }

  getSubmissionsForQuiz(quizId: string): Promise<IQuizSubmission[]> {
    return this.quizSubmissions.find({ quiz_id: quizId });
  }

  getSubmissionsForUser(userId: string): Promise<IQuizSubmission[]> {
    return this.quizSubmissions.find({ user_id: userId });
  }

  getSubmissionById(submissionId: string): Promise<IQuizSubmission> {
   return this.quizSubmissions.findOne({ _id: submissionId });
 }
}
