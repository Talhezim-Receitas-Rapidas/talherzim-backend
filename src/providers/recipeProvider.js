/**
 * Contrato base para provedores de receitas (S1-07).
 * Segue o diagrama de classes oficial do Talherzim.
 */
class RecipeProvider {
  /**
   * Busca receitas que utilizam um ou mais ingredientes informados.
   * @param {string[]} _ingredientes 
   * @returns {Promise<Array>}
   */
  async buscarReceitas(_ingredientes) {
    throw new Error('Método buscarReceitas() deve ser implementado pela subclasse.');
  }

  /**
   * Retorna todas as receitas disponíveis fornecidas pelo provedor.
   * @returns {Promise<Array>}
   */
  async obterTodasReceitas() {
    throw new Error('Método obterTodasReceitas() deve ser implementado pela subclasse.');
  }
}

module.exports = { RecipeProvider };
