const express = require('express');
const { criarDespensaController } = require('../controllers/despensaController');
const { enviarErro } = require('../http/erro');

function validarId(req, res, next) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id)) {
    return enviarErro(res, 404, 'nao_encontrado');
  }
  return next();
}

function criarIngredientesRouter(despensaService, authenticate) {
  const router = express.Router();
  const controller = criarDespensaController(despensaService);

  router.use(authenticate);
  router.get('/', controller.listar);
  router.post('/', controller.criar);
  router.put('/:id', validarId, controller.atualizar);
  router.delete('/:id', validarId, controller.remover);

  return router;
}

module.exports = { criarIngredientesRouter };
