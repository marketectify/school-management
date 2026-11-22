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
    const meta = property => html.match(new RegExp('<meta property="' + property + '" content="([^"]+)"'))?.[1];
    assert.equal(meta('og:title'), 'School Management | Marketectify');
    assert.equal(meta('og:type'), 'website');
    assert.equal(meta('og:url'), 'https://school-management.marketectify.com/');
    assert.ok(meta('og:description'));
    assert.ok(meta('og:image:alt'));
    assert.match(html, /name="twitter:card" content="summary_large_image"/);

    const image = new URL(meta('og:image'));
    assert.equal(image.origin, 'https://school-management.marketectify.com');
    const preview = await fetch(origin + image.pathname, { headers: { 'User-Agent': 'WhatsApp/2.25' } });
    assert.equal(preview.status, 200, 'Link crawlers can fetch the preview without signing in');
    assert.match(preview.headers.get('content-type'), /image\/jpeg/);
    assert.equal(preview.headers.get('cross-origin-resource-policy'), 'cross-origin');
    assert.equal(preview.headers.get('access-control-allow-origin'), '*');
    const bytes = Buffer.from(await preview.arrayBuffer());
    assert.equal(bytes.subarray(0, 3).toString('hex'), 'ffd8ff');
    assert.ok(bytes.length < 100_000, 'Preview remains small enough for mobile sharing');
    assert.equal(meta('og:image:width'), '1200');
    assert.equal(meta('og:image:height'), '630');
    const legacy = await fetch(origin + '/social-preview-v1.png');
    assert.equal(legacy.status, 200, 'Previously shared image URLs remain valid');
    assert.equal(legacy.headers.get('cross-origin-resource-policy'), 'cross-origin');
    const imageHead = await fetch(origin + image.pathname, { method: 'HEAD' });
    assert.equal(imageHead.status, 200);
    assert.equal(Number(imageHead.headers.get('content-length')), bytes.length);
    assert.equal((await imageHead.arrayBuffer()).byteLength, 0);
    assert.match(response.headers.get('cache-control'), /no-cache/);
    for (const agent of ['WhatsApp/2.25', 'facebookexternalhit/1.1']) {
      const share = await fetch(origin + '/share', { headers: { 'User-Agent': agent } });
      assert.equal(share.status, 200);
      const shareHtml = await share.text();
      assert.match(shareHtml, /property="og:url" content="https:\/\/school-management\.marketectify\.com\/share"/);
      assert.match(shareHtml, /rel="canonical" href="https:\/\/school-management\.marketectify\.com\/share"/);
      assert.match(shareHtml, /social-preview-v2\.jpg/);
      assert.match(shareHtml, /<div id="root"><\/div>/);
      assert.match(share.headers.get('cache-control'), /no-cache/);
    }
    const robots = await fetch(origin + '/robots.txt');
    assert.equal(robots.status, 200);
    assert.match(robots.headers.get('content-type'), /text\/plain/);
    assert.match(await robots.text(), /Allow: \//);
    const favicon = await fetch(origin + '/favicon.svg');
    assert.equal(favicon.status, 200);
    assert.match(favicon.headers.get('content-type'), /image\/svg\+xml/);
    const script = html.match(/<script[^>]+src="([^"]+)"/)?.[1];
    assert.ok(script, 'HTML references the built frontend JavaScript');
    const asset = await fetch(new URL(script, origin));
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('content-type'), /javascript/);
    const deepLink = await fetch(origin + '/dashboard');
    assert.equal(deepLink.status, 200);
    assert.equal(await deepLink.text(), html);
    const config = await fetch(origin + '/api/auth/config');
    assert.equal(config.status, 200);
    const flags = await config.json();
    assert.equal(typeof flags.email, 'boolean');
    assert.equal(typeof flags.google, 'boolean');
    const profile = await fetch(origin + '/api/auth/username', { method: 'PUT', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify({ username: 'not-authenticated' }) });
    assert.equal(profile.status, 401);
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

