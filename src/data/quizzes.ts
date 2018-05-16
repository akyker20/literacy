import * as monk from 'monk';
import * as shortid from 'shortid';
import * as _ from 'lodash';

export enum QuestionTypes {
  MultipleChoice = 'mc',
  LongAnswer = 'la'
}

export interface IQuestion {
  type: QuestionTypes;
  points: number;
  prompt: string;
}


export interface IMultipleChoiceQuestion extends IQuestion {
  type: QuestionTypes.MultipleChoice;
  correct_answer_index: number;
  possible_answers: string[];
}

export interface ILongAnswerQuestion extends IQuestion {
  type: QuestionTypes.LongAnswer;
}

export interface IQuizBody {
  questions: IQuestion[];
  book_id?: string;
}

export interface IQuiz extends IQuizBody {
  _id?: string;
  date_created: string;
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
  createQuiz: (quiz: IQuizBody) => Promise<IQuiz>;
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

  createQuiz(quiz: IQuizBody): Promise<IQuiz> {
    return this.quizzes.insert(_.assign({}, quiz, {
      _id: shortid.generate(),
      date_created: new Date().toISOString()
    }))
  }

  getQuizForBook(bookId: string): Promise<IQuiz> {
    return this.quizzes.findOne({ book_id: bookId })
  }
  
  async getGenericQuiz (): Promise<IQuiz> {
    const genericQuizzes = await this.quizzes.find({ book: { $exists: false }});
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

  getSubmissionById(submissionId: string): Promise<IQuizSubmission> {
   return this.quizSubmissions.findOne({ _id: submissionId });
 }
}
