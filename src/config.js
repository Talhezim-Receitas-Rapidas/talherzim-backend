require('dotenv').config();

function databaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const user = process.env.POSTGRES_USER;
  const password = process.env.POSTGRES_PASSWORD;
  const host = process.env.POSTGRES_HOST;
  const port = process.env.POSTGRES_PORT;
  const name = process.env.POSTGRES_DB;
  return `postgres://${user}:${password}@${host}:${port}/${name}`;
}

function loadConfig() {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET não configurado.');
  }

  return {
    port: Number(process.env.PORT) || 3000,
    jwtSecret,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
    bcryptRounds: Number(process.env.BCRYPT_ROUNDS) || 10,
    databaseUrl: databaseUrl(),
  };
}

module.exports = { loadConfig };
