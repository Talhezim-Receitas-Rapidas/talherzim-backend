const { normalizarNomeIngrediente } = require('../utils/normalizacao');

class IngredienteModel {
  /**
   * Busca todos os ingredientes de um usuário.
   * @param {import('pg').Pool} pool
   * @param {string} usuarioId
   * @returns {Promise<Array>} Array of objects with { id, nome, quantidade, unidade }
   */
  static async buscarPorUsuario(pool, usuarioId) {
    const { rows } = await pool.query(
      'SELECT id, nome, quantidade, unidade FROM ingredientes WHERE usuario_id = $1',
      [usuarioId]
    );
    return rows;
  }

  /**
   * Busca os nomes normalizados dos ingredientes de um usuário (para matching).
   * @param {import('pg').Pool} pool
   * @param {string} usuarioId
   * @returns {Promise<string[]>} Array of normalized ingredient names
   */
  static async buscarNomesNormalizadosPorUsuario(pool, usuarioId) {
    const { rows } = await pool.query(
      'SELECT lower(nome) AS nome_normalizado FROM ingredientes WHERE usuario_id = $1',
      [usuarioId]
    );
    return rows.map(r => r.nome_normalizado);
  }
}

module.exports = { IngredienteModel };
