import assert from 'node:assert/strict';
import { test } from 'node:test';
import { acceptsOrigin } from '../server/origin.js';

test('development accepts a local Vite origin when the proxy rewrites Host', () => {
  assert.equal(acceptsOrigin('http://localhost:5173', '127.0.0.1:4000', 'same-origin', true), true);
});

test('production requires a matching origin and development rejects foreign origins', () => {
  assert.equal(acceptsOrigin('http://localhost:5173', '127.0.0.1:4000', 'same-origin'), false);
  assert.equal(acceptsOrigin('https://school.example', 'school.example', 'same-origin'), true);
  assert.equal(acceptsOrigin('https://other.example', '127.0.0.1:4000', 'same-origin', true), false);
  assert.equal(acceptsOrigin('http://localhost:5173', '127.0.0.1:4000', 'cross-site', true), false);
  assert.equal(acceptsOrigin('null', '127.0.0.1:4000', undefined, true), false);
});
