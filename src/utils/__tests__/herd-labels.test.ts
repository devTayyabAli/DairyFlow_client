import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  activityTypeLabel,
  defaultActivityTitle,
  genderLabel,
  isDefaultActivityTitle,
  speciesLabel,
  statusLabel,
} from '../herd-labels.ts';

describe('herd labels', () => {
  test('every value the database allows has an Urdu label', () => {
    for (const s of ['Cow', 'Buffalo', 'Calf']) assert.notEqual(speciesLabel(s, 'ur'), s);
    for (const g of ['Female', 'Male']) assert.notEqual(genderLabel(g, 'ur'), g);
    for (const s of ['Lactating', 'Dry', 'Pregnant', 'Heifer', 'Bull', 'Calf']) {
      assert.notEqual(statusLabel(s, 'ur'), s);
    }
    for (const a of ['Vaccination', 'Deworming', 'Calving', 'Insemination', 'Treatment', 'Group Move', 'Other']) {
      assert.notEqual(activityTypeLabel(a, 'ur'), a);
      assert.notEqual(defaultActivityTitle(a, 'ur'), a);
    }
  });

  test('English returns the identifier and unknown values pass through', () => {
    assert.equal(speciesLabel('Cow', 'en'), 'Cow');
    assert.equal(statusLabel('Lactating', 'en'), 'Lactating');
    assert.equal(statusLabel('SomethingNew', 'ur'), 'SomethingNew');
  });

  test('suggested titles are recognised in both languages, typed titles are not', () => {
    assert.equal(isDefaultActivityTitle('Vaccination completed'), true);
    assert.equal(isDefaultActivityTitle(defaultActivityTitle('Treatment', 'ur')), true);
    assert.equal(isDefaultActivityTitle('HS vaccine administered'), false);
  });
});
