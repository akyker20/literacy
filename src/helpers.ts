import { BadRequestError } from 'restify-errors';
import { ILexileRange } from './models';

/**
 * Clients should not receive a joi error.
 * They should receive something simpler:
 * i.e. 'Invalid/missing field user_name'
 * @param fieldName
 */
export function genFieldErr(fieldName: string): Error {
  return new BadRequestError(`Invalid/missing field ${fieldName}`);
}

export function getLexileRange(measure: number): ILexileRange {
  return {
    min: measure - 100,
    max: measure + 50
  };
}