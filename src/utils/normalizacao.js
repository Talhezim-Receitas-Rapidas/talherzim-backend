/**
 * Normaliza o nome do ingrediente para padronização no banco e matching case-insensitive.
 * @param {string} nome 
 * @returns {string}
 */
function normalizarNomeIngrediente(nome) {
  if (typeof nome !== 'string') {
    return '';
  }

  return nome
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

module.exports = { normalizarNomeIngrediente };
