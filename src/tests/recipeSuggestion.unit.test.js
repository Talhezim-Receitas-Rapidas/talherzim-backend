const { RecipeSuggestionService } = require('../services/recipeSuggestionService');
const { TheMealDBProvider } = require('../providers/theMealDBProvider');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createApp } = require('../app');

test('preserva receitas externas válidas quando um dos detalhes falha', async () => {
  const provider = new TheMealDBProvider();
  provider.consultar = jest.fn().mockResolvedValue([{ idMeal: '1' }, { idMeal: '2' }]);
  provider.buscarPorId = jest
    .fn()
    .mockResolvedValueOnce({ id: 'externa-1' })
    .mockRejectedValueOnce(new Error('timeout'));
  expect(await provider.buscarReceitas('pepino')).toEqual([{ id: 'externa-1' }]);
});

test('informa indisponibilidade quando todos os detalhes externos falham', async () => {
  const provider = new TheMealDBProvider();
  provider.consultar = jest.fn().mockResolvedValue([{ idMeal: '1' }]);
  provider.buscarPorId = jest.fn().mockRejectedValue(new Error('timeout'));
  await expect(provider.buscarReceitas('pepino')).rejects.toThrow('Serviço externo indisponível');
});

function preparar(buscarReceitas = jest.fn().mockResolvedValue([])) {
  const pool = {
    query: jest.fn().mockResolvedValue({ rows: [{ nome: 'arroz' }, { nome: 'batata' }] }),
  };
  const service = new RecipeSuggestionService(pool, { buscarReceitas });
  service.locais = jest
    .fn()
    .mockResolvedValue([
      { id: 'local-1', nome: 'Arroz simples', ingredientes: ['arroz'], externa: false },
    ]);
  return { service, buscarReceitas, pool };
}

test('mantém o arroz local e consulta batata mesmo já havendo uma sugestão local', async () => {
  const externa = {
    id: 'externa-1',
    nome: 'Batata assada',
    ingredientes: [{ nome: 'Potatoes', quantidade: '2' }],
    externa: true,
  };
  const { service, buscarReceitas, pool } = preparar(
    jest.fn().mockResolvedValue([externa, externa]),
  );
  const resultado = await service.sugerir('usuario-1');
  expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['usuario-1']);
  expect(buscarReceitas).toHaveBeenCalledTimes(1);
  expect(buscarReceitas).toHaveBeenCalledWith('batata');
  expect(resultado.receitas.map((r) => r.id)).toEqual(['local-1', 'externa-1']);
  expect(resultado.receitas[1].correspondencias).toBe(1);
});

test('mantém sugestões locais e informa falha externa', async () => {
  const { service } = preparar(jest.fn().mockRejectedValue(new Error('timeout')));
  const resultado = await service.sugerir('usuario-1');
  expect(resultado.receitas).toHaveLength(1);
  expect(resultado.avisos[0]).toContain('indisponível');
});

test('distingue ausência de resultados de uma despensa vazia', async () => {
  const { service } = preparar();
  const resultado = await service.sugerir('usuario-1');
  expect(resultado.despensaVazia).toBe(false);
  expect(resultado.avisos[0]).toContain('Não encontramos receitas para batata');
});

test('despensa vazia não dispara consultas externas', async () => {
  const { service, pool, buscarReceitas } = preparar();
  pool.query.mockResolvedValue({ rows: [] });
  expect(await service.sugerir('usuario-1')).toEqual({
    receitas: [],
    avisos: [],
    despensaVazia: true,
  });
  expect(buscarReceitas).not.toHaveBeenCalled();
});

test('pesquisar pepino consulta a fonte externa mesmo sem pepino na despensa', async () => {
  const { service, buscarReceitas } = preparar(
    jest.fn().mockResolvedValue([
      {
        id: 'externa-pepino',
        nome: 'Salada',
        ingredientes: [{ nome: 'Cucumber' }],
        externa: true,
      },
    ]),
  );
  const resultado = await service.sugerir('usuario-1', 'pepino');
  expect(buscarReceitas).toHaveBeenCalledWith('pepino');
  expect(resultado.receitas.map((r) => r.id)).toEqual(['externa-pepino']);
  expect(resultado.receitas[0].correspondencias).toBe(0);
});

test('pesquisa local por nome não consulta a fonte externa', async () => {
  const { service, buscarReceitas } = preparar();
  const resultado = await service.sugerir('usuario-1', 'Arroz simples');
  expect(resultado.receitas).toHaveLength(1);
  expect(buscarReceitas).not.toHaveBeenCalled();
});

test('provedor busca batata e retorna imagem, quantidade, preparo e procedência', async () => {
  const fetcher = jest
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ meals: [{ idMeal: '123' }] }) })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        meals: [
          {
            idMeal: '123',
            strMeal: 'Potato dish',
            strMealThumb: 'https://example.com/prato.jpg',
            strIngredient1: 'Potatoes',
            strMeasure1: '2',
            strInstructions: 'Cook.\nServe.',
            strArea: 'British',
            strSource: 'https://example.com/receita',
          },
        ],
      }),
    });
  const [receita] = await new TheMealDBProvider(fetcher).buscarReceitas('batata');
  expect(fetcher.mock.calls[0][0]).toContain('filter.php?i=potatoes');
  expect(receita).toMatchObject({
    id: 'externa-123',
    externa: true,
    origem: 'British',
    ingredientes: [{ nome: 'Potatoes', quantidade: '2' }],
    modoPreparo: ['Cook.', 'Serve.'],
    fonteUrl: 'https://example.com/receita',
  });
});

test('rotas normais exigem login e retornam sugestões locais para a despensa do usuário', async () => {
  const pool = {
    query: jest.fn().mockImplementation(async (sql, params) => {
      if (sql.includes('FROM ingredientes')) {
        expect(params).toEqual(['usuario-1']);
        return { rows: [{ nome: 'arroz' }] };
      }
      return { rows: [] };
    }),
  };
  const app = createApp({
    pool,
    jwtSecret: 'teste',
    authService: { tokenRevogado: () => false, buscarPorId: async () => ({ id: 'usuario-1' }) },
  });
  await request(app).get('/receitas/sugeridas').expect(401);
  const token = jwt.sign({ sub: 'usuario-1', jti: 'teste' }, 'teste');
  const { body } = await request(app)
    .get('/receitas/sugeridas')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  expect(body.receitas.length).toBeGreaterThan(0);
  expect(body.despensaVazia).toBe(false);
  expect(body.avisos).toEqual([]);
  await request(app)
    .get(`/receitas/${body.receitas[0].id}`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
});
