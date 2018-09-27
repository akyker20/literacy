// 3rd party dependencies

import { Models as M } from 'reading_rewards';
import * as _ from 'lodash';
import { ResourceNotFoundError } from 'restify-errors';

// internal dependencies

import { IRequest, unwrapData } from '../extensions';
import * as Middle from '../../middleware';
import { IUserData } from '../../data/users';
import { ForbiddenError } from 'restify-errors';
import { IQuizData } from '../../data/quizzes';
import { IClassInitiativeData } from '../../data/initiatives';
import { IBookData } from '../../data/books';

export function InitiativeRoutes(
  bookData: IBookData,
  initiativeData: IClassInitiativeData,
  quizData: IQuizData,
  userData: IUserData
) {

  return {

    getClassInitiative: [
      Middle.authenticate,
      unwrapData(async (req: IRequest<null>) => {

        const { classId } = req.params;

        const classFromId = await userData.getClassById(classId);
        if (_.isNull(classFromId)) {
          throw new ResourceNotFoundError(`No class ${classId} exists.`)
        }

        const { _id: requesterId, type: requesterType } = req.authToken;
        if (requesterType === M.UserType.Student && !_.includes(classFromId.student_ids, requesterId)) {
          throw new ForbiddenError(`Student ${requesterId} is not in class ${classId}`);
        } else if (requesterType === M.UserType.Educator && requesterId !== classFromId.teacher_id) {
          throw new ForbiddenError(`Educator ${requesterId} does not teach class ${classId}`);
        }

        const initiative = await initiativeData.getInitiativeForClass(classId);
        if (_.isNull(initiative)) {
          throw new ForbiddenError(`No initiative found for class ${classId}`);
        }

        const quizSubmissions = await quizData.getSubmissionsForStudents(classFromId.student_ids);
        const passedQuizSubmissions = _.filter(quizSubmissions, { passed: true });

        
        const uniqBookIdsForPassedQuizzes = _.chain(passedQuizSubmissions)
          .map('book_id')
          .uniq()
          .value()

        const books = await bookData.getBooksWithIds(uniqBookIdsForPassedQuizzes);
        
        const contributions: M.IContribution[] = _.chain(quizSubmissions)
          .filter({ passed: true })
          .map((submission: M.IQuizSubmission) => {
            const book = _.find(books, { _id: submission.book_id })
            return {
              date: submission.date_created,
              book_title: submission.book_title,
              book_cover_photo_url: book.cover_photo_url,
              book_num_pages: book.num_pages
            }
          })
          .value()

        return <M.IClassInitiativeDTO> {
          initiative,
          contributions
        }
        
      }),
      Middle.handlePromise
    ],

  }

}