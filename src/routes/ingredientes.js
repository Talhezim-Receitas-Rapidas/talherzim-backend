const express = require('express');
const { enviarErro } = require('../http/erro');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function criarIngredientesRouter(pool) {
  const router = express.Router();
  router.get('/', async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        'SELECT id, nome, quantidade::float, unidade FROM ingredientes WHERE usuario_id = $1 ORDER BY criado_em',
        [req.usuario.id],
      );
      res.json(rows);
    } catch (err) {
      next(err);
    }
  });

  async function salvar(req, res, next) {
    const { nome, quantidade, unidade } = req.body || {};
    if (
      typeof nome !== 'string' ||
      !nome.trim() ||
      nome.trim().length > 150 ||
      typeof quantidade !== 'number' ||
      !Number.isFinite(quantidade) ||
      quantidade < 0.01 ||
      quantidade > 99999999.99 ||
      !['un', 'g', 'kg', 'ml', 'l'].includes(unidade)
    ) {
      return enviarErro(res, 422, 'dados_invalidos', [
        {
          campo: 'ingrediente',
          mensagem: 'Informe nome, quantidade entre 0,01 e 99999999,99 e unidade válida.',
        },
      ]);
    }
    if (req.params.id && !UUID.test(req.params.id))
      return enviarErro(res, 404, 'Ingrediente não encontrado.');
    try {
      const valores = [nome.trim(), quantidade, unidade, req.usuario.id];
      const query = req.params.id
        ? 'UPDATE ingredientes SET nome = $1, quantidade = $2, unidade = $3, atualizado_em = now() WHERE usuario_id = $4 AND id = $5 RETURNING id, nome, quantidade::float, unidade'
        : 'INSERT INTO ingredientes (nome, quantidade, unidade, usuario_id) VALUES ($1, $2, $3, $4) RETURNING id, nome, quantidade::float, unidade';
      if (req.params.id) valores.push(req.params.id);
      const { rows } = await pool.query(query, valores);
      if (!rows[0]) return enviarErro(res, 404, 'Ingrediente não encontrado.');
      return res.status(req.params.id ? 200 : 201).json(rows[0]);
    } catch (err) {
      return next(err);
    }
  }
  router.post('/', salvar);
  router.put('/:id', salvar);
  router.delete('/:id', async (req, res, next) => {
    if (!UUID.test(req.params.id)) return enviarErro(res, 404, 'Ingrediente não encontrado.');
    try {
      const { rowCount } = await pool.query(
        'DELETE FROM ingredientes WHERE id = $1 AND usuario_id = $2',
        [req.params.id, req.usuario.id],
      );
      if (!rowCount) return enviarErro(res, 404, 'Ingrediente não encontrado.');
      return res.sendStatus(204);
    } catch (err) {
      return next(err);
    }
  });
  return router;
}

module.exports = { criarIngredientesRouter };
