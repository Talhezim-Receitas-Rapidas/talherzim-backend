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
        const busca = req.query.busca ?? '';
        if (
          typeof busca !== 'string' ||
          busca.length > 150 ||
          (req.query.detalhes !== undefined && !['true', 'false'].includes(req.query.detalhes))
        ) {
          return enviarErro(res, 422, 'dados_invalidos');
        }
        const receitas =
          req.query.detalhes === 'true'
            ? await receitaService.sugerir(usuarioId, busca.trim())
            : await receitaService.listarSugeridas(usuarioId);
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
        if (/^externa-\d+$/.test(req.params.id)) {
          return enviarErro(res, 503, 'A fonte externa está indisponível. Tente novamente.');
        }
        console.error(err);
        if (!res.headersSent) {
          enviarErro(res, 500, 'erro_interno');
        }
      }
    },
  };
}

module.exports = { criarReceitaController };
