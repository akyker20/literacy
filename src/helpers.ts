import * as _ from 'lodash';
import { BadRequestError } from 'restify-errors';
import { Next, Request, RequestHandler, Response } from 'restify';
import { Models } from 'reading_rewards';

import { IRequest } from './extensions';
import { DefaultGenreInterestLevel, NumReviewsToBaseCLM } from './constants';

export function isProd(): boolean {
  return process.env.NODE_ENV === 'production';
}

export type PromiseHandler = (req: Request) => Promise<any>;


/**
 * Similar to unwrapVal, but this function wraps an async function which
 * returns a promise that is attached to the req.promise field which can
 * later be processed (resolved/rejected) in handlePromise middleware.
 * @param handler
 */
export function unwrapData(handler: PromiseHandler): RequestHandler {
  return (req: IRequest<any>, res: Response, next: Next) => {
    req.promise = handler(req);
    next();
  };
}

/**
 * Clients should not receive a joi error.
 * They should receive something simpler:
 * i.e. 'Invalid/missing field user_name'
 * @param fieldName
 */
export function genFieldErr(fieldName: string): Error {
  return new BadRequestError(`Invalid/missing field ${fieldName}`);
}

export function getLexileRange(measure: number): Models.ILexileRange {
  return {
    min: measure - 100,
    max: measure + 50
  };
}

export function computeCurrentLexileMeasure(
  initialLexileMeasure: number,
  bookReviews: Models.IBookReview[]
): number {

  // if user has less than 3 submitted quizzes with comprehension scores
  // just use the initial lexile measure
  if (bookReviews.length < NumReviewsToBaseCLM) {
    return initialLexileMeasure;
  }

  const recentReviews = _.chain(bookReviews)
    .orderBy('date_created', 'desc')
    .slice(0, NumReviewsToBaseCLM)
    .value();

  return _.reduce(recentReviews, (total, review) => {
    const adjustedLexileSignal = review.book_lexile_measure + 50 * (review.comprehension - 4);
    return total + adjustedLexileSignal;
  }, 0) / recentReviews.length;

}

function computeLexileMultiplier(lexileDiff: number) {
  if (lexileDiff <= -300 || lexileDiff > 250) {
    return 0.1;
  } else if (lexileDiff > -300 && lexileDiff <= -100) {
    return (-0.9/Math.pow(200, 2)) * Math.pow((lexileDiff + 100), 2) + 1.0
  } else if (lexileDiff > 50 && lexileDiff <= 250) {
    return 1 - 0.9/200 * (lexileDiff - 50)
  } else {
    return 1;
  }
}

const FactorWeights = {
  AmazonPopularity: 1,
  AvgBookRatingByRRStudents: 2,
  StudentsAvgRatingOfOtherBooksBySameAuthor: 3,
  StudentAvgGenreInterest: 2
}

/**
 * 
 * @param bookReviews all reviews for the book
 * @param student  contains student genre interests and lexile measure
 * @param studentBookReviews the reviews of books by the student, used to compute current lexile measure
 * @param book contains book lexile measure, and amazon popularity, and genres
 */
export function computeMatchScoreForBook(
  book: Models.IBook,
  student: Models.IStudent,
  otherBooksBySameAuthor: Models.IBook[],
  studentBookReviews: Models.IBookReview[],
  bookReviews: Models.IBookReview[]
): number {

  console.log(`Computing Match Score for ${book.title}`)

  // compute lexile multiplier which we be multiplied at the end

  const studentCLM = computeCurrentLexileMeasure(student.initial_lexile_measure, studentBookReviews);
  console.log(`Student CLM: ${studentCLM}`)
  const lexileDiff = book.lexile_measure - studentCLM;
  console.log(`Book Lexile Diff: ${lexileDiff}`)
  const lexileMult = computeLexileMultiplier(lexileDiff);
  console.log(`Computed Lexile Mult: ${lexileMult}`)

  let weight = 0;
  let matchSum = 0;

  // compute normalized world popularity
  // any books that have over 4.2/5 are considered perfect.
  // Everything under 4.2 is divided by 4.2.
  const amazonPopPerfectThresh = 4.5;
  const normalizedAmazonPopularity = (book.amazon_popularity >= amazonPopPerfectThresh) ? 1.0 : book.amazon_popularity / amazonPopPerfectThresh;
  console.log('amazon pop: ' + normalizedAmazonPopularity);
  weight += FactorWeights.AmazonPopularity;
  matchSum += FactorWeights.AmazonPopularity * normalizedAmazonPopularity;

  // compute normalized average popularity of books by ReadingReward.org students

  if (!_.isEmpty(bookReviews)) {
    const normalizedAvgRatingForBook = _.meanBy(bookReviews, 'interest') / 5.0;
    console.log('Average Student Rating of Book: ' + normalizedAmazonPopularity);
    weight += FactorWeights.AvgBookRatingByRRStudents;
    matchSum += FactorWeights.AvgBookRatingByRRStudents * normalizedAvgRatingForBook;
  }

  // compute normalized average rating by student of other books by same author

  const idsOfBooksBySameAuthor = _.map(otherBooksBySameAuthor, '_id');
  const studentReviewsOfOtherBooksBySameAuthor = _.filter(studentBookReviews, 
    br => _.includes(idsOfBooksBySameAuthor, br.book_id));
  if (!_.isEmpty(studentReviewsOfOtherBooksBySameAuthor)) {
    const normalizedStudentsAvgRatingOfOtherBooksBySameAuthor = _.meanBy(studentReviewsOfOtherBooksBySameAuthor, 'interest') / 5.0;
    console.log('Average student rating of other books by author: ' + normalizedAmazonPopularity);
    weight += FactorWeights.StudentsAvgRatingOfOtherBooksBySameAuthor;
    matchSum += FactorWeights.StudentsAvgRatingOfOtherBooksBySameAuthor * normalizedStudentsAvgRatingOfOtherBooksBySameAuthor;
  }

  // compute normalized average genre interest level (max interest level is 4.0)

  const numGenresForBook = book.genres.length;
  if (numGenresForBook > 0) {
    const normalizedAvgGenreInterest = _.sumBy(book.genres, genreId => {
      if (genreId in student.genre_interests) {
        const interestLevel = student.genre_interests[genreId];
        if (interestLevel >= 3) {
          return 4;
        } else if (interestLevel === 2) {
          return 3;
        }
        return interestLevel;
      }
      return DefaultGenreInterestLevel;
    }) / (4.0 * numGenresForBook); // max genre interest level is 4
    console.log('Average Genre Interest: ' + normalizedAvgGenreInterest);
    weight += FactorWeights.StudentAvgGenreInterest;
    matchSum += FactorWeights.StudentAvgGenreInterest * normalizedAvgGenreInterest;
  }

  const interestLevel = matchSum / weight;

  console.log('interest level: ' + interestLevel)

  const matchScore = interestLevel * lexileMult;

  console.log('matchScore: ' + matchScore)

  return matchScore;

}