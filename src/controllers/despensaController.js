const { enviarErro } = require('../http/erro');
const { validarIngrediente } = require('../http/validacaoDespensa');
const { DespensaError } = require('../services/despensaService');

function criarDespensaController(despensaService) {
  return {
    async listar(req, res, next) {
      try {
        const ingredientes = await despensaService.listar(req.usuario.id);
        return res.status(200).json(ingredientes);
      } catch (err) {
        return next(err);
      }
    },

    async criar(req, res, next) {
      try {
        const dados = validarIngrediente(req.body);
        if (!dados.valido) {
          return enviarErro(res, 422, 'dados_invalidos', dados.campos);
        }

        const ingrediente = await despensaService.criar(
          req.usuario.id,
          dados.nome,
          dados.quantidade,
          dados.unidade,
        );
        return res.status(201).json(ingrediente);
      } catch (err) {
        return next(err);
      }
    },

    async atualizar(req, res, next) {
      try {
        const dados = validarIngrediente(req.body);
        if (!dados.valido) {
          return enviarErro(res, 422, 'dados_invalidos', dados.campos);
        }

        const ingrediente = await despensaService.atualizar(
          req.usuario.id,
          req.params.id,
          dados.nome,
          dados.quantidade,
          dados.unidade,
        );
        return res.status(200).json(ingrediente);
      } catch (err) {
        if (err instanceof DespensaError) {
          return enviarErro(res, err.status, err.codigo);
        }
        return next(err);
      }
    },

    async remover(req, res, next) {
      try {
        await despensaService.remover(req.usuario.id, req.params.id);
        return res.status(204).send();
      } catch (err) {
        if (err instanceof DespensaError) {
          return enviarErro(res, err.status, err.codigo);
        }
        return next(err);
      }
    },
  };
}

module.exports = { criarDespensaController };