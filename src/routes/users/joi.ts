import * as joi from 'joi';
import * as _ from 'lodash';
import { shortidSchema, genFieldErr, lexileMeasureSchema } from '../extensions';
import { Models as M, Constants as C } from 'reading_rewards';

export namespace BodyValidators {

  export const UpdateBookRequestStatus = joi.object({
    updated_status: joi.string().valid(_.values(M.BookRequestStatus)).required()
  }).required()

  export const RequestBookSchema = joi.object({
    bookId: shortidSchema.error(genFieldErr('bookId'))
  }).required()

  export const BookmarkBookSchema = joi.object({
    bookId: shortidSchema.error(genFieldErr('bookId'))
  }).required()

  export const EditGenreInterestSchema = joi.object({
    interest_value: joi.number().integer().valid([1, 2, 3, 4]).required().error(genFieldErr('interest_value'))
  }).required();

  export const CreateGenreInterestSchema = joi.object().pattern(/.*/, joi.number().integer().valid([1, 2, 3, 4])).required().error(genFieldErr('create genre body'))

  export const parentEmailsSchema = joi.array().items(joi.string().email()).max(C.MaxParentEmailsPerStudent).unique().required().error(genFieldErr('parent_emails'));

  export const NotificationSettingsSchema = joi.object({
    reading_logs: joi.bool().required(),
    quiz_submissions: joi.bool().required(),
    prizes_ordered: joi.bool().required()
  }).required()

  export const UserSchema = joi.object({
    first_name: joi.string().required().error(genFieldErr('first_name')),
    last_name: joi.string().required().error(genFieldErr('last_name')),
    email: joi.string().email().required().error(genFieldErr('email')),
    password: joi.string().required().error(genFieldErr('password')),
  }).required();

  export const ActivateUserSchema = joi.object({
    password: joi.string().required()
  }).required()

  export const studentSchema = UserSchema.keys({
    gender: joi.string().valid(_.values(M.Gender)).required().error(genFieldErr('gender')),
    parent_emails: parentEmailsSchema,
    initial_lexile_measure: lexileMeasureSchema.error(genFieldErr('initial_lexile_measure')),
  }).required();

  export const PendingStudentSchema = joi.object({
    first_name: joi.string().required(),
    last_name: joi.string().required(),
    email: joi.string().email().required(),
    initial_lexile_measure: lexileMeasureSchema,
    gender: joi.string().valid(_.values(M.Gender)).required(),
    parent_emails: parentEmailsSchema
  }).required();

  export const UserAuthSchema = joi.object({
    email: joi.string().email().required().error(genFieldErr('email')),
    password: joi.string().required().error(genFieldErr('password')),
  }).required();

  export const UpdateParentEmailsSchema = joi.object({
    parent_emails: parentEmailsSchema
  }).required()

}