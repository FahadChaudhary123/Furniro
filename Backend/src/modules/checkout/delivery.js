export function fields(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new Error('Unsupported checkout fields');
  }
}

function text(value, max, optional = false) {
  if (optional && value === undefined) return '';
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u001f\u007f]/u.test(value) ||
      (!optional && !value.trim())) throw new Error('Invalid delivery details');
  return value.trim();
}

/** Shape validation only: this does not verify a phone number or delivery coverage. */
export function validateDelivery(input) {
  fields(input, ['recipientName', 'phone', 'addressLine1', 'addressLine2', 'city', 'postalCode', 'country']);
  if (input.country !== 'PK') throw new Error('Delivery must be within Pakistan');
  const phone = text(input.phone, 30);
  if (!/^\+?[0-9 ()-]{7,30}$/.test(phone) || phone.replace(/\D/g, '').length < 7) {
    throw new Error('Invalid delivery phone');
  }
  return Object.freeze({
    recipientName: text(input.recipientName, 100), phone,
    addressLine1: text(input.addressLine1, 200), addressLine2: text(input.addressLine2, 200, true),
    city: text(input.city, 100), postalCode: text(input.postalCode, 20, true), country: 'PK',
  });
}

