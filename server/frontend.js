import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
export const frontendDirectory = resolve(root, 'dist');

export async function ensureFrontend() {
  if (existsSync(resolve(frontendDirectory, 'index.html'))) return;
  console.log('Building the school management frontend...');
  const { build } = await import('vite');
  await build({ root, configFile: resolve(root, 'vite.config.js') });
}
