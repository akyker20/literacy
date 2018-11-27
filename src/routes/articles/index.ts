// 3rd party dependencies

import * as _ from 'lodash';
import * as joi from 'joi'
import { Models as M } from 'reading_rewards'


// internal dependencies

import { IRequest, unwrapData } from '../extensions';
import * as Middle from '../../middleware';
import { IArticleData } from '../../data/articles';
import { InternalServerError } from 'restify-errors';
import { ResourceNotFoundError } from 'restify-errors';
import { IQuizData } from '../../data/quizzes';
import shortid = require('shortid');
import { BodyValidators } from './joi';

function getClosestVersion(lexile: number, versions: M.IArticleVersion[]): M.IArticleVersion | null {
  if (_.isEmpty(versions)) {
    return null
  }
  return _.chain(versions)
    .map(version => ({
      version: version,
      diff: Math.abs(lexile = version.lexile_measure)
    }))
    .orderBy('diff', 'asc')
    .first()
    .value()
    .version
}

export function ArticleRoutes(
  articleData: IArticleData,
  quizData: IQuizData
) {

  return {

    createArticle: [
      Middle.authenticate,
      Middle.authorize([M.UserType.Admin]),
      Middle.valBody(BodyValidators.ArticleBody),
      unwrapData(async (req: IRequest<M.IArticle>) => articleData.createArticle(req.body)),
      Middle.handlePromise
    ],

    updateArticle: [
      Middle.authenticate,
      Middle.authorize([M.UserType.Admin]),
      Middle.valBody(BodyValidators.CreatedArticle),
      unwrapData(async (req: IRequest<M.IArticle>) => articleData.updateArticle(req.body)),
      Middle.handlePromise
    ],

    submitArticleQuiz: [
      Middle.authenticate,
      unwrapData(async (req: IRequest<M.IArticleQuizSubmissionBody>) => {
        const quizSub: M.IArticleQuizSubmission = {
          _id: shortid.generate(),
          date: new Date().toISOString(),
          num_points: 25,
          passed: true,
          score: 90,
          ...req.body,
        }
        return quizData.createArticleQuizSubmission(quizSub)
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