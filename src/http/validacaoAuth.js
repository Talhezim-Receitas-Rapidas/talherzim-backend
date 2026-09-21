const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validarCredenciais(body) {
  const campos = [];
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  const senha = typeof body?.senha === 'string' ? body.senha : '';

  if (!email || !EMAIL_REGEX.test(email)) {
    campos.push({ campo: 'email', mensagem: 'E-mail inválido.' });
  }

  if (senha.length < 8) {
    campos.push({
      campo: 'senha',
      mensagem: 'A senha deve ter ao menos 8 caracteres.',
    });
  }

  return {
    valido: campos.length === 0,
    campos,
    email: email.toLowerCase(),
    senha,
  };
}

module.exports = { validarCredenciais };
