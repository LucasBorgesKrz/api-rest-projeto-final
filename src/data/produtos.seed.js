/**
 * Gera 150 produtos de exemplo, de forma DETERMINÍSTICA (sempre os mesmos),
 * para os resultados da API e dos testes serem reproduzíveis.
 *
 * 5 categorias x 10 itens-base x 3 variantes = 150 produtos.
 */
const CATEGORIAS = {
  eletronicos: {
    faixa: [150, 3500],
    itens: ['Smartphone', 'Notebook', 'Fone de Ouvido', 'Smart TV', 'Tablet', 'Caixa de Som', 'Monitor', 'Teclado Mecânico', 'Mouse Gamer', 'Câmera de Segurança'],
  },
  livros: {
    faixa: [25, 120],
    itens: ['Romance', 'Ficção Científica', 'Biografia', 'Livro de Culinária', 'Guia de Viagem', 'Livro de Programação', 'Livro Infantil', 'Mangá', 'Livro de História', 'Livro de Autoajuda'],
  },
  moda: {
    faixa: [40, 400],
    itens: ['Camiseta', 'Calça Jeans', 'Jaqueta', 'Tênis', 'Vestido', 'Bermuda', 'Boné', 'Mochila', 'Relógio', 'Óculos de Sol'],
  },
  casa: {
    faixa: [80, 2500],
    itens: ['Sofá', 'Mesa de Jantar', 'Cadeira de Escritório', 'Luminária', 'Panela de Pressão', 'Jogo de Cama', 'Liquidificador', 'Cortina', 'Tapete', 'Estante'],
  },
  esportes: {
    faixa: [30, 1800],
    itens: ['Bola de Futebol', 'Bicicleta', 'Halter', 'Esteira', 'Corda de Pular', 'Tênis de Corrida', 'Luva de Boxe', 'Prancha de Surf', 'Raquete de Tênis', 'Kit de Yoga'],
  },
};

const VARIANTES = ['Básico', 'Plus', 'Premium'];

// Gerador pseudo-aleatório com semente fixa (mulberry32).
const criarAleatorio = (semente) => () => {
  semente |= 0;
  semente = (semente + 0x6d2b79f5) | 0;
  let t = Math.imul(semente ^ (semente >>> 15), 1 | semente);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const gerarProdutos = (quantidade = 150) => {
  const aleatorio = criarAleatorio(2026);
  const nomesCategorias = Object.keys(CATEGORIAS);
  const inicio = Date.UTC(2025, 0, 1);

  return Array.from({ length: quantidade }, (_, i) => {
    const categoria = nomesCategorias[i % nomesCategorias.length];
    const { faixa, itens } = CATEGORIAS[categoria];
    const item = itens[Math.floor(i / nomesCategorias.length) % itens.length];
    const variante = VARIANTES[Math.floor(i / 50) % VARIANTES.length];
    const ativo = aleatorio() > 0.2;

    const preco = Math.round((faixa[0] + aleatorio() * (faixa[1] - faixa[0])) * 100) / 100;
    const estoque = ativo ? Math.floor(aleatorio() * 200) : 0;
    const criadoEm = new Date(inicio + i * 86_400_000 + Math.floor(aleatorio() * 86_400_000)).toISOString();

    return {
      id: i + 1,
      nome: `${item} ${variante}`,
      categoria,
      preco,
      estoque,
      ativo,
      criadoEm,
      atualizadoEm: criadoEm,
      criadoPor: null, // produtos de exemplo não têm autor
    };
  });
};
