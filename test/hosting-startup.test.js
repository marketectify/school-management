import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

test('hosting require entry reaches database initialization with ES modules', () => {
  const entry = fileURLToPath(new URL('../server.cjs', import.meta.url));
  const result = spawnSync(process.execPath, [
    '-e', 'require(process.argv[1]); console.log("Hosting entry loaded");', entry,
  ], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    env: { ...process.env, MONGODB_URI: 'invalid-test-uri' },
    encoding: 'utf8',
    timeout: 15000,
  });

  assert.ifError(result.error);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /Hosting entry loaded/);
  assert.match(result.stderr, /Could not connect to MongoDB \(MongoParseError\)/);
  assert.doesNotMatch(result.stderr, /ERR_REQUIRE_ASYNC_MODULE|ERR_REQUIRE_ESM/);
});
