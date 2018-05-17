import * as shortid from 'shortid';
import * as _ from 'lodash';
import * as faker from 'faker';

export interface IBook {
  _id?: string;
  title: string;
  author: string;
  isbn: string;
  lexile_measure: number;
  amazon_popularity: number;
  num_pages: number;
  genres: string[];
}

export function mockBook(options: {
  _id?: string;
  title?: string;
  author?: string;
  isbn?: string;
  lexile_measure?: number;
  amazon_popularity?: number;
  num_pages?: number;
  genres: string[];
}): IBook {
  return {
    _id: options._id || shortid.generate(),
    title: options.title || faker.lorem.sentence(5),
    author: options.author || faker.name.findName(),
    isbn: options.author || faker.lorem.text(13),
    lexile_measure: _.isNumber(options.lexile_measure) ? options.lexile_measure : _.random(300, 1800), 
    amazon_popularity: _.isNumber(options.amazon_popularity) ? options.amazon_popularity : _.random(1, 5, true), 
    num_pages: _.isNumber(options.num_pages) ? options.num_pages : _.random(50, 1000),
    genres: options.genres  
  }
}