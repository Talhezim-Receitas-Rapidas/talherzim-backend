const { ReceitaModel } = require('../models/receitaModel');
const { IngredienteModel } = require('../models/ingredienteModel');
const { StaticDatasetProvider } = require('../providers/staticDatasetProvider');
const { enviarErro } = require('../http/erro');

class ReceitaService {
  /**
   * @param {import('pg').Pool} pool
   */
  constructor(pool) {
    this.pool = pool;
    this.staticProvider = new StaticDatasetProvider();
  }

  /**
   * Busca receitas sugeridas com base na despensa do usuário.
   * @param {string} usuarioId
   * @returns {Promise<Array>}
   */
  async listarSugeridas(usuarioId) {
    // 1. Obter os ingredientes do usuário (normalizados)
    let usuarioIngredientes;
    try {
      usuarioIngredientes = await IngredienteModel.buscarNomesNormalizadosPorUsuario(this.pool, usuarioId);
    } catch (err) {
      console.error('Erro ao buscar ingredientes do usuário:', err);
      throw enviarErro(null, 500, 'erro_interno'); // ou talvez um erro específico
    }

    // 2. Tentar obter do banco de dados
    try {
      return await this._listarSugeridasDoBanco(usuarioIngredientes);
    } catch (dbErr) {
      console.warn('Falha ao buscar receitas sugeridas no banco, usando fallback estático:', dbErr);
      // 3. Fallback para dataset estático
      return await this.staticProvider.buscarReceitas(usuarioIngredientes);
    }
  }

  /**
   * Busca receitas sugeridas no banco de dados.
   * @param {string[]} usuarioIngredientesArray - Array de nomes normalizados de ingredientes do usuário
   * @returns {Promise<Array>}
   */
  /**
   * Busca receitas sugeridas no banco de dados.
   * @param {string[]} usuarioIngredientesArray - Array de nomes normalizados de ingredientes do usuário
   * @returns {Promise<Array>}
   */
  async _listarSugeridasDoBanco(usuarioIngredientesArray) {
    if (!Array.isArray(usuarioIngredientesArray) || usuarioIngredientesArray.length === 0) {
      // Se não houver ingredientes, retorna vazio (nenhuma sugestão)
      return [];
    }

    // Construir placeholders para os ingredientes do usuário: $1, $2, ...
    const placeholders = usuarioIngredientesArray.map((_, idx) => `$${idx + 1}`).join(', ');

    const correspondencias =
      `COUNT(CASE WHEN lower(ri.nome_ingrediente) = ANY(ARRAY[${placeholders}]) THEN 1 END)`;

    const query = `
      SELECT r.id, r.nome, r.modo_preparo, r.imagem_url, r.fonte, r.fonte_id, r.criado_em,
             COALESCE(array_agg(ri.nome_ingrediente ORDER BY ri.nome_ingrediente), '{}') AS ingredientes
      FROM receitas r
      LEFT JOIN receita_ingredientes ri ON ri.receita_id = r.id
      GROUP BY r.id
      ORDER BY ${correspondencias} DESC, r.nome ASC
    `;

    const { rows } = await this.pool.query(query, usuarioIngredientesArray);
    return rows;
  }
  async buscarPorId(id) {
    try {
      const receita = await ReceitaModel.buscarPorId(this.pool, id);
      if (receita) {
        return receita;
      }
    } catch (dbErr) {
      console.warn(`Falha ao buscar receita ${id} no banco, usando fallback estático:`, dbErr);
    }

    // Fallback para dataset estático
    const todasReceitas = await this.staticProvider.obterTodasReceitas();
    return todasReceitas.find(r => r.id === id) || null;
  }
}

module.exports = { ReceitaService };