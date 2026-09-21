const path = require('path');
const { normalizarNomeIngrediente } = require('../utils/normalizacao');
const { RecipeProvider } = require('../providers/recipeProvider');
const { StaticDatasetProvider } = require('../providers/staticDatasetProvider');
const { ReceitaModel } = require('../models/receitaModel');
const { importarDataset } = require('../scripts/importDataset');

describe('S1-07 — Dataset de receitas e provider', () => {
  describe('normalizarNomeIngrediente', () => {
    it('deve converter para minúsculas e remover espaços extras', () => {
      expect(normalizarNomeIngrediente('  Queijo Mussarela  ')).toBe('queijo mussarela');
      expect(normalizarNomeIngrediente('Batata   Doce')).toBe('batata doce');
    });

    it('deve retornar string vazia para valores nulos ou inválidos', () => {
      expect(normalizarNomeIngrediente(null)).toBe('');
      expect(normalizarNomeIngrediente(undefined)).toBe('');
      expect(normalizarNomeIngrediente(123)).toBe('');
    });
  });

  describe('Integridade do Dataset receitas.json', () => {
    const caminhoJson = path.join(__dirname, '../data/receitas.json');
    const receitas = require(caminhoJson);

    it('deve conter um array de receitas com pelo menos 10 itens', () => {
      expect(Array.isArray(receitas)).toBe(true);
      expect(receitas.length).toBeGreaterThanOrEqual(10);
    });

    it('cada receita deve ter campos obrigatórios válidos', () => {
      for (const r of receitas) {
        expect(typeof r.fonte_id).toBe('string');
        expect(r.fonte_id.length).toBeGreaterThan(0);
        expect(typeof r.nome).toBe('string');
        expect(r.nome.length).toBeGreaterThan(0);
        expect(typeof r.modo_preparo).toBe('string');
        expect(r.modo_preparo.length).toBeGreaterThan(0);
        expect(Array.isArray(r.ingredientes)).toBe(true);
        expect(r.ingredientes.length).toBeGreaterThan(0);
      }
    });

    it('não deve conter fonte_id duplicado', () => {
      const ids = receitas.map((r) => r.fonte_id);
      const setIds = new Set(ids);
      expect(setIds.size).toBe(ids.length);
    });

    it('todos os ingredientes devem estar normalizados em minúsculas e sem espaços extras', () => {
      for (const r of receitas) {
        for (const ing of r.ingredientes) {
          expect(ing).toBe(normalizarNomeIngrediente(ing));
        }
      }
    });
  });

  describe('RecipeProvider (contrato base)', () => {
    it('deve lançar erro se os métodos abstratos não forem implementados', async () => {
      const base = new RecipeProvider();
      await expect(base.buscarReceitas(['ovo'])).rejects.toThrow(
        'Método buscarReceitas() deve ser implementado pela subclasse.',
      );
      await expect(base.obterTodasReceitas()).rejects.toThrow(
        'Método obterTodasReceitas() deve ser implementado pela subclasse.',
      );
    });
  });

  describe('StaticDatasetProvider', () => {
    let provider;
    const receitasMock = [
      {
        fonte_id: 'mock-1',
        nome: 'Omelete',
        modo_preparo: 'Bata e frite.',
        ingredientes: ['ovo', 'queijo', 'sal'],
      },
      {
        fonte_id: 'mock-2',
        nome: 'Arroz com Ovo',
        modo_preparo: 'Frite o ovo e junte ao arroz.',
        ingredientes: ['arroz', 'ovo', 'oleo'],
      },
      {
        fonte_id: 'mock-3',
        nome: 'Salada',
        modo_preparo: 'Misture as folhas.',
        ingredientes: ['alface', 'tomate'],
      },
    ];

    beforeEach(() => {
      provider = new StaticDatasetProvider(receitasMock);
    });

    it('obterTodasReceitas deve retornar todas as receitas normalizadas', async () => {
      const todas = await provider.obterTodasReceitas();
      expect(todas.length).toBe(3);
      expect(todas[0].nome).toBe('Omelete');
      expect(todas[0].fonte).toBe('estatico');
    });

    it('buscarReceitas sem ingredientes deve retornar todas', async () => {
      const todas = await provider.buscarReceitas([]);
      expect(todas.length).toBe(3);
    });

    it('buscarReceitas deve filtrar e ordenar pela quantidade de ingredientes correspondentes', async () => {
      // Omelete tem 'ovo' e 'queijo' (2 correspondências)
      // Arroz com Ovo tem apenas 'ovo' (1 correspondência)
      // Salada não tem nenhum (0 correspondências -> excluída)
      const resultado = await provider.buscarReceitas(['Ovo', 'QUEIJO']);

      expect(resultado.length).toBe(2);
      expect(resultado[0].nome).toBe('Omelete');
      expect(resultado[0].correspondenciasCount).toBe(2);
      expect(resultado[1].nome).toBe('Arroz com Ovo');
      expect(resultado[1].correspondenciasCount).toBe(1);
    });
  });

  describe('ReceitaModel e importação idempotente', () => {
    let mockClient;
    let mockPool;

    beforeEach(() => {
      mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      mockPool = {
        connect: jest.fn().mockResolvedValue(mockClient),
        query: jest.fn(),
      };
    });

    it('upsert deve executar SQL com ON CONFLICT (fonte, fonte_id)', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 'uuid-rec-1', nome: 'Bolo' }],
      });

      const receita = {
        nome: 'Bolo',
        modo_preparo: 'Asse.',
        imagem_url: 'http://img.com/bolo.jpg',
        fonte: 'estatico',
        fonte_id: 'estatico-001',
      };

      const res = await ReceitaModel.upsert(mockClient, receita);
      expect(res).toEqual({ id: 'uuid-rec-1', nome: 'Bolo' });
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (fonte, fonte_id)'),
        expect.arrayContaining(['Bolo', 'estatico', 'estatico-001']),
      );
    });

    it('sincronizarIngredientes deve deletar existentes e inserir os novos', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await ReceitaModel.sincronizarIngredientes(mockClient, 'rec-1', ['ovo', 'leite']);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM receita_ingredientes WHERE receita_id = $1'),
        ['rec-1'],
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO receita_ingredientes'),
        ['rec-1', 'ovo'],
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO receita_ingredientes'),
        ['rec-1', 'leite'],
      );
    });

    it('importarDataset deve executar dentro de uma transação com BEGIN e COMMIT', async () => {
      mockClient.query.mockResolvedValue({
        rows: [{ id: 'uuid-1', nome: 'Teste' }],
      });

      const providerMock = {
        obterTodasReceitas: jest.fn().mockResolvedValue([
          {
            fonte_id: 'id-1',
            nome: 'Receita 1',
            modo_preparo: 'Preparo 1',
            imagem_url: null,
            fonte: 'estatico',
            ingredientes: ['ing1'],
          },
        ]),
      };

      const total = await importarDataset(mockPool, providerMock);

      expect(total).toBe(1);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('importarDataset deve dar ROLLBACK em caso de falha', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(new Error('Erro no banco')); // Falha no upsert

      const providerMock = {
        obterTodasReceitas: jest
          .fn()
          .mockResolvedValue([
            { fonte_id: 'id-1', nome: 'Erro', modo_preparo: 'X', ingredientes: [] },
          ]),
      };

      await expect(importarDataset(mockPool, providerMock)).rejects.toThrow('Erro no banco');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });
});
