import { assert } from 'chai';
import * as moment from 'moment';
import * as shortid from 'shortid';
import * as _ from 'lodash';

import { mockBook } from "./models/book";
import { DefaultGenreInterestLevel, NumReviewsToBaseCLM } from './constants';
import { computeMatchScore, computeCurrentLexileMeasure } from "./helpers";
import { mockBookReview } from './models/book_review';

describe('#computeMatchScore', function() {

  const amazonPop = 4.2;
  
  const book = mockBook({
    amazon_popularity: amazonPop,
    genres: ['some-genre1', 'some-genre2']
  });

  it('should compute score even if unknown interest in genre', function() {
    const genreMap: any = {
      'some-genre1': 2,
      'some-other-genre': 4
    }
    const expected = amazonPop * ((DefaultGenreInterestLevel + 2) / 2) / 20.0;
    const actual = computeMatchScore(genreMap, book);
    assert.equal(actual, expected);
  })

  it('should compute score correct score', function() {
    const genreMap: any = {
      'some-genre1': 4,
      'some-genre3': 3,
      'some-other-genre': 4
    }
    const expected = amazonPop * 3.5 / 20.0;
    const actual = computeMatchScore(genreMap, book);
    assert.equal(actual, expected);
  })

})


describe.only('#computeCurrentLexileMeasure', function() {

  it('should return initial lexile measure when no reviews exist', function() {
    const initialLexileMeasure = _.random(400, 200);
    const actual = computeCurrentLexileMeasure(initialLexileMeasure, []);
    assert.equal(actual, initialLexileMeasure);
  });

  it('should return initial lexile measure when too few reviews exist', function() {
    const initialLexileMeasure = _.random(400, 200);
    const reviews = _.times(NumReviewsToBaseCLM - 1, () => mockBookReview({
      book_id: shortid.generate(),
      student_id: shortid.generate(),
      comprehension: _.random(1, 5) as 1|2|3|4|5
    }))
    const actual = computeCurrentLexileMeasure(initialLexileMeasure, reviews);
    assert.equal(actual, initialLexileMeasure);
  });

  it('should return initial lexile measure when too few reviews exist', function() {

    const initialLexileMeasure = _.random(400, 200);

    const reviews = [
      mockBookReview({
        book_id: shortid.generate(),
        student_id: shortid.generate(),
        book_lexile_measure: 600,
        comprehension: 4
      }),
      mockBookReview({
        book_id: shortid.generate(),
        student_id: shortid.generate(),
        book_lexile_measure: 640,
        comprehension: 5
      }),
      mockBookReview({
        book_id: shortid.generate(),
        student_id: shortid.generate(),
        book_lexile_measure: 615,
        comprehension: 3
      })
    ];

    const expected = (600 + 640 + 50 + 615 - 50) / 3;
    const actual = computeCurrentLexileMeasure(initialLexileMeasure, reviews);
    assert.equal(actual, expected);

  });

  it('should return initial lexile measure when too few reviews exist', function() {

    const initialLexileMeasure = _.random(400, 200);
    
    const reviews = [
      mockBookReview({
        book_id: shortid.generate(),
        student_id: shortid.generate(),
        book_lexile_measure: 600,
        comprehension: 4,
        date_created: moment().subtract(10, 'd').toISOString()
      }),
      mockBookReview({
        book_id: shortid.generate(),
        student_id: shortid.generate(),
        book_lexile_measure: 640,
        comprehension: 5,
        date_created: moment().subtract(8, 'd').toISOString()
      }),
      mockBookReview({
        book_id: shortid.generate(),
        student_id: shortid.generate(),
        book_lexile_measure: 615,
        comprehension: 3,
        date_created: moment().subtract(6, 'd').toISOString()
      }),
      mockBookReview({
        book_id: shortid.generate(),
        student_id: shortid.generate(),
        book_lexile_measure: 620,
        comprehension: 5,
        date_created: moment().subtract(5, 'd').toISOString()
      })
    ];

    const expected = (640 + 50 + 615 - 50 + 620 + 50) / 3;
    const actual = computeCurrentLexileMeasure(initialLexileMeasure, reviews);
    assert.equal(actual, expected);

  });

});