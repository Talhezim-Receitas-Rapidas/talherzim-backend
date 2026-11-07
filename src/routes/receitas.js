const express = require('express');
const { enviarErro } = require('../http/erro');

function criarReceitasRouter(service) {
  const router = express.Router();
  router.get('/sugeridas', async (req, res, next) => {
    try {
      const busca = req.query.busca ?? '';
      if (typeof busca !== 'string' || busca.length > 150) {
        return enviarErro(res, 422, 'Informe uma busca de até 150 caracteres.');
      }
      res.json(await service.sugerir(req.usuario.id, busca.trim()));
    } catch (err) {
      next(err);
    }
  });
  router.get('/:id', async (req, res, next) => {
    try {
      const receita = await service.buscarPorId(req.params.id);
      if (!receita) return enviarErro(res, 404, 'Receita não encontrada.');
      return res.json(receita);
    } catch (err) {
      if (/^externa-\d+$/.test(req.params.id)) {
        return enviarErro(res, 503, 'A fonte externa está indisponível. Tente novamente.');
      }
      next(err);
    }
  });
  return router;
}

module.exports = { criarReceitasRouter };
