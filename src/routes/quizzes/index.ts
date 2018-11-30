import * as _ from 'lodash';
import { ResourceNotFoundError, BadRequestError } from 'restify-errors';
import { Models as M, Constants as SC, Helpers } from 'reading_rewards';

import {
  IRequest,
  unwrapData,
  validateUser
} from '../extensions';
import * as Middle from '../../middleware';
import { IUserData } from '../../data/users';
import { IQuizData } from '../../data/quizzes';
import { IBookData } from '../../data/books';
import { QuizGraderInstance } from '../../quizzes';
import { INotificationSys } from '../../notifications';
import { IEmail, IEmailContent } from '../../email';
import { EmailTemplates } from '../../email/templates';
import { BodyValidators as Val } from './joi';
import { IReadingLogData } from '../../data/reading_log';


export function QuizRoutes(
  userData: IUserData,
  quizData: IQuizData,
  bookData: IBookData,
  readingLogData: IReadingLogData,
  notifications: INotificationSys,
  email: IEmail
) {

  async function isBookValid(quiz: M.IQuizBody): Promise<boolean> {
    if (quiz.book_id) {
      const book = await bookData.getBook(quiz.book_id);
      return !_.isNull(book);
    }
    return true;
  }

  return {

    // Quiz Related Routes

    createQuiz: [
      Middle.authenticate,
      Middle.authorize([M.UserType.Admin]),
      Middle.valBody<M.IQuizBody>(Val.InputQuizSchema),
      unwrapData(async (req: IRequest<M.IQuizBody>) => {

        const candidateQuiz = req.body;

        // ensure book is valid

        if (!(await isBookValid(candidateQuiz))) {
          throw new ResourceNotFoundError(`No book with id ${candidateQuiz.book_id} exists`);
        }

        // validate question schemas

        _.forEach(candidateQuiz.questions, question => {
          const errorMsg = QuizGraderInstance.isQuestionSchemaValid(question);
          if (!_.isNull(errorMsg)) {
            throw new BadRequestError(`Question with prompt '${question.prompt}' is not a valid ${question.type} question. Error: ${errorMsg}`);
          }
        })

        const newQuiz: M.IQuiz = {
          ...candidateQuiz,
          date_created: new Date().toISOString()
        }

        return await quizData.createQuiz(newQuiz);

      }),
      Middle.handlePromise
    ],
    updateQuiz: [
      Middle.authenticate,
      Middle.authorize([M.UserType.Admin]),
      Middle.valBody(Val.CreatedQuizSchema),
      Middle.valIdsSame({ paramKey: 'quizId', bodyKey: '_id' }),
      unwrapData(async (req: IRequest<M.IQuiz>) => {

        if (!(await isBookValid(req.body))) {
          throw new ResourceNotFoundError(`No book with id ${req.body.book_id} exists`);
        }

        const updatedQuiz = await quizData.updateQuiz(req.body);

        if (_.isEmpty(updatedQuiz)) {
          throw new ResourceNotFoundError('No quiz was updated')
        }

        return { updatedQuiz };

      }),
      Middle.handlePromise
    ],
    deleteQuiz: [
      Middle.authenticate,
      Middle.authorize([M.UserType.Admin]),
      unwrapData(async (req: IRequest<M.IQuiz>) => {

        const deletedQuiz = await quizData.deleteQuiz(req.params.quizId);

        if (_.isNull(deletedQuiz)) {
          throw new ResourceNotFoundError('No quiz was deleted')
        }

        return { deletedQuiz };

      }),
      Middle.handlePromise
    ],

    getAllQuizzes: [
      Middle.authenticate,
      Middle.authorize([M.UserType.Admin]),
      unwrapData(async () => quizData.getAllQuizzes()),
      Middle.handlePromise
    ],

    // Quiz Submission Related Routes

    submitQuiz: [
      Middle.authenticate,
      Middle.authorize([M.UserType.Admin, M.UserType.Student]),
      Middle.authorizeAgents([M.UserType.Admin]),
      Middle.valBody<M.IQuizSubmissionBody>(Val.QuizSubmissionSchema),
      Middle.valIdsSame({ paramKey: 'userId', bodyKey: 'student_id' }),
      unwrapData(async (req: IRequest<M.IQuizSubmissionBody>) => {

        const { student_id, book_id } = req.body;

        // verify user exists

        const student = await userData.getUserById(student_id) as M.IStudent;
        validateUser(student_id, student);

        // verify book exists

        const book = await bookData.getBook(req.body.book_id);

        if (book === null) {
          throw new ResourceNotFoundError(`No book with id ${req.body.book_id} exists`)
        }

        // verify quiz exists

        const quiz = await quizData.getQuizById(req.body.quiz_id);

        if (quiz === null) {
          throw new ResourceNotFoundError(`No quiz with id ${req.body.quiz_id} exists`)
        }

        // ensure finished reading log exists for the book.

        const studentLogs = await readingLogData.getLogsForStudent(student_id);
        const finalLogForBook = _.find(studentLogs, {
          book_id,
          is_last_log_for_book: true
        })
        if (_.isUndefined(finalLogForBook)) {
          throw new BadRequestError(`Student ${Helpers.getFullName(student)} has not logged to the end of ${book.title}`)
        }

        // check submissions

        const submissions = await quizData.getSubmissionsForStudent(student_id);

        if (Helpers.needsToWaitToTakeNextQuiz(submissions)) {
          throw new BadRequestError(`User must wait to attempt another quiz.`);
        }

        if (Helpers.hasPassedQuizForBook(book_id, submissions)) {
          throw new BadRequestError(`User has already passed quiz for book ${req.body.book_id}`);
        }

        if (Helpers.hasExhaustedAttemptsForBook(book_id, submissions)) {
          throw new BadRequestError(`User has exhausted all attempts to pass quiz for book ${req.body.book_id}`);
        }

        // should be the same number of questions as answers

        if (quiz.questions.length !== req.body.answers.length) {
          throw new BadRequestError(
            `There are ${quiz.questions.length} quiz questions, 
            yet ${req.body.answers.length} answers were submitted`
          );
        }

        // verify answer schema based on question types

        _.forEach(quiz.questions, (question, i) => {
          const answer = req.body.answers[i];
          const errorMsg = QuizGraderInstance.isAnswerSchemaValid(question.type, answer);
          if (!_.isNull(errorMsg)) {
            throw new BadRequestError(`The answer to question '${question.prompt}' of type ${question.type} has invalid schema. Error: ${errorMsg}`)
          }
        })

        // build submission and save to database

        const quizScore = QuizGraderInstance.gradeQuiz(quiz.questions, req.body.answers);

        const quizSubmission: M.IQuizSubmission = {
          ...req.body,
          date_created: new Date().toISOString(),
          score: quizScore,
          passed: quizScore >= SC.PassingQuizGrade,
          book_title: book.title
        }

        // send slack notification

        let slackMessage = `*${Helpers.getFullName(student)}* submitted quiz for *${book.title}*\n`;
        _.forEach(quiz.questions, (question, index) => {
          slackMessage += `_${question.prompt}_\n`;
          switch (question.type) {
            case M.QuestionTypes.LongAnswer:
              slackMessage += `${(quizSubmission.answers[index] as M.ILongAnswerAnswer).response}\n`;
              break;
            case M.QuestionTypes.MultipleChoice:
              let answerIndex = (quizSubmission.answers[index] as M.IMultipleChoiceAnswer).answer_index;
              slackMessage += `${(question as M.IMultipleChoiceQuestion).options[answerIndex]}\n`;
              break;
            default:
          }
        })
        notifications.sendMessage(slackMessage);

        // email notifications

        const attemptNum = _.filter(submissions, { book_id }).length + 1;
        const emailContent: IEmailContent = EmailTemplates.buildQuizSubEmail(student, quizSubmission, attemptNum);

        const educator = await userData.getEducatorOfStudent(student_id);
        if (!_.isNull(educator) && educator.notification_settings.quiz_submissions) {
          email.sendMail(educator.email, emailContent)
        }

        email.sendAdminEmail(emailContent);

        // submit quiz submission

        return quizData.createQuizSubmission(quizSubmission);

      }),
      Middle.handlePromise
    ],

    getQuizForBook: [
      Middle.authenticate,
      unwrapData(async (req: IRequest<M.IQuiz>) => {

        const { bookId } = req.params;

        const book = await bookData.getBook(bookId);
        if (_.isNull(book)) {
          throw new ResourceNotFoundError(`Book ${bookId} does not exist.`)
        }

        const bookQuiz = await quizData.getQuizForBook(bookId);

        if (!_.isNull(bookQuiz)) {
          return bookQuiz;
        }

        return await quizData.getGenericQuiz();

      }),
      Middle.handlePromise
    ]

  }

}