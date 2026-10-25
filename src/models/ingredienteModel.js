const { normalizarNomeIngrediente } = require('../utils/normalizacao');

class IngredienteModel {
  static async criar(pool, usuarioId, nome, quantidade, unidade) {
    const { rows } = await pool.query(
      `INSERT INTO ingredientes (usuario_id, nome, quantidade, unidade)
       VALUES ($1, $2, $3, $4)
       RETURNING id, usuario_id, nome, quantidade, unidade, criado_em, atualizado_em`,
      [usuarioId, nome, quantidade, unidade],
    );
    return rows[0];
  }

  static async listarPorUsuario(pool, usuarioId) {
    const { rows } = await pool.query(
      `SELECT id, usuario_id, nome, quantidade, unidade, criado_em, atualizado_em
       FROM ingredientes
       WHERE usuario_id = $1
       ORDER BY nome`,
      [usuarioId],
    );
    return rows;
  }

  static async buscarPorId(pool, id) {
    const { rows } = await pool.query(
      `SELECT id, usuario_id, nome, quantidade, unidade, criado_em, atualizado_em
       FROM ingredientes
       WHERE id = $1`,
      [id],
    );
    return rows[0] || null;
  }

  static async atualizar(pool, id, nome, quantidade, unidade) {
    const { rows } = await pool.query(
      `UPDATE ingredientes
       SET nome = $2, quantidade = $3, unidade = $4, atualizado_em = now()
       WHERE id = $1
       RETURNING id, usuario_id, nome, quantidade, unidade, criado_em, atualizado_em`,
      [id, nome, quantidade, unidade],
    );
    return rows[0] || null;
  }

  static async remover(pool, id) {
    const { rowCount } = await pool.query('DELETE FROM ingredientes WHERE id = $1', [id]);
    return rowCount > 0;
  }

  static async buscarNomesNormalizadosPorUsuario(pool, usuarioId) {
    const rows = await IngredienteModel.listarPorUsuario(pool, usuarioId);
    return [...new Set(rows.map((row) => normalizarNomeIngrediente(row.nome)).filter(Boolean))];
  }
}

module.exports = { IngredienteModel };
