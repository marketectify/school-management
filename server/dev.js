import { createServer } from 'vite';

process.env.SCHOOL_DEV_MODE = '1';
const { server: api } = await import('./index.js');
try {
  const vite = await createServer();
  await vite.listen();
  vite.printUrls();
} catch (error) {
  api.close();
  console.error('Could not start the development frontend:', error.message);
  process.exit(1);
}
