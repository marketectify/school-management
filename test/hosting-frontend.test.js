import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { once } from 'node:events';
import { test } from 'node:test';

test('hosting entry serves the built frontend from an unrelated working directory', { timeout: 60000 }, async () => {
  const root = new URL('../', import.meta.url);
  const entry = fileURLToPath(new URL('server.cjs', root));
  const databaseUrl = new URL('server/db.js', root).href;
  const directory = await mkdtemp(join(tmpdir(), 'school-hosting-'));
  const loader = join(directory, 'mock-database.mjs');
  const source = 'export async function connect() {};' +
    'export const User = { init: async () => {} }, Session = { init: async () => {} }, models = {};';
  await writeFile(loader,
    'export async function load(url, context, nextLoad) {' +
    'if (url === ' + JSON.stringify(databaseUrl) + ') return { format: "module", shortCircuit: true, source: ' + JSON.stringify(source) + ' };' +
    'return nextLoad(url, context); }');
  const registration = 'data:text/javascript,' + encodeURIComponent(
    'import { register } from "node:module"; register(' + JSON.stringify(pathToFileURL(loader).href) + ');');
  const child = spawn(process.execPath, [
    '--import', registration, '-e',
    'Promise.resolve(require(process.argv[1])).then(({ server }) => process.send({ port: server.address().port }));',
    entry,
  ], {
    cwd: directory,
    env: { ...process.env, PORT: '0', NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    windowsHide: true,
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  try {
    const address = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Startup timed out. ' + output)), 45000);
      child.once('message', message => { clearTimeout(timer); resolve(message); });
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', code => { clearTimeout(timer); reject(new Error('Startup exited with ' + code + '. ' + output)); });
    });
    const origin = 'http://127.0.0.1:' + address.port;
    const response = await fetch(origin + '/');
    assert.equal(response.status, 200, output);
    const html = await response.text();
    assert.match(html, /<div id="root"><\/div>/);
    assert.doesNotMatch(html, /Cannot GET/);
    const script = html.match(/<script[^>]+src="([^"]+)"/)?.[1];
    assert.ok(script, 'HTML references the built frontend JavaScript');
    const asset = await fetch(new URL(script, origin));
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('content-type'), /javascript/);
    const deepLink = await fetch(origin + '/dashboard');
    assert.equal(deepLink.status, 200);
    assert.equal(await deepLink.text(), html);
    const api = await fetch(origin + '/api/auth/me');
    assert.equal(api.status, 401);
  } finally {
    if (child.exitCode === null) {
      const closed = once(child, 'exit');
      child.kill();
      await closed;
    }
    await rm(directory, { recursive: true, force: true });
  }
});
