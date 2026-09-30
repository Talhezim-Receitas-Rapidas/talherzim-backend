const { enviarErro } = require('../http/erro');

/**
 * Cria o controlador de receitas.
 * @param {import('../services/receitaService').ReceitaService} receitaService
 * @returns {Object}
 */
function criarReceitaController(receitaService) {
  return {
    /**
     * GET /receitas/sugeridas
     * @param {import('express').Request} req
     * @param {import('express').Response} res
     */
    async listarSugeridas(req, res) {
      try {
        const usuarioId = req.usuario.id;
        const receitas = await receitaService.listarSugeridas(usuarioId);
        res.json(receitas);
      } catch (err) {
        console.error(err);
        if (!res.headersSent) {
          enviarErro(res, 500, 'erro_interno');
        }
      }
    },

    /**
     * GET /receitas/:id
     * @param {import('express').Request} req
     * @param {import('express').Response} res
     */
    async obterPorId(req, res) {
      try {
        const { id } = req.params;
        const receita = await receitaService.buscarPorId(id);
        if (!receita) {
          return enviarErro(res, 404, 'recurso_nao_encontrado');
        }
        res.json(receita);
      } catch (err) {
        console.error(err);
        if (!res.headersSent) {
          enviarErro(res, 500, 'erro_interno');
        }
      }
    },
  };
}

module.exports = { criarReceitaController };
