const nomes = {
  arroz: 'rice',
  pepino: 'cucumber',
  pepinos: 'cucumber',
  batata: 'potatoes',
  batatas: 'potatoes',
  frango: 'chicken',
  ovo: 'egg',
  ovos: 'egg',
  tomate: 'tomatoes',
  cebola: 'onion',
  alho: 'garlic',
  cenoura: 'carrots',
  queijo: 'cheese',
  leite: 'milk',
  carne: 'beef',
  abobrinha: 'courgettes',
  abobrina: 'courgettes',
  berinjela: 'aubergine',
  lentilha: 'lentils',
  grao_de_bico: 'chickpeas',
  salmao: 'salmon',
  feijao: 'beans',
  macarrao: 'pasta',
  cogumelo: 'mushrooms',
  brocolis: 'broccoli',
};

function normalizar(nome) {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
}

class TheMealDBProvider {
  constructor(fetcher = fetch) {
    this.fetcher = fetcher;
  }

  async consultar(endpoint) {
    const chave = encodeURIComponent(process.env.THEMEALDB_API_KEY || '1');
    const response = await this.fetcher(
      `https://www.themealdb.com/api/json/v1/${chave}/${endpoint}`,
      {
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok) throw new Error('Serviço externo indisponível');
    const data = await response.json();
    return data.meals || [];
  }

  async buscarReceitas(ingrediente) {
    const termo = nomes[normalizar(ingrediente)] || normalizar(ingrediente);
    const meals = await this.consultar(`filter.php?i=${encodeURIComponent(termo)}`);
    const resultados = await Promise.allSettled(
      meals.slice(0, 3).map((meal) => this.buscarPorId(meal.idMeal)),
    );
    const receitas = resultados
      .filter((resultado) => resultado.status === 'fulfilled' && resultado.value)
      .map((resultado) => resultado.value);
    if (!receitas.length && resultados.some((resultado) => resultado.status === 'rejected')) {
      throw new Error('Serviço externo indisponível');
    }
    return receitas;
  }

  async buscarPorId(id) {
    const [meal] = await this.consultar(`lookup.php?i=${encodeURIComponent(id)}`);
    if (!meal) return null;
    const ingredientes = [];
    for (let index = 1; index <= 20; index += 1) {
      const nome = meal[`strIngredient${index}`]?.trim();
      if (nome) ingredientes.push({ nome, quantidade: meal[`strMeasure${index}`]?.trim() });
    }
    return {
      id: `externa-${meal.idMeal}`,
      nome: meal.strMeal,
      imagem: meal.strMealThumb,
      ingredientes,
      modoPreparo: meal.strInstructions?.split(/\r?\n/).filter(Boolean) || [],
      fonte: 'TheMealDB',
      externa: true,
      origem: meal.strArea || null,
      fonteUrl: /^https?:\/\//i.test(meal.strSource || '') ? meal.strSource : null,
      idioma: 'en',
      totalIngredientes: ingredientes.length,
    };
  }
}

module.exports = { TheMealDBProvider, normalizar, nomes };
