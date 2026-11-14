import assert from 'node:assert/strict';
import { test } from 'node:test';
import { models, Session } from '../server/db.js';

test('class and login sessions use different collections and retain their indexes', () => {
  assert.equal(Session.collection.name, 'sessions');
  assert.equal(models.sessions.collection.name, 'class_sessions');
  assert.ok(models.sessions.schema.indexes().some(([fields, options]) =>
    fields.periodId === 1 && fields.date === 1 && options.unique));
  assert.ok(Session.schema.indexes().some(([fields, options]) =>
    fields.expiresAt === 1 && options.expireAfterSeconds === 0));
});
