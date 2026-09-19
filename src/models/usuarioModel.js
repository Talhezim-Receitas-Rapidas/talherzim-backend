class UsuarioModel {
  static async criar(pool, email, senhaHash) {
    const { rows } = await pool.query(
      `INSERT INTO usuarios (email, senha_hash)
       VALUES ($1, $2)
       RETURNING id, email`,
      [email, senhaHash]
    );
    return rows[0];
  }

  static async buscarPorEmail(pool, email) {
    const { rows } = await pool.query(
      'SELECT id, email, senha_hash FROM usuarios WHERE email = $1',
      [email]
    );
    return rows[0] || null;
  }

  static async buscarPorId(pool, id) {
    const { rows } = await pool.query(
      'SELECT id, email FROM usuarios WHERE id = $1',
      [id]
    );
    return rows[0] || null;
  }
}

module.exports = { UsuarioModel };
