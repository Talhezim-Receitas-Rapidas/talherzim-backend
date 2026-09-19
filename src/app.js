const express = require('express');
const { criarAuthRouter } = require('./routes/auth');
const { criarAuthenticate } = require('./middleware/authenticate');
const { enviarErro } = require('./http/erro');

function createApp({ authService, jwtSecret }) {
  const app = express();
  const authenticate = criarAuthenticate(authService, jwtSecret);

  app.use(express.json());
  app.use('/auth', criarAuthRouter(authService, authenticate));

  app.use((err, _req, res, _next) => {
    console.error(err);
    return enviarErro(res, 500, 'erro_interno');
  });

  return app;
}

module.exports = { createApp };
