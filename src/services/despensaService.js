const { IngredienteModel } = require('../models/ingredienteModel');

class DespensaError extends Error {
  constructor(codigo, status) {
    super(codigo);
    this.codigo = codigo;
    this.status = status;
  }
}

class DespensaService {
  constructor(pool, ingredienteModel = IngredienteModel) {
    this.pool = pool;
    this.ingredienteModel = ingredienteModel;
  }

  async criar(usuarioId, nome, quantidade, unidade) {
    return await this.ingredienteModel.criar(this.pool, usuarioId, nome, quantidade, unidade);
  }

  async listar(usuarioId) {
    return await this.ingredienteModel.listarPorUsuario(this.pool, usuarioId);
  }

  async atualizar(usuarioId, id, nome, quantidade, unidade) {
    const existente = await this.ingredienteModel.buscarPorId(this.pool, id);
    if (!existente) {
      throw new DespensaError('nao_encontrado', 404);
    }
    if (existente.usuario_id !== usuarioId) {
      throw new DespensaError('acesso_negado', 403);
    }

    return await this.ingredienteModel.atualizar(this.pool, id, nome, quantidade, unidade);
  }

  async remover(usuarioId, id) {
    const existente = await this.ingredienteModel.buscarPorId(this.pool, id);
    if (!existente) {
      throw new DespensaError('nao_encontrado', 404);
    }
    if (existente.usuario_id !== usuarioId) {
      throw new DespensaError('acesso_negado', 403);
    }

    await this.ingredienteModel.remover(this.pool, id);
  }
}

module.exports = { DespensaService, DespensaError };