function validarIngrediente(body) {
  const campos = [];
  const nome = typeof body?.nome === 'string' ? body.nome.trim() : '';
  const unidade = typeof body?.unidade === 'string' ? body.unidade.trim() : null;

  let quantidade = null;
  if (body?.quantidade !== undefined && body?.quantidade !== null && body?.quantidade !== '') {
    quantidade = Number(body.quantidade);
    if (Number.isNaN(quantidade) || quantidade < 0) {
      campos.push({ campo: 'quantidade', mensagem: 'Quantidade deve ser um número válido.' });
    }
  }

  if (!nome) {
    campos.push({ campo: 'nome', mensagem: 'Nome é obrigatório.' });
  }

  return {
    valido: campos.length === 0,
    campos,
    nome,
    quantidade,
    unidade: unidade || null,
  };
}

module.exports = { validarIngrediente };