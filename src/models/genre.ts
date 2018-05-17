import * as shortid from 'shortid';
import * as faker from 'faker';

export interface IGenre {
  _id?: string;
  title: string;
  description: string;
}

export function mockGenre(options: {
  _id?: string;
  title?: string;
  description?: string;
}): IGenre {
  return {
    _id: options._id || shortid.generate(),
    title: options.title || faker.lorem.sentence(3),
    description: options.description || faker.lorem.sentence(10)
  }
}