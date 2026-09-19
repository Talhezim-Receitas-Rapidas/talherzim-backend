require('dotenv').config();

function databaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const user = process.env.DB_USER || 'talherzim';
  const password = process.env.DB_PASS || 'talherzim123';
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const name = process.env.DB_NAME || 'talherzim';
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
