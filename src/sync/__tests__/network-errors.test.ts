import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  describeError,
  genericErrorMessage,
  isNetworkError,
  networkErrorMessage,
} from '../network-errors.ts';

describe('network error detection', () => {
  test('recognises the failures seen on real phones', () => {
    const samples = [
      new Error('fetch failed: java.net.UnknownHostException: Unable to resolve host "x.invalid": No address associated with hostname'),
      new TypeError('Network request failed'),
      new Error('Failed to connect to /10.0.2.2:3000'),
      new Error('The request timed out.'),
      Object.assign(new Error('Aborted'), { name: 'AbortError' }),
      new Error('Connection reset by peer'),
    ];
    for (const e of samples) assert.equal(isNetworkError(e), true, String(e.message));
  });

  test('does not mistake ordinary errors for network problems', () => {
    assert.equal(isNetworkError(new Error('Unexpected token < in JSON')), false);
    assert.equal(isNetworkError(null), false);
    assert.equal(isNetworkError(undefined), false);
  });

  test('describeError never leaks technical text', () => {
    const raw = new Error('fetch failed: java.net.UnknownHostException');
    assert.equal(describeError(raw, 'en'), networkErrorMessage('en'));
    assert.doesNotMatch(describeError(raw, 'en'), /java|Exception|fetch/);
    assert.equal(describeError(new Error('boom'), 'ur'), genericErrorMessage('ur'));
  });
});
