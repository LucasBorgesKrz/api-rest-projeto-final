/**
 * Monta o objeto `meta` da resposta: metadados de paginação + links HATEOAS.
 *
 * @param {object} opcoes
 * @param {number} opcoes.totalItems  total de itens que casam com os filtros (antes de paginar)
 * @param {number} opcoes.page        página atual (já validada)
 * @param {number} opcoes.limit       itens por página (já limitado a 100)
 * @param {string} opcoes.caminho     caminho base, ex.: "/produtos"
 * @param {Record<string, string|number|boolean|undefined>} opcoes.extras
 *        demais query params (sort, order, filtros) que devem ser mantidos nos links
 */
export const montarMeta = ({ totalItems, page, limit, caminho, extras = {} }) => {
  const totalPages = Math.ceil(totalItems / limit);
  const ultima = Math.max(totalPages, 1);

  // page e limit primeiro (como no exemplo do enunciado), depois sort/order/filtros.
  const link = (numeroPagina) => {
    const params = new URLSearchParams({ page: String(numeroPagina), limit: String(limit) });
    for (const [chave, valor] of Object.entries(extras)) {
      if (valor !== undefined) params.set(chave, String(valor));
    }
    return `${caminho}?${params}`;
  };

  return {
    totalItems,
    itemsPerPage: limit,
    currentPage: page,
    totalPages,
    // HATEOAS: o cliente segue estes links em vez de montar URLs manualmente.
    first: link(1),
    prev: page > 1 ? link(Math.min(page - 1, ultima)) : null,
    next: page < totalPages ? link(page + 1) : null,
    last: link(ultima),
  };
};
