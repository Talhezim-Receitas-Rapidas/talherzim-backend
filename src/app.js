const express = require('express');
const cors = require('cors');
const { criarAuthRouter } = require('./routes/auth');
const { criarIngredientesRouter } = require('./routes/ingredientes');
const { criarAuthenticate } = require('./middleware/authenticate');
const { enviarErro } = require('./http/erro');

function createApp({ authService, despensaService, jwtSecret, pool, corsOrigins }) {
  const app = express();
  const authenticate = criarAuthenticate(authService, jwtSecret);

  app.use(
    cors({
      origin: corsOrigins && corsOrigins.length > 0 ? corsOrigins : true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );
  app.use(express.json());
  app.use('/auth', criarAuthRouter(authService, authenticate));
  app.use('/ingredientes', criarIngredientesRouter(despensaService, authenticate));

  // Receitas routes
  const { ReceitaService } = require('./services/receitaService');
  const receitaService = new ReceitaService(pool);
  const { criarReceitasRouter } = require('./routes/receitas');
  const receitasRouter = criarReceitasRouter(receitaService, authenticate);
  app.use('/receitas', receitasRouter);

  app.use((err, _req, res, next) => {
    console.error(err);
    if (res.headersSent) {
      return next(err);
    }
    return enviarErro(res, 500, 'erro_interno');
  });

  return app;
}

module.exports = { createApp };