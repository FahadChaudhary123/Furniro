const normalise = (value) => value.toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

/** All query words must occur, but can be in either the name or description. */
export function matchesProductQuery(product, query) {
  const words = normalise(query).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = normalise(`${product.name} ${product.description}`);
  return words.every((word) => haystack.includes(word));
}
