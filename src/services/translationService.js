function dividirTexto(texto) {
  const partes = [];
  let atual = '';
  for (const palavra of texto.split(/\s+/).filter(Boolean)) {
    if (Buffer.byteLength(atual + palavra, 'utf8') > 480 && atual) {
      partes.push(atual.trim());
      atual = '';
    }
    for (const letra of palavra) {
      if (Buffer.byteLength(atual + letra, 'utf8') > 480) {
        partes.push(atual.trim());
        atual = '';
      }
      atual += letra;
    }
    atual += ' ';
  }
  if (atual.trim()) partes.push(atual.trim());
  return partes;
}

function decodificar(texto) {
  return texto
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (entidade, codigo) => {
      const numero =
        codigo[0].toLowerCase() === 'x' ? parseInt(codigo.slice(1), 16) : Number(codigo);
      return numero <= 0x10ffff ? String.fromCodePoint(numero) : entidade;
    })
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/<[^>]*>/g, '')
    .trim();
}

class TranslationService {
  constructor(pool, fetcher = fetch) {
    this.pool = pool;
    this.fetcher = fetcher;
    this.pendentes = new Map();
  }

  async traduzirTexto(texto) {
    if (!texto?.trim()) return texto;
    const traduzidas = [];
    for (const parte of dividirTexto(texto)) {
      const parametros = new URLSearchParams({ q: parte, langpair: 'en|pt-BR' });
      const response = await this.fetcher(`https://api.mymemory.translated.net/get?${parametros}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error('Tradução indisponível');
      const data = await response.json();
      const traducao = data.responseData?.translatedText;
      if (
        Number(data.responseStatus) !== 200 ||
        data.quotaFinished ||
        typeof traducao !== 'string' ||
        !traducao.trim()
      ) {
        throw new Error('Tradução indisponível ou limite atingido');
      }
      traduzidas.push(decodificar(traducao));
    }
    return traduzidas.join(' ');
  }

  async traduzirReceita(receita) {
    const chave = JSON.stringify([
      receita.nome,
      receita.origem,
      receita.ingredientes,
      receita.modoPreparo,
    ]);
    const { rows } = await this.pool.query(
      'SELECT conteudo FROM traducoes_receitas WHERE receita_id = $1 AND original = $2',
      [receita.id, chave],
    );
    if (rows[0]) return { ...receita, ...this.decodificarConteudo(rows[0].conteudo) };
    const existente = this.pendentes.get(chave);
    if (existente) return { ...receita, ...this.decodificarConteudo(await existente) };
    const pendente = this.traduzirConteudo(receita);
    this.pendentes.set(chave, pendente);
    try {
      const conteudo = await pendente;
      await this.pool.query(
        `INSERT INTO traducoes_receitas (receita_id, original, conteudo) VALUES ($1, $2, $3)
         ON CONFLICT (receita_id) DO UPDATE SET original = EXCLUDED.original, conteudo = EXCLUDED.conteudo`,
        [receita.id, chave, JSON.stringify(conteudo)],
      );
      return { ...receita, ...this.decodificarConteudo(conteudo) };
    } finally {
      this.pendentes.delete(chave);
    }
  }

  async traduzirConteudo(receita) {
    const textos = [
      receita.nome,
      receita.origem || '',
      ...receita.ingredientes.flatMap((ing) => [ing.nome, ing.quantidade || '']),
      ...receita.modoPreparo,
    ];
    const traducoes = [];
    for (let index = 0; index < textos.length; index += 4) {
      traducoes.push(
        ...(await Promise.all(
          textos.slice(index, index + 4).map((texto) => this.traduzirTexto(texto)),
        )),
      );
    }
    const ingredientes = receita.ingredientes.map((_ing, index) => ({
      nome: traducoes[2 + index * 2],
      quantidade: traducoes[3 + index * 2],
    }));
    return {
      nome: traducoes[0],
      origem: traducoes[1] || null,
      ingredientes,
      modoPreparo: traducoes.slice(2 + ingredientes.length * 2),
      idioma: 'pt-BR',
      traducaoAutomatica: true,
    };
  }

  decodificarConteudo(conteudo) {
    return {
      ...conteudo,
      nome: decodificar(conteudo.nome),
      origem: conteudo.origem ? decodificar(conteudo.origem) : null,
      ingredientes: conteudo.ingredientes.map((ing) => ({
        nome: decodificar(ing.nome),
        quantidade: decodificar(ing.quantidade || ''),
      })),
      modoPreparo: conteudo.modoPreparo
        .map(decodificar)
        .filter(
          (etapa) => etapa && !/^(?:step\s*\d+|\d+[°º]?\s*(?:passo|etapa))\s*:?$/i.test(etapa),
        ),
    };
  }
}

module.exports = { TranslationService, dividirTexto };
