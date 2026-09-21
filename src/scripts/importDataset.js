require('dotenv').config();
const { loadConfig } = require('../config');
const { createPool } = require('../db/pool');
const { StaticDatasetProvider } = require('../providers/staticDatasetProvider');
const { ReceitaModel } = require('../models/receitaModel');

/**
 * Função de importação idempotente do dataset para o PostgreSQL.
 * @param {import('pg').Pool} pool
 * @param {StaticDatasetProvider} [provider]
 * @returns {Promise<number>} Quantidade de receitas importadas/atualizadas.
 */
async function importarDataset(pool, provider = new StaticDatasetProvider()) {
  const receitas = await provider.obterTodasReceitas();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const receita of receitas) {
      const registro = await ReceitaModel.upsert(client, receita);
      await ReceitaModel.sincronizarIngredientes(client, registro.id, receita.ingredientes);
    }

    await client.query('COMMIT');
    return receitas.length;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  const config = loadConfig();
  const pool = createPool(config.databaseUrl);

  try {
    console.log('Iniciando importação do dataset estático de receitas...');
    const total = await importarDataset(pool);
    console.log(`✅ Sucesso: ${total} receitas foram importadas/atualizadas no banco de dados!`);
  } catch (err) {
    console.error('❌ Erro durante a importação do dataset:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = { importarDataset };
