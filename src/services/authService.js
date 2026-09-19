const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { UsuarioModel } = require('../models/usuarioModel');

class AuthError extends Error {
  constructor(codigo, status) {
    super(codigo);
    this.codigo = codigo;
    this.status = status;
  }
}

class AuthService {
  constructor(pool, config, tokensRevogados, usuarioModel = UsuarioModel) {
    this.pool = pool;
    this.config = config;
    this.tokensRevogados = tokensRevogados;
    this.usuarioModel = usuarioModel;
  }

  async registrar(email, senha) {
    const senhaHash = await bcrypt.hash(senha, this.config.bcryptRounds);

    try {
      return await this.usuarioModel.criar(this.pool, email, senhaHash);
    } catch (err) {
      if (err.code === '23505') {
        throw new AuthError('email_duplicado', 409);
      }
      throw err;
    }
  }

  async login(email, senha) {
    const usuario = await this.usuarioModel.buscarPorEmail(this.pool, email);

    if (!usuario) {
      throw new AuthError('credenciais_invalidas', 401);
    }

    const senhaOk = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaOk) {
      throw new AuthError('credenciais_invalidas', 401);
    }

    const jti = crypto.randomUUID();
    const token = jwt.sign(
      { sub: usuario.id, email: usuario.email, jti },
      this.config.jwtSecret,
      { expiresIn: this.config.jwtExpiresIn }
    );

    return {
      token,
      usuario: { id: usuario.id, email: usuario.email },
    };
  }

  logout(payload) {
    if (payload?.jti) {
      this.tokensRevogados.add(payload.jti);
    }
  }

  tokenRevogado(jti) {
    return Boolean(jti) && this.tokensRevogados.has(jti);
  }

  async buscarPorId(id) {
    return await this.usuarioModel.buscarPorId(this.pool, id);
  }
}

module.exports = { AuthService, AuthError };
