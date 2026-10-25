jest.mock('../models/ingredienteModel');
jest.mock('../models/receitaModel');

const { ReceitaService } = require('../services/receitaService');
const { IngredienteModel } = require('../models/ingredienteModel');
const { ReceitaModel } = require('../models/receitaModel');

describe('ReceitaService (fallback e limite de tempo)', () => {
  let pool;
  let servico;

  beforeEach(() => {
    jest.resetAllMocks();
    pool = { query: jest.fn() };
    servico = new ReceitaService(pool);
    servico.staticProvider = {
      buscarReceitas: jest.fn().mockResolvedValue([{ id: 1, nome: 'Omelete' }]),
      obterTodasReceitas: jest.fn().mockResolvedValue([{ id: 7, nome: 'Bolo' }]),
    };
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('usa o dataset estático quando a consulta de receitas falha', async () => {
    IngredienteModel.buscarNomesNormalizadosPorUsuario.mockResolvedValue(['ovo']);
    pool.query.mockRejectedValue(new Error('banco fora'));

    const resultado = await servico.listarSugeridas('u1');

    expect(resultado).toEqual([{ id: 1, nome: 'Omelete' }]);
    expect(servico.staticProvider.buscarReceitas).toHaveBeenCalledWith(['ovo']);
  });

  test('usa o dataset estático quando nem a despensa pode ser lida', async () => {
    IngredienteModel.buscarNomesNormalizadosPorUsuario.mockRejectedValue(new Error('banco fora'));

    const resultado = await servico.listarSugeridas('u1');

    expect(resultado).toEqual([{ id: 1, nome: 'Omelete' }]);
    expect(servico.staticProvider.buscarReceitas).toHaveBeenCalledWith([]);
  });

  test('cai no fallback quando o banco passa de 2 s', async () => {
    jest.useFakeTimers();
    IngredienteModel.buscarNomesNormalizadosPorUsuario.mockResolvedValue(['ovo']);
    pool.query.mockReturnValue(new Promise(() => {}));

    const promessa = servico.listarSugeridas('u1');
    await jest.advanceTimersByTimeAsync(2000);

    await expect(promessa).resolves.toEqual([{ id: 1, nome: 'Omelete' }]);
  });

  test('retorna lista vazia quando a despensa não tem ingredientes', async () => {
    IngredienteModel.buscarNomesNormalizadosPorUsuario.mockResolvedValue([]);

    const resultado = await servico.listarSugeridas('u1');

    expect(resultado).toEqual([]);
    expect(pool.query).not.toHaveBeenCalled();
    expect(servico.staticProvider.buscarReceitas).not.toHaveBeenCalled();
  });

  test('usa o dataset estático quando o banco não possui receitas', async () => {
    IngredienteModel.buscarNomesNormalizadosPorUsuario.mockResolvedValue(['ovo']);
    pool.query.mockResolvedValue({ rows: [] });

    const resultado = await servico.listarSugeridas('u1');

    expect(resultado).toEqual([{ id: 1, nome: 'Omelete' }]);
    expect(servico.staticProvider.buscarReceitas).toHaveBeenCalledWith(['ovo']);
  });

  test('ranqueia no banco apenas receitas com ao menos uma correspondência', async () => {
    IngredienteModel.buscarNomesNormalizadosPorUsuario.mockResolvedValue(['ovo']);
    pool.query.mockResolvedValue({
      rows: [{ id: 'r1', nome: 'Omelete', correspondencias: 1, total_ingredientes: 1 }],
    });

    const resultado = await servico.listarSugeridas('u1');

    expect(resultado).toHaveLength(1);
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('HAVING'), ['ovo']);
    expect(pool.query.mock.calls[0][0]).toContain('total_ingredientes');
  });

  test('buscarPorId encontra no dataset estático mesmo com id em texto', async () => {
    ReceitaModel.buscarPorId.mockRejectedValue(new Error('banco fora'));

    const receita = await servico.buscarPorId('7');

    expect(receita).toEqual({ id: 7, nome: 'Bolo' });
  });
});