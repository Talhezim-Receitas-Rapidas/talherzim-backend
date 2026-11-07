const { ReceitaModel } = require('../models/receitaModel');
const { ReceitaService, comTimeout } = require('./receitaService');
const { TheMealDBProvider, normalizar, nomes } = require('../providers/theMealDBProvider');
const { TranslationService } = require('./translationService');

function compativel(a, b) {
  const primeiro = normalizar(a);
  const segundo = normalizar(b);
  return primeiro === segundo || (nomes[primeiro] || primeiro) === (nomes[segundo] || segundo);
}

class RecipeSuggestionService extends ReceitaService {
  constructor(pool, externo = new TheMealDBProvider()) {
    super(pool);
    this.externo = externo;
    this.estatico = this.staticProvider;
    this.tradutor = new TranslationService(pool);
  }

  async locais() {
    let banco;
    try {
      banco = await comTimeout(ReceitaModel.listarTodas(this.pool), 2000);
    } catch {
      banco = [];
    }
    const estaticas = await this.estatico.obterTodasReceitas();
    const chaves = new Set(banco.map((r) => `${r.fonte}:${r.fonte_id}`));
    return [...banco, ...estaticas.filter((r) => !chaves.has(`${r.fonte}:${r.fonte_id}`))].map(
      (r) => ({ ...r, id: r.id || r.fonte_id, externa: false }),
    );
  }

  async sugerir(usuarioId, busca = '') {
    const { rows } = await comTimeout(
      this.pool.query('SELECT nome FROM ingredientes WHERE usuario_id = $1 ORDER BY criado_em', [
        usuarioId,
      ]),
      2000,
    );
    const ingredientes = [...new Set(rows.map((r) => r.nome))];
    const locais = await this.locais();
    const pontuar = (receita) => {
      const presentes = receita.ingredientes.filter((ing) =>
        ingredientes.some((nome) => compativel(nome, typeof ing === 'string' ? ing : ing.nome)),
      );
      return {
        ...receita,
        correspondencias: presentes.length,
        totalIngredientes: receita.ingredientes.length,
      };
    };
    const termo = normalizar(busca);
    const receitas = locais
      .map(pontuar)
      .filter((r) =>
        busca
          ? normalizar(r.nome).includes(termo) ||
            r.ingredientes.some((ing) => normalizar(ing).includes(termo) || compativel(busca, ing))
          : r.correspondencias > 0,
      );
    const semCobertura = busca
      ? receitas.length
        ? []
        : [busca]
      : ingredientes.filter(
          (nome) => !locais.some((r) => r.ingredientes.some((ing) => compativel(nome, ing))),
        );
    const avisos = [];
    // Limita o número de chamadas por requisição, mantendo explícitos os itens pendentes.
    for (const ingrediente of semCobertura.slice(0, 5)) {
      try {
        const externas = (await this.externo.buscarReceitas(ingrediente)).filter(Boolean);
        externas.forEach((r) =>
          receitas.push({ ...pontuar(r), ingredienteConsultado: ingrediente }),
        );
        avisos.push(
          externas.length
            ? `Consulta externa realizada para ${ingrediente}.`
            : `Não encontramos receitas para ${ingrediente} na fonte externa. Confira o nome ou tente outro ingrediente.`,
        );
      } catch {
        avisos.push(`A consulta externa para ${ingrediente} está indisponível. Tente novamente.`);
      }
    }
    if (semCobertura.length > 5)
      avisos.push(
        'Consultamos até 5 ingredientes sem receitas por vez. Reduza a lista para consultar os demais.',
      );
    const unicas = [...new Map(receitas.map((r) => [r.id, r])).values()];
    return {
      receitas: unicas.sort((a, b) => b.correspondencias - a.correspondencias),
      avisos,
      despensaVazia: ingredientes.length === 0,
    };
  }

  async buscarPorId(id) {
    if (/^externa-\d+$/.test(id)) {
      const receita = await this.externo.buscarPorId(id.slice(8));
      if (!receita) return null;
      try {
        return await this.tradutor.traduzirReceita(receita);
      } catch {
        return {
          ...receita,
          avisoTraducao:
            'A tradução está indisponível no momento. Exibindo o conteúdo original. Tente novamente em instantes.',
        };
      }
    }
    return (
      (await this.locais()).find(
        (r) => r.id === id || (r.fonte === 'estatico' && r.fonte_id === id),
      ) || null
    );
  }
}

module.exports = { RecipeSuggestionService };
