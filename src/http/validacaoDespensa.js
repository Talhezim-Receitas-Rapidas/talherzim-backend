function validarIngrediente(body) {
  const campos = [];
  const nome = typeof body?.nome === 'string' ? body.nome.trim() : '';
  const unidade = typeof body?.unidade === 'string' ? body.unidade.trim() : null;

  let quantidade = null;
  if (body?.quantidade !== undefined && body?.quantidade !== null && body?.quantidade !== '') {
    quantidade = Number(body.quantidade);
    if (
      !Number.isFinite(quantidade) ||
      quantidade < 0 ||
      (quantidade > 0 && quantidade < 0.01) ||
      quantidade > 99999999.99
    ) {
      campos.push({ campo: 'quantidade', mensagem: 'Quantidade deve ser um número válido.' });
    }
  }

  if (!nome) {
    campos.push({ campo: 'nome', mensagem: 'Nome é obrigatório.' });
  }
  if (nome.length > 150)
    campos.push({ campo: 'nome', mensagem: 'O nome deve ter até 150 caracteres.' });
  if (unidade && unidade.length > 20)
    campos.push({ campo: 'unidade', mensagem: 'A unidade deve ter até 20 caracteres.' });

  return {
    valido: campos.length === 0,
    campos,
    nome,
    quantidade,
    unidade: unidade || null,
  };
}

module.exports = { validarIngrediente };
