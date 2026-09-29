const { loadConfig } = require('./config');
const { createPool } = require('./db/pool');
const { migrate } = require('./db/migrate');
const { AuthService } = require('./services/authService');
const { DespensaService } = require('./services/despensaService');
const { createApp } = require('./app');

async function main() {
  const config = loadConfig();
  const pool = createPool(config.databaseUrl);
  await migrate(pool);

  const authService = new AuthService(pool, config, new Set());
  const despensaService = new DespensaService(pool);
  const app = createApp({ authService, despensaService, jwtSecret: config.jwtSecret });

  app.listen(config.port, () => {
    console.log(`Talherzim API em http://localhost:${config.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});