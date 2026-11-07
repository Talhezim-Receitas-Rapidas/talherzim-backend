const express = require('express');
const { criarAuthRouter } = require('./routes/auth');
const { criarAuthenticate } = require('./middleware/authenticate');
const { enviarErro } = require('./http/erro');
const { criarIngredientesRouter } = require('./routes/ingredientes');
const { criarReceitasRouter } = require('./routes/receitas');
const { RecipeSuggestionService } = require('./services/recipeSuggestionService');

function createApp({ authService, jwtSecret, pool }) {
  const app = express();
  const authenticate = criarAuthenticate(authService, jwtSecret);

  app.use((req, res, next) => {
    const origin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
    if (req.headers.origin === origin) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    return next();
  });
  app.use(express.json());
  app.use('/auth', criarAuthRouter(authService, authenticate));
  if (pool) {
    app.use('/ingredientes', authenticate, criarIngredientesRouter(pool));
    app.use('/receitas', authenticate, criarReceitasRouter(new RecipeSuggestionService(pool)));
  }

  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.parse.failed') return enviarErro(res, 400, 'json_invalido');
    if (err.type === 'entity.too.large') return enviarErro(res, 413, 'corpo_muito_grande');
    console.error(err);
    return enviarErro(res, 500, 'erro_interno');
  });

  return app;
}

module.exports = { createApp };
