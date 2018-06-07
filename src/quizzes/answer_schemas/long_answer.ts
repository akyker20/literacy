import * as joi from 'joi';
import { Constants } from 'reading_rewards';

export const LongAnswerAnswerSchema = joi.object({
  response: joi.string().max(Constants.MaxLongAnswerReponseChars).required()
}).required();

export interface ILongAnswerAnswer {
  response: string;
}