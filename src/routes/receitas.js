const { criarReceitaController } = require('../controllers/receitaController');

/**
 * Cria o router de receitas.
 * @param {import('../services/receitaService').ReceitaService} receitaService
 * @param {Function} authenticate
 * @returns {import('express').Router}
 */
function criarReceitasRouter(receitaService, authenticate) {
  const { Router } = require('express');
  const router = Router();
  const controller = criarReceitaController(receitaService);

  router.use(authenticate);
  router.get('/sugeridas', controller.listarSugeridas);
  router.get('/:id', controller.obterPorId);

  return router;
}

module.exports = { criarReceitasRouter };
