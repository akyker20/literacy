import { Response, Next } from 'restify';
import { IRequest } from '../Extensions';
import * as Middle from '../middleware';
import * as joi from 'joi';
import { genFieldErr } from '../helpers';
import _ = require('lodash');
import { ResourceNotFoundError } from 'restify-errors';
import { UserType } from '../data/users';
import { IGenreData, IGenre } from '../data/genres';

export const genreSchema = joi.object({
  title: joi.string().required().error(genFieldErr('title')),
}).required();

// abstract away restify

export function GenreService(genreData: IGenreData) {

  return {
    createGenre: [
      Middle.authenticate,
      Middle.authorize([UserType.ADMIN]),
      Middle.valBody<IGenre>(genreSchema),
      (req: IRequest<IGenre>, res: Response, next: Next) => {
        const genre = req.body;
        genreData.createGenre(genre)
          .then(createdGenre => res.send(201, createdGenre))
          .catch(err => next(err))
      }
    ],
    getGenres: [
      Middle.authenticate,
      (req: IRequest<IGenre>, res: Response, next: Next) => {
        genreData.getGenres()
          .then(genres => res.send(genres))
          .catch(err => next(err))
      }
    ],
    deleteGenre: [
      Middle.authenticate,
      Middle.authorize([UserType.ADMIN]),
      (req: IRequest<null>, res: Response, next: Next) => {
        genreData.deleteGenre(req.params.genreId)
          .then(deleted_genre => {
            if (_.isEmpty(deleted_genre)) {
              return next(new ResourceNotFoundError('No genre was deleted'))
            }
            res.send({ deleted_genre })
          })
          .catch(err => next(err))
      }
    ]
  }

}