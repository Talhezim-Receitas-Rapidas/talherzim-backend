const express = require('express');
const { criarDespensaController } = require('../controllers/despensaController');

function criarIngredientesRouter(despensaService, authenticate) {
  const router = express.Router();
  const controller = criarDespensaController(despensaService);

  router.use(authenticate);
  router.get('/', controller.listar);
  router.post('/', controller.criar);
  router.put('/:id', controller.atualizar);
  router.delete('/:id', controller.remover);

  return router;
}

module.exports = { criarIngredientesRouter };