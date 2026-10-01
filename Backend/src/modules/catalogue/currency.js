/** The catalogue has one currency; every served product inherits it. */
export const SUPPORTED_CURRENCIES = ['IDR', 'PKR'];

export function assertCurrency(currency) {
  if (!SUPPORTED_CURRENCIES.includes(currency)) {
    throw new Error(`Catalogue currency must be one of: ${SUPPORTED_CURRENCIES.join(', ')}`);
  }
  return currency;
}
