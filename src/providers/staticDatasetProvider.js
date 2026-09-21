const fs = require('fs');
const path = require('path');
const { RecipeProvider } = require('./recipeProvider');
const { normalizarNomeIngrediente } = require('../utils/normalizacao');

/**
 * Provedor de receitas baseado em dataset estático JSON (S1-07).
 * Atua como base inicial e contingência offline (RNF07).
 */
class StaticDatasetProvider extends RecipeProvider {
  /**
   * @param {string|Array} [origem] Caminho para arquivo JSON ou array de receitas em memória.
   */
  constructor(origem) {
    super();
    this.origem = origem || path.join(__dirname, '../data/receitas.json');
    this.receitasCache = null;
  }

  /**
   * Carrega e valida as receitas do dataset estático.
   * @returns {Array}
   */
  carregarDataset() {
    if (this.receitasCache) {
      return this.receitasCache;
    }

    let dadosBrutos;
    if (Array.isArray(this.origem)) {
      dadosBrutos = this.origem;
    } else {
      const conteudo = fs.readFileSync(this.origem, 'utf-8');
      dadosBrutos = JSON.parse(conteudo);
    }

    if (!Array.isArray(dadosBrutos)) {
      throw new Error('O dataset de receitas estático deve ser um array JSON.');
    }

    this.receitasCache = dadosBrutos.map((item, index) => {
      if (!item.nome || !item.modo_preparo) {
        throw new Error(
          `Receita inválida no índice ${index}: nome e modo_preparo são obrigatórios.`,
        );
      }

      const ingredientesBrutos = Array.isArray(item.ingredientes) ? item.ingredientes : [];
      const ingredientesNormalizados = [
        ...new Set(ingredientesBrutos.map(normalizarNomeIngrediente).filter(Boolean)),
      ];

      return {
        fonte_id: item.fonte_id || `estatico-${String(index + 1).padStart(3, '0')}`,
        nome: item.nome.trim(),
        modo_preparo: item.modo_preparo.trim(),
        imagem_url: item.imagem_url || null,
        fonte: item.fonte || 'estatico',
        ingredientes: ingredientesNormalizados,
      };
    });

    return this.receitasCache;
  }

  /**
   * Retorna todas as receitas do dataset.
   * @returns {Promise<Array>}
   */
  async obterTodasReceitas() {
    return this.carregarDataset();
  }

  /**
   * Busca receitas que contenham ao menos um dos ingredientes fornecidos,
   * ordenando pelas que aproveitam mais ingredientes disponíveis.
   * @param {string[]} ingredientes
   * @returns {Promise<Array>}
   */
  async buscarReceitas(ingredientes = []) {
    const todas = this.carregarDataset();
    if (!Array.isArray(ingredientes) || ingredientes.length === 0) {
      return todas;
    }

    const setIngredientesBusca = new Set(
      ingredientes.map(normalizarNomeIngrediente).filter(Boolean),
    );

    const comCorrespondencia = todas
      .map((receita) => {
        const correspondencias = receita.ingredientes.filter((ing) =>
          setIngredientesBusca.has(ing),
        );
        return {
          ...receita,
          correspondenciasCount: correspondencias.length,
          correspondencias,
        };
      })
      .filter((r) => r.correspondenciasCount > 0)
      .sort((a, b) => b.correspondenciasCount - a.correspondenciasCount);

    return comCorrespondencia;
  }
}

module.exports = { StaticDatasetProvider };
