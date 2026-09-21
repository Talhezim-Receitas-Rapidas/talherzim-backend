const { normalizarNomeIngrediente } = require('../utils/normalizacao');

class ReceitaModel {
  /**
   * Insere ou atualiza uma receita com base na chave única (fonte, fonte_id).
   * @param {import('pg').Pool|import('pg').PoolClient} client 
   * @param {Object} receita 
   * @returns {Promise<Object>}
   */
  static async upsert(client, receita) {
    const { rows } = await client.query(
      `INSERT INTO receitas (nome, modo_preparo, imagem_url, fonte, fonte_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (fonte, fonte_id)
       DO UPDATE SET
         nome = EXCLUDED.nome,
         modo_preparo = EXCLUDED.modo_preparo,
         imagem_url = EXCLUDED.imagem_url
       RETURNING id, nome, modo_preparo, imagem_url, fonte, fonte_id, criado_em`,
      [
        receita.nome,
        receita.modo_preparo,
        receita.imagem_url || null,
        receita.fonte || 'estatico',
        receita.fonte_id,
      ]
    );

    return rows[0];
  }

  /**
   * Sincroniza os ingredientes de uma receita de forma idempotente.
   * @param {import('pg').Pool|import('pg').PoolClient} client 
   * @param {string} receitaId 
   * @param {string[]} ingredientes 
   */
  static async sincronizarIngredientes(client, receitaId, ingredientes) {
    await client.query('DELETE FROM receita_ingredientes WHERE receita_id = $1', [receitaId]);

    const normalizados = [
      ...new Set((ingredientes || []).map(normalizarNomeIngrediente).filter(Boolean)),
    ];

    for (const ing of normalizados) {
      await client.query(
        `INSERT INTO receita_ingredientes (receita_id, nome_ingrediente)
         VALUES ($1, $2)`,
        [receitaId, ing]
      );
    }
  }

  /**
   * Busca receita por ID trazendo seus ingredientes associados.
   * @param {import('pg').Pool} pool 
   * @param {string} id 
   * @returns {Promise<Object|null>}
   */
  static async buscarPorId(pool, id) {
    const query = `
      SELECT r.id, r.nome, r.modo_preparo, r.imagem_url, r.fonte, r.fonte_id, r.criado_em,
             COALESCE(
               array_agg(ri.nome_ingrediente ORDER BY ri.nome_ingrediente) 
               FILTER (WHERE ri.nome_ingrediente IS NOT NULL),
               '{}'
             ) AS ingredientes
      FROM receitas r
      LEFT JOIN receita_ingredientes ri ON ri.receita_id = r.id
      WHERE r.id = $1
      GROUP BY r.id
    `;
    const { rows } = await pool.query(query, [id]);
    return rows[0] || null;
  }

  /**
   * Lista todas as receitas com seus ingredientes associados.
   * @param {import('pg').Pool} pool 
   * @returns {Promise<Array>}
   */
  static async listarTodas(pool) {
    const query = `
      SELECT r.id, r.nome, r.modo_preparo, r.imagem_url, r.fonte, r.fonte_id, r.criado_em,
             COALESCE(
               array_agg(ri.nome_ingrediente ORDER BY ri.nome_ingrediente) 
               FILTER (WHERE ri.nome_ingrediente IS NOT NULL),
               '{}'
             ) AS ingredientes
      FROM receitas r
      LEFT JOIN receita_ingredientes ri ON ri.receita_id = r.id
      GROUP BY r.id
      ORDER BY r.nome ASC
    `;
    const { rows } = await pool.query(query);
    return rows;
  }
}

module.exports = { ReceitaModel };
