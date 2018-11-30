// 3rd party dependencies

import * as _ from 'lodash';
import * as joi from 'joi'
import { Models as M, Constants as SC } from 'reading_rewards'


// internal dependencies

import { IRequest, unwrapData, validateUser } from '../extensions';
import * as Middle from '../../middleware';
import { IArticleData } from '../../data/articles';
import { InternalServerError, BadRequestError } from 'restify-errors';
import { ResourceNotFoundError } from 'restify-errors';
import { IQuizData } from '../../data/quizzes';
import shortid = require('shortid');
import { BodyValidators } from './joi';
import { QuizGraderInstance } from '../../quizzes';
import { IUserData } from '../../data/users';
import { INotificationSys } from '../../notifications';
import { Helpers } from 'reading_rewards';

function getClosestVersion(lexile: number, versions: M.IArticleVersion[]): M.IArticleVersion | null {
  if (_.isEmpty(versions)) {
    return null
  }
  return _.chain(versions)
    .map(version => ({
      version: version,
      diff: Math.abs(lexile - version.lexile_measure)
    }))
    .orderBy('diff', 'asc')
    .first()
    .value()
    .version
}

export function ArticleRoutes(
  userData: IUserData,
  articleData: IArticleData,
  quizData: IQuizData,
  notifications: INotificationSys
) {

  return {

    createArticle: [
      Middle.authenticate,
      Middle.authorize([M.UserType.Admin]),
      Middle.valBody(BodyValidators.ArticleBody),
      unwrapData(async (req: IRequest<M.IArticleBody>) => articleData.createArticle({
        _id: shortid.generate(),
        date_created: new Date().toISOString(),
        ...req.body
      })),
      Middle.handlePromise
    ],

    updateArticle: [
      Middle.authenticate,
      Middle.authorize([M.UserType.Admin]),
      Middle.valBody(BodyValidators.CreatedArticle),
      unwrapData(async (req: IRequest<M.IArticle>) => articleData.updateArticle(req.body)),
      Middle.handlePromise
    ],

    createArticleVersion: [
      Middle.authenticate,
      Middle.authorize([M.UserType.Admin]),
      Middle.valBody(BodyValidators.ArticleVersionBody),
      unwrapData(async (req: IRequest<M.IArticleVersionBody>) => {
        const article = await articleData.getArticleById(req.body.article_id)
        if (article === null) {
          throw new ResourceNotFoundError(`Article ${req.body.article_id} does not exist`)
        }
        return articleData.createArticleVersion({
          _id: shortid.generate(),
          ...req.body
        })
      }),
      Middle.handlePromise
    ],

    updateArticleVersion: [
      Middle.authenticate,
      Middle.authorize([M.UserType.Admin]),
      Middle.valBody(BodyValidators.CreatedArticleVersion),
      unwrapData(async (req: IRequest<M.IArticleVersion>) => articleData.updateArticleVersion(req.body)),
      Middle.handlePromise
    ],

    submitArticleQuiz: [
      Middle.authenticate,
      unwrapData(async (req: IRequest<M.IArticleQuizSubmissionBody>) => {

        const { studentId } = req.params

        const student = await userData.getUserById(studentId);

        validateUser(studentId, student);

        // check submissions

        const submissions = await quizData.getArticleQuizSubmissionsForStudent(studentId);
        const submissionsForArticle = _.filter(submissions, { article_id: req.body.article_id })

        if (!_.isEmpty(submissionsForArticle)) {

          if (Helpers.mustWaitToTakeArticleQuiz(submissionsForArticle)) {
            throw new BadRequestError(`User must wait to attempt another article quiz.`);
          }
  
          if (Helpers.hasPassedArticleQuiz(submissionsForArticle)) {
            throw new BadRequestError(`User has already passed quiz for article ${req.body.article_id}`);
          }
  
          if (Helpers.hasExhaustedAllAttemptsForArticleQuiz(submissionsForArticle)) {
            throw new BadRequestError(`User has exhausted all attempts to pass quiz for article ${req.body.article_id}`);
          }

        }

        const articleVersion = await articleData.getVersionById(req.body.article_version_id)
        if (articleVersion === null) {
          throw new ResourceNotFoundError(`Article Version ${req.body.article_version_id} does not exist`)
        }

        const article = await articleData.getArticleById(req.body.article_id)
        if (article === null) {
          throw new ResourceNotFoundError(`Article ${req.body.article_id} does not exist`)
        }

        // should be the same number of questions as answers

        if (articleVersion.questions.length !== req.body.answers.length) {
          throw new BadRequestError(
            `There are ${articleVersion.questions.length} quiz questions, 
            yet ${req.body.answers.length} answers were submitted`
          );
        }

        // verify answer schema based on question types

        _.forEach(articleVersion.questions, (question, i) => {
          const answer = req.body.answers[i];
          const errorMsg = QuizGraderInstance.isAnswerSchemaValid(question.type, answer);
          if (!_.isNull(errorMsg)) {
            throw new BadRequestError(`The answer to question '${question.prompt}' of type ${question.type} has invalid schema. Error: ${errorMsg}`)
          }
        })

        // build submission and save to database

        const quizScore = QuizGraderInstance.gradeQuiz(articleVersion.questions, req.body.answers);
        const passed = quizScore >= SC.PassingArticleQuizGrade
        
        const quizSubmission: M.IArticleQuizSubmission = {
          _id: shortid.generate(),
          date: new Date().toISOString(),
          num_points: article.num_pts,
          ...req.body,
          score: quizScore,
          passed
        }

        // send slack notification
        let slackMessage = `*${Helpers.getFullName(student)}* ${passed ? 'passed' : 'failied'} quiz for *${article.title}*\n`
        notifications.sendMessage(slackMessage)


        return quizData.createArticleQuizSubmission(quizSubmission)
     
      }),
      Middle.handlePromise
    ],

    getAllArticles: [
      Middle.authenticate,
      unwrapData(async () => articleData.getAllArticles()),
      Middle.handlePromise
    ],

    getArticleDTO: [
      Middle.authenticate,
      Middle.valQueryParams({ 
        name: 'lexile', 
        schema: joi.number().integer().required() 
      }),
      unwrapData(async (req: IRequest<null>) => {
        const { lexile } = req.query
        const { articleId } = req.params

        const article = await articleData.getArticleById(articleId)
        if (article === null) {
          throw new ResourceNotFoundError(`Article ${articleId} not found`)
        }

        const articleVersions = await articleData.getVersionsForArticle(articleId)
        const closestVersion = getClosestVersion(lexile, articleVersions)
        if (closestVersion === null) {
          throw new InternalServerError('Closest Article Version not found')
        }

        return {
          article,
          articleVersion: closestVersion
        } as M.IArticlePageDTO

      }),
      Middle.handlePromise
    ]


  }

}