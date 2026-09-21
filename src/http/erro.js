function enviarErro(res, status, codigo, campos = []) {
  return res.status(status).json({ erro: codigo, campos });
}

module.exports = { enviarErro };
