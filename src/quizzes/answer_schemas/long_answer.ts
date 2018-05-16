import * as joi from 'joi';
import { MaxLongAnswerReponseChars } from '../../constants';

export const LongAnswerAnswerSchema = joi.object({
  response: joi.string().max(MaxLongAnswerReponseChars).required()
}).required();

export interface ILongAnswerAnswer {
  response: string;
}