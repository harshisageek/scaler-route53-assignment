import { describe, expect, it } from 'vitest';
import { ApiError } from './errors';
import { fieldErrorsFrom } from './fieldErrors';

function validation(fields: unknown): ApiError {
  return new ApiError(422, 'ValidationFailed', 'One or more fields are invalid.', {
    fields,
  });
}

describe('fieldErrorsFrom', () => {
  it('keys each message by its field path', () => {
    const error = validation([
      { loc: ['body', 'name'], msg: 'Enter a domain name.' },
      { loc: ['body', 'vpc', 'vpc_id'], msg: 'Bad VPC ID.' },
      { loc: ['body'], msg: 'A private hosted zone needs a VPC.' },
    ]);

    expect(fieldErrorsFrom(error)).toEqual({
      name: 'Enter a domain name.',
      'vpc.vpc_id': 'Bad VPC ID.',
      '': 'A private hosted zone needs a VPC.',
    });
  });

  it('keeps the first message when a field has several', () => {
    const error = validation([
      { loc: ['body', 'name'], msg: 'First.' },
      { loc: ['body', 'name'], msg: 'Second.' },
    ]);

    expect(fieldErrorsFrom(error)).toEqual({ name: 'First.' });
  });

  it('ignores anything that is not a validation error', () => {
    expect(fieldErrorsFrom(new ApiError(409, 'Conflict', 'No.'))).toEqual({});
    expect(fieldErrorsFrom(new Error('network'))).toEqual({});
    expect(fieldErrorsFrom(validation('not a list'))).toEqual({});
  });
});
