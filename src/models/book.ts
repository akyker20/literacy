import * as shortid from 'shortid';
import * as _ from 'lodash';
import * as faker from 'faker';

export interface IBook {
  _id?: string;
  title: string;
  author: string;
  isbn: string;
  summary: string;
  cover_photo_url: string;
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
    summary: faker.lorem.paragraph(4),
    cover_photo_url: faker.internet.url(),
    author: options.author || faker.name.findName(),
    isbn: options.isbn || '9780439708180',
    lexile_measure: _.isNumber(options.lexile_measure) ? options.lexile_measure : _.random(300, 1800), 
    amazon_popularity: _.isNumber(options.amazon_popularity) ? options.amazon_popularity : _.random(1, 5, true), 
    num_pages: _.isNumber(options.num_pages) ? options.num_pages : _.random(50, 1000),
    genres: options.genres  
  }
}