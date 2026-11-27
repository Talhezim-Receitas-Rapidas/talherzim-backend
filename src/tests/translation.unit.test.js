const { TranslationService, dividirTexto } = require('../services/translationService');

test('divide textos longos respeitando o limite em bytes sem perder palavras', () => {
  const texto = 'Cozinhe o feijão e tempere com limão. '.repeat(60).trim();
  const partes = dividirTexto(texto);
  expect(partes.length).toBeGreaterThan(1);
  expect(partes.every((parte) => Buffer.byteLength(parte, 'utf8') <= 480)).toBe(true);
  expect(partes.join(' ')).toBe(texto);
});

test('traduz campos preservando ingredientes e etapas e reutiliza o cache salvo', async () => {
  let salvo;
  const pool = {
    query: jest.fn(async (sql, params) => {
      if (sql.startsWith('SELECT')) return { rows: salvo ? [{ conteudo: salvo }] : [] };
      salvo = JSON.parse(params[2]);
      return { rows: [] };
    }),
  };
  const fetcher = jest.fn(async (url) => {
    const texto = new URL(url).searchParams.get('q');
    const dicionario = {
      Salad: 'Salada',
      British: 'Britânica',
      Cucumber: 'Pepino',
      '1 cup': '1 xícara',
      Chop: 'Pique',
      Serve: 'Sirva',
    };
    return {
      ok: true,
      json: async () => ({
        responseStatus: 200,
        responseData: { translatedText: dicionario[texto] },
      }),
    };
  });
  const service = new TranslationService(pool, fetcher);
  const receita = {
    id: 'externa-1',
    nome: 'Salad',
    origem: 'British',
    ingredientes: [{ nome: 'Cucumber', quantidade: '1 cup' }],
    modoPreparo: ['Chop', 'Serve'],
    fonte: 'TheMealDB',
  };
  const resultado = await service.traduzirReceita(receita);
  expect(resultado).toMatchObject({
    nome: 'Salada',
    ingredientes: [{ nome: 'Pepino', quantidade: '1 xícara' }],
    modoPreparo: ['Pique', 'Sirva'],
    idioma: 'pt-BR',
    fonte: 'TheMealDB',
  });
  const chamadas = fetcher.mock.calls.length;
  expect(await service.traduzirReceita(receita)).toEqual(resultado);
  expect(fetcher).toHaveBeenCalledTimes(chamadas);
});

test('não salva tradução parcial quando o serviço atinge a cota', async () => {
  const pool = { query: jest.fn().mockResolvedValue({ rows: [] }) };
  const fetcher = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      responseStatus: 403,
      responseData: { translatedText: 'LIMIT EXCEEDED' },
    }),
  });
  const service = new TranslationService(pool, fetcher);
  await expect(
    service.traduzirReceita({ id: '1', nome: 'Salad', ingredientes: [], modoPreparo: [] }),
  ).rejects.toThrow();
  expect(pool.query).toHaveBeenCalledTimes(1);
});

test('decodifica caracteres de entidades HTML retornadas pela tradução', async () => {
  const fetcher = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      responseStatus: 200,
      responseData: { translatedText: '1&#176; Passo &amp; preparo' },
    }),
  });
  const service = new TranslationService({}, fetcher);
  expect(await service.traduzirTexto('Step 1')).toBe('1° Passo & preparo');
});

test('limpa marcação e títulos duplicados também nas traduções salvas', async () => {
  const conteudo = {
    nome: 'Salada',
    origem: null,
    ingredientes: [{ nome: 'Pepino', quantidade: '1' }],
    modoPreparo: [
      '1&#176; Passo',
      '<g id="1">Pique o pepino.<x id="2"/></g>',
      '2º PASSO:',
      'Sirva.',
    ],
    idioma: 'pt-BR',
  };
  const pool = { query: jest.fn().mockResolvedValue({ rows: [{ conteudo }] }) };
  const fetcher = jest.fn();
  const resultado = await new TranslationService(pool, fetcher).traduzirReceita({ id: '1' });
  expect(resultado.modoPreparo).toEqual(['Pique o pepino.', 'Sirva.']);
  expect(fetcher).not.toHaveBeenCalled();
});

test('compartilha tradução em andamento entre requisições simultâneas', async () => {
  const pool = { query: jest.fn().mockResolvedValue({ rows: [] }) };
  const service = new TranslationService(pool);
  const conteudo = {
    nome: 'Salada',
    origem: null,
    ingredientes: [],
    modoPreparo: [],
    idioma: 'pt-BR',
  };
  service.traduzirConteudo = jest.fn().mockResolvedValue(conteudo);
  const receita = {
    id: 'externa-1',
    nome: 'Salad',
    origem: null,
    ingredientes: [],
    modoPreparo: [],
  };
  const resultados = await Promise.all([
    service.traduzirReceita(receita),
    service.traduzirReceita(receita),
  ]);
  expect(resultados[0]).toEqual(resultados[1]);
  expect(service.traduzirConteudo).toHaveBeenCalledTimes(1);
  expect(pool.query.mock.calls.filter(([sql]) => sql.includes('INSERT'))).toHaveLength(1);
});
