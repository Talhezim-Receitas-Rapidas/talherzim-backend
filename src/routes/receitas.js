const { criarReceitaController } = require('../controllers/receitaController');

/**
 * Cria o router de receitas.
 * @param {import('../services/receitaService').ReceitaService} receitaService
 * @returns {import('express').Router}
 */
function criarReceitasRouter(receitaService) {
  const { Router } = require('express');
  const router = Router();
  const controller = criarReceitaController(receitaService);

  router.get('/sugeridas', controller.listarSugeridas);
  router.get('/:id', controller.obterPorId);

  return router;
}

module.exports = { criarReceitasRouter };
