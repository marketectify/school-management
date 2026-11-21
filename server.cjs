// Hosting launchers require this entry while the API initializes with ES modules.
module.exports = import('./server/frontend.js')
  .then(({ ensureFrontend }) => ensureFrontend())
  .then(() => import('./server/index.js'))
  .catch(error => {
    console.error('Could not start the school management application:', error);
    process.exit(1);
  });
