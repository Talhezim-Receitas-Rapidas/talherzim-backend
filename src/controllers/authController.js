const { enviarErro } = require('../http/erro');
const { validarCredenciais } = require('../http/validacaoAuth');
const { AuthError } = require('../services/authService');

function criarAuthController(authService) {
  return {
    async register(req, res, next) {
      try {
        const dados = validarCredenciais(req.body);
        if (!dados.valido) {
          return enviarErro(res, 422, 'dados_invalidos', dados.campos);
        }

        const usuario = await authService.registrar(dados.email, dados.senha);
        return res.status(201).json({ id: usuario.id, email: usuario.email });
      } catch (err) {
        if (err instanceof AuthError) {
          return enviarErro(res, err.status, err.codigo);
        }
        return next(err);
      }
    },

    async login(req, res, next) {
      try {
        const dados = validarCredenciais(req.body);
        if (!dados.valido) {
          return enviarErro(res, 422, 'dados_invalidos', dados.campos);
        }

        const sessao = await authService.login(dados.email, dados.senha);
        return res.status(200).json(sessao);
      } catch (err) {
        if (err instanceof AuthError) {
          return enviarErro(res, err.status, err.codigo);
        }
        return next(err);
      }
    },

    logout(req, res) {
      authService.logout(req.tokenPayload);
      return res.status(204).send();
    },

    me(req, res) {
      return res.status(200).json({
        id: req.usuario.id,
        email: req.usuario.email,
      });
    },
  };
}

module.exports = { criarAuthController };
