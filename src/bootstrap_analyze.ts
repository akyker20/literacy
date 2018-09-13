// Checks the quizzes

import * as Path from 'path';
import * as _ from 'lodash';
import * as fs from 'fs';
import { Models as M } from 'reading_rewards';

const initialBooks: M.IBook[] = JSON.parse(fs.readFileSync(Path.join(__dirname, '../bootstrap_data/books.json'), 'utf8'));
const initialQuizzes: M.IQuiz[] = JSON.parse(fs.readFileSync(Path.join(__dirname, '../bootstrap_data/quizzes.json'), 'utf8'));

// check quizzes

const idsOfBooksWithQuizzes = [];

_.forEach(initialQuizzes, quiz => {
  if (_.isEmpty(quiz.book_id)) {
    console.error(`Quiz ${quiz._id} does not have a book_id`)
    process.exit(1);
  }
  const book = _.find(initialBooks, { _id: quiz.book_id });
  if (_.isUndefined(book)) {
    console.error(`Quiz ${quiz._id} has an invalid book_id`)
    process.exit(1);
  }
  if (_.includes(idsOfBooksWithQuizzes, quiz.book_id)) {
    console.error(`Quiz for book ${quiz.book_id} already exists.`)
    process.exit(1);
  }
  idsOfBooksWithQuizzes.push(quiz.book_id);
})

const idsOfAllBooks = _.map(initialBooks, '_id');
const idsOfBooksWithoutQuizzes = _.difference(idsOfAllBooks, idsOfBooksWithQuizzes);

console.log('\nBooks without quizzes:')
console.log(_.map(idsOfBooksWithoutQuizzes, bookId => (_.find(initialBooks, { _id: bookId }) as M.IBook).title).join(', '));

console.log('\nNum Book Quizzes: ' + idsOfBooksWithQuizzes.length + '\n');