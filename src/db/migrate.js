const fs = require('fs');
const path = require('path');

async function migrate(pool) {
  const schemaPath = path.join(__dirname, '..', '..', 'db', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(sql);
}

module.exports = { migrate };
