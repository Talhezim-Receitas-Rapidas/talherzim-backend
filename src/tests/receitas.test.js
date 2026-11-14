const request = require('supertest');
const { PostgreSqlContainer } = require('@testcontainers/postgresql');
const { createPool } = require('../db/pool');
const { migrate } = require('../db/migrate');
const { AuthService } = require('../services/authService');
const { createApp } = require('../app');
const { importarDataset } = require('../scripts/importDataset');

describe('Despensa e receitas integradas ao PostgreSQL', () => {
  let container;
  let pool;
  let app;
  let fetchMock;
  let token;
  let outroToken;

  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL) {
      container = await new PostgreSqlContainer('postgres:15-alpine').start();
    }
    pool = createPool(process.env.TEST_DATABASE_URL || container.getConnectionUri());
    await migrate(pool);
    const config = { jwtSecret: 'teste-receitas', jwtExpiresIn: '1h', bcryptRounds: 4 };
    fetchMock = jest.spyOn(global, 'fetch');
    app = createApp({
      pool,
      jwtSecret: config.jwtSecret,
      authService: new AuthService(pool, config, new Set()),
    });
  });

  afterAll(async () => {
    fetchMock?.mockRestore();
    await pool?.end();
    await container?.stop();
  });

  async function criarSessao(email) {
    await request(app).post('/auth/register').send({ email, senha: 'SenhaTeste123!' }).expect(201);
    const { body } = await request(app)
      .post('/auth/login')
      .send({ email, senha: 'SenhaTeste123!' })
      .expect(200);
    return body.token;
  }

  beforeEach(async () => {
    await pool.query('DELETE FROM usuarios');
    await pool.query('DELETE FROM receitas');
    await pool.query('DELETE FROM traducoes_receitas');
    fetchMock.mockReset().mockRejectedValue(new Error('Provedor não configurado no teste'));
    token = await criarSessao('usuario@teste.com');
    outroToken = await criarSessao('outro@teste.com');
  });

  function autenticado(method, rota, sessao = token) {
    return request(app)[method](rota).set('Authorization', `Bearer ${sessao}`);
  }

  test('cria, lista, atualiza e remove itens com isolamento entre usuários', async () => {
    const { body: item } = await autenticado('post', '/ingredientes')
      .send({ nome: 'pepino', quantidade: 1, unidade: 'un' })
      .expect(201);
    expect((await autenticado('get', '/ingredientes').expect(200)).body).toEqual([item]);
    expect((await autenticado('get', '/ingredientes', outroToken).expect(200)).body).toEqual([]);
    await autenticado('put', `/ingredientes/${item.id}`, outroToken)
      .send({ nome: 'alterado', quantidade: 3, unidade: 'un' })
      .expect(403);
    await autenticado('delete', `/ingredientes/${item.id}`, outroToken).expect(403);
    const { body: atualizado } = await autenticado('put', `/ingredientes/${item.id}`)
      .send({ nome: 'Pepino', quantidade: 0.25, unidade: 'kg' })
      .expect(200);
    expect(atualizado).toMatchObject({
      id: item.id,
      nome: 'Pepino',
      quantidade: 0.25,
      unidade: 'kg',
    });
    await autenticado('delete', `/ingredientes/${item.id}`).expect(204);
    expect((await autenticado('get', '/ingredientes').expect(200)).body).toEqual([]);
  });

  test.each([
    {},
    { nome: 'x', quantidade: 0.001, unidade: 'kg' },
    { nome: 'x', quantidade: 100000000, unidade: 'kg' },
    { nome: 'x', quantidade: 1, unidade: 'unidade-com-mais-de-20-caracteres' },
  ])('rejeita ingrediente inválido %j', async (body) => {
    const resposta = await autenticado('post', '/ingredientes').send(body).expect(422);
    expect(resposta.body.erro).toBe('dados_invalidos');
    expect((await pool.query('SELECT * FROM ingredientes')).rows).toEqual([]);
  });

  test('valida corpo ausente, JSON malformado e UUID inválido', async () => {
    await autenticado('post', '/ingredientes').expect(422);
    await autenticado('post', '/ingredientes')
      .set('Content-Type', 'application/json')
      .send('{')
      .expect(400);
    await autenticado('delete', `/ingredientes/${'-'.repeat(36)}`).expect(404);
    await autenticado('put', `/ingredientes/${'a'.repeat(36)}`)
      .send({ nome: 'pepino', quantidade: 1, unidade: 'un' })
      .expect(404);
  });

  test('retorna o cabeçalho CORS também nos erros de JSON', async () => {
    const response = await autenticado('post', '/ingredientes')
      .set('Origin', 'http://localhost:5173')
      .set('Content-Type', 'application/json')
      .send('{')
      .expect(400);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const preflight = await request(app)
      .options('/ingredientes')
      .set('Origin', 'https://origem-nao-permitida.example')
      .expect(204);
    expect(preflight.headers['access-control-allow-origin']).toBeUndefined();
  });

  test.each([
    ['get', '/ingredientes'],
    ['post', '/ingredientes'],
    ['put', '/ingredientes/id'],
    ['delete', '/ingredientes/id'],
    ['get', '/receitas/sugeridas?detalhes=true'],
    ['get', '/receitas/estatico-002'],
  ])('exige autenticação em %s %s', async (method, rota) => {
    await request(app)[method](rota).expect(401);
  });

  test('importa o dataset duas vezes sem duplicar e preserva IDs antigos dos favoritos', async () => {
    const total = await importarDataset(pool);
    expect(await importarDataset(pool)).toBe(total);
    expect(Number((await pool.query('SELECT count(*) FROM receitas')).rows[0].count)).toBe(total);
    await autenticado('post', '/ingredientes')
      .send({ nome: 'arroz', quantidade: 1, unidade: 'kg' })
      .expect(201);
    const { body } = await autenticado('get', '/receitas/sugeridas?detalhes=true').expect(200);
    expect(body.receitas).toHaveLength(1);
    expect(body.receitas[0].id).not.toBe('estatico-002');
    await autenticado('get', `/receitas/${body.receitas[0].id}`).expect(200);
    const favoritoAntigo = await autenticado('get', '/receitas/estatico-002').expect(200);
    expect(favoritoAntigo.body.nome).toBe(body.receitas[0].nome);
  });

  test('reverte toda a importação quando uma receita falha', async () => {
    const provider = {
      obterTodasReceitas: async () => [
        { nome: 'Válida', fonte: 'estatico', fonte_id: 'teste-1', ingredientes: ['arroz'] },
        { nome: null, fonte: 'estatico', fonte_id: 'teste-2', ingredientes: [] },
      ],
    };
    await expect(importarDataset(pool, provider)).rejects.toThrow();
    expect((await pool.query('SELECT * FROM receitas')).rows).toEqual([]);
  });

  test('pesquisa pepino, traduz o detalhe e reutiliza o cache persistido', async () => {
    fetchMock.mockImplementation(async (url) => {
      const endereco = new URL(url);
      if (endereco.pathname.endsWith('filter.php')) {
        expect(endereco.searchParams.get('i')).toBe('cucumber');
        return { ok: true, json: async () => ({ meals: [{ idMeal: '123' }] }) };
      }
      if (endereco.pathname.endsWith('lookup.php'))
        return {
          ok: true,
          json: async () => ({
            meals: [
              {
                idMeal: '123',
                strMeal: 'Salad',
                strArea: 'British',
                strIngredient1: 'Cucumber',
                strMeasure1: '1 cup',
                strInstructions: 'Chop\nServe',
              },
            ],
          }),
        };
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
          responseData: { translatedText: dicionario[endereco.searchParams.get('q')] },
        }),
      };
    });
    const { body } = await autenticado('get', '/receitas/sugeridas?detalhes=true&busca=pepino').expect(200);
    expect(body.receitas[0]).toMatchObject({ id: 'externa-123', externa: true });
    const detalhe = await autenticado('get', '/receitas/externa-123').expect(200);
    expect(detalhe.body).toMatchObject({
      nome: 'Salada',
      ingredientes: [{ nome: 'Pepino', quantidade: '1 xícara' }],
      modoPreparo: ['Pique', 'Sirva'],
      idioma: 'pt-BR',
    });
    const antes = fetchMock.mock.calls.filter(([url]) => url.includes('mymemory')).length;
    await autenticado('get', '/receitas/externa-123').expect(200);
    expect(fetchMock.mock.calls.filter(([url]) => url.includes('mymemory'))).toHaveLength(antes);
    expect((await pool.query('SELECT * FROM traducoes_receitas')).rows).toHaveLength(1);
  });

  test('diferencia busca vazia, ausência de resultados e falha externa', async () => {
    const vazio = await autenticado('get', '/receitas/sugeridas?detalhes=true').expect(200);
    expect(vazio.body).toEqual({ receitas: [], avisos: [], despensaVazia: true });
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ meals: null }) });
    const ausente = await autenticado(
      'get',
      '/receitas/sugeridas?detalhes=true&busca=ingredienteinexistente',
    ).expect(200);
    expect(ausente.body.avisos[0]).toContain('Não encontramos receitas');
    fetchMock.mockRejectedValue(new Error('timeout'));
    const falha = await autenticado('get', '/receitas/sugeridas?detalhes=true&busca=pepino').expect(200);
    expect(falha.body.avisos[0]).toContain('indisponível');
    await autenticado('get', '/receitas/externa-123').expect(503);
    await autenticado('get', '/receitas/id-inexistente').expect(404);
  });

  test('valida o formato e o tamanho da busca', async () => {
    await autenticado('get', '/receitas/sugeridas?detalhes=true&busca[]=pepino').expect(422);
    await autenticado('get', `/receitas/sugeridas?detalhes=true&busca=${'a'.repeat(151)}`).expect(422);
  });
});
