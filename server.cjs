// Hosting launchers can require this entry while the API initializes with ES modules.
import('./server/index.js').catch(error => {
  console.error('Could not load the school management API:', error);
  process.exit(1);
});
