const { ReceitaModel } = require('../models/receitaModel');
const { IngredienteModel } = require('../models/ingredienteModel');
const { StaticDatasetProvider } = require('../providers/staticDatasetProvider');

// RNF01: resposta em até 3 s. O banco tem 2 s; depois disso o dataset
// estático responde (RNF07).
const TEMPO_LIMITE_BANCO_MS = 2000;

function comTimeout(promessa, ms) {
  let timer;
  const limite = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Banco excedeu ${ms} ms`)), ms);
  });
  return Promise.race([promessa, limite]).finally(() => clearTimeout(timer));
}

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
   * Se o banco falhar ou demorar mais que o limite, usa o dataset estático.
   * @param {string} usuarioId
   * @returns {Promise<Array>}
   */
  async listarSugeridas(usuarioId) {
    let ingredientes = [];
    const consultarBanco = async () => {
      ingredientes = await IngredienteModel.buscarNomesNormalizadosPorUsuario(
        this.pool,
        usuarioId,
      );
      return this._listarSugeridasDoBanco(ingredientes);
    };

    try {
      return await comTimeout(consultarBanco(), TEMPO_LIMITE_BANCO_MS);
    } catch (err) {
      console.warn('Falha ao buscar receitas sugeridas no banco, usando fallback estático:', err);
      return this.staticProvider.buscarReceitas(ingredientes);
    }
  }

  /**
   * Busca receitas sugeridas no banco de dados.
   * @param {string[]} usuarioIngredientesArray - nomes normalizados da despensa
   * @returns {Promise<Array>}
   */
  async _listarSugeridasDoBanco(usuarioIngredientesArray) {
    if (!Array.isArray(usuarioIngredientesArray) || usuarioIngredientesArray.length === 0) {
      return [];
    }

    const placeholders = usuarioIngredientesArray.map((_, idx) => `$${idx + 1}`).join(', ');

    const correspondencias = `COUNT(CASE WHEN lower(ri.nome_ingrediente) = ANY(ARRAY[${placeholders}]) THEN 1 END)`;

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

  /**
   * Detalhe da receita (com ingredientes e modo_preparo). Fallback estático.
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async buscarPorId(id) {
    try {
      const receita = await comTimeout(
        ReceitaModel.buscarPorId(this.pool, id),
        TEMPO_LIMITE_BANCO_MS,
      );
      if (receita) {
        return receita;
      }
    } catch (dbErr) {
      console.warn(`Falha ao buscar receita ${id} no banco, usando fallback estático:`, dbErr);
    }

    const todasReceitas = await this.staticProvider.obterTodasReceitas();
    return todasReceitas.find((r) => String(r.id) === String(id)) || null;
  }
}

module.exports = { ReceitaService };