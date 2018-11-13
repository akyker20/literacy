import * as _ from 'lodash';
import { Models } from 'reading_rewards';

import { DefaultGenreInterestLevel } from './constants';

export function isProd(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Computes a number between 0 and 1 that will be multiplied by the raw interest
 * score computed for a student, book pair.
 * In general, the multiplier will be closer to 1 for books that are in the student's lexile
 * range and closer to 0, far away
 * The multiplier decreases linearly (fast) when diff exceeds 50
 * The multiplier decreases quadratically (slower) when diff is less than -100
 * The smallest the multiplier gets is 0.1
 * The multiplier is 1 just above the students clm
 * @param lexileDiff the difference between student's clm and book's lexile measure
 */
function computeLexileMultiplier(lexileDiff: number) {
  if (lexileDiff <= -300 || lexileDiff > 250) {
    return 0.1;
  } else if (lexileDiff > -300 && lexileDiff <= -100) {
    return (-0.9/Math.pow(200, 2)) * Math.pow((lexileDiff + 100), 2) + 1.0
  } else if (lexileDiff > 50 && lexileDiff <= 250) {
    return 1 - 0.9/200 * (lexileDiff - 50)
  } else if (lexileDiff < 0) {
    return 0.9;
  } else {
    return 1;
  }
}

const FactorWeights = {
  GoodReadsRating: 1,
  AvgBookRatingByRRStudents: 2,
  StudentsAvgRatingOfOtherBooksBySameAuthor: 3,
  StudentAvgGenreInterest: 2
}

/**
 * 
 * @param bookReviews all reviews for the book
 * @param student  contains student genre interests and lexile measure
 * @param studentBookReviews the reviews of books by the student, used to compute current lexile measure
 * @param book contains book lexile measure, and goodreads rating, and genres
 */
export function computeMatchScoreForBook(
  book: Models.IBook,
  student: Models.IStudent,
  otherBooksBySameAuthor: Models.IBook[],
  studentBookReviews: Models.IBookReview[],
  bookReviews: Models.IBookReview[]
): number {

  // console.log(`Computing Match Score for ${book.title}`)

  // compute lexile multiplier which we be multiplied at the end

  const studentLM = student.initial_lexile_measure;
  // console.log(`Student CLM: ${studentCLM}`)
  const lexileDiff = book.lexile_measure - studentLM;
  // console.log(`Book Lexile Diff: ${lexileDiff}`)
  const lexileMult = computeLexileMultiplier(lexileDiff);
  // console.log(`Computed Lexile Mult: ${lexileMult}`)

  let weight = 0;
  let matchSum = 0;

  // compute normalized world popularity
  // any books that have over 4.2/5 are considered perfect.
  // Everything under 4.2 is divided by 4.2.
  const goodreadsRatingPerfectThresh = 4.5;
  const normalizedGoodreadsRating = (book.goodreads_rating >= goodreadsRatingPerfectThresh) ? 1.0 : book.goodreads_rating / goodreadsRatingPerfectThresh;
  // console.log('goodreads rating: ' + normalizedGoodreadsRating);
  weight += FactorWeights.GoodReadsRating;
  matchSum += FactorWeights.GoodReadsRating * normalizedGoodreadsRating;

  // compute normalized average popularity of books by ReadingReward.org students

  if (!_.isEmpty(bookReviews)) {
    const normalizedAvgRatingForBook = _.meanBy(bookReviews, 'interest') / 5.0;
    // console.log('Average Student Rating of Book: ' + normalizedAvgRatingForBook);
    weight += FactorWeights.AvgBookRatingByRRStudents;
    matchSum += FactorWeights.AvgBookRatingByRRStudents * normalizedAvgRatingForBook;
  }

  // compute normalized average rating by student of other books by same author

  const idsOfBooksBySameAuthor = _.map(otherBooksBySameAuthor, '_id');
  const studentReviewsOfOtherBooksBySameAuthor = _.filter(studentBookReviews, 
    br => _.includes(idsOfBooksBySameAuthor, br.book_id));
  if (!_.isEmpty(studentReviewsOfOtherBooksBySameAuthor)) {
    const normalizedStudentsAvgRatingOfOtherBooksBySameAuthor = _.meanBy(studentReviewsOfOtherBooksBySameAuthor, 'interest') / 5.0;
    // console.log('Average student rating of other books by author: ' + normalizedStudentsAvgRatingOfOtherBooksBySameAuthor);
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
    // console.log('Average Genre Interest: ' + normalizedAvgGenreInterest);
    weight += FactorWeights.StudentAvgGenreInterest;
    matchSum += FactorWeights.StudentAvgGenreInterest * normalizedAvgGenreInterest;
  }

  const interestLevel = matchSum / weight;

  // console.log('interest level: ' + interestLevel)

  const matchScore = interestLevel * lexileMult;

  // console.log('matchScore: ' + matchScore)

  return matchScore;

}