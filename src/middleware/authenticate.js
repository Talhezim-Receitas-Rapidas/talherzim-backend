const jwt = require('jsonwebtoken');
const { enviarErro } = require('../http/erro');

function criarAuthenticate(authService, jwtSecret) {
  return async function authenticate(req, res, next) {
    const header = req.headers.authorization;
    if (!header) {
      return enviarErro(res, 401, 'nao_autenticado');
    }

    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return enviarErro(res, 401, 'nao_autenticado');
    }

    try {
      const payload = jwt.verify(token, jwtSecret);
      if (authService.tokenRevogado(payload.jti)) {
        return enviarErro(res, 401, 'token_invalido');
      }

      const usuario = await authService.buscarPorId(payload.sub);
      if (!usuario) {
        return enviarErro(res, 401, 'token_invalido');
      }

      req.usuario = usuario;
      req.tokenPayload = payload;
      return next();
    } catch {
      return enviarErro(res, 401, 'token_invalido');
    }
  };
}

function autorizarUsuario(req, recursoUsuarioId) {
  return req.usuario && req.usuario.id === recursoUsuarioId;
}

module.exports = { criarAuthenticate, autorizarUsuario };
