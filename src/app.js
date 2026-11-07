const express = require('express');
const cors = require('cors');
const { criarAuthRouter } = require('./routes/auth');
const { criarIngredientesRouter } = require('./routes/ingredientes');
const { criarAuthenticate } = require('./middleware/authenticate');
const { enviarErro } = require('./http/erro');
const { DespensaService } = require('./services/despensaService');
const { RecipeSuggestionService } = require('./services/recipeSuggestionService');

function createApp({ authService, despensaService, jwtSecret, pool, corsOrigins }) {
  const app = express();
  const authenticate = criarAuthenticate(authService, jwtSecret);

  app.use(
    cors({
      origin: corsOrigins?.length
        ? corsOrigins
        : (process.env.CORS_ORIGIN || process.env.FRONTEND_ORIGIN || 'http://localhost:5173')
            .split(',')
            .map((origin) => origin.trim()),
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );
  app.use(express.json());
  app.use('/auth', criarAuthRouter(authService, authenticate));
  if (despensaService || pool) {
    app.use(
      '/ingredientes',
      criarIngredientesRouter(despensaService || new DespensaService(pool), authenticate),
    );
  }

  if (pool) {
    const { criarReceitasRouter } = require('./routes/receitas');
    app.use('/receitas', criarReceitasRouter(new RecipeSuggestionService(pool), authenticate));
  }

  app.use((err, _req, res, next) => {
    if (err.type === 'entity.parse.failed') return enviarErro(res, 400, 'json_invalido');
    if (err.type === 'entity.too.large') return enviarErro(res, 413, 'corpo_muito_grande');
    console.error(err);
    if (res.headersSent) {
      return next(err);
    }
    return enviarErro(res, 500, 'erro_interno');
  });

  return app;
}

module.exports = { createApp };
