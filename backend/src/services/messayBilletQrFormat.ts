/** MESSAY BUS QR v1. Opaque token issued atomically in public.tickets.qr_code.
 * A QR is NOT payment evidence; verification always rechecks DB status/ownership.
 */
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const PREFIX = 'MESSAY:BUS:V1:';

export function billetQrPayload(rawCode: string): string {
  if (typeof rawCode !== 'string' || !UUID.test(rawCode)) {
    throw new Error('MESSAY_QR_CODE_INVALIDE');
  }
  return `${PREFIX}${rawCode.toLowerCase()}`;
}

export function lireBilletQrPayload(payload: string): string {
  if (typeof payload !== 'string' || payload.length !== PREFIX.length + 36 ||
      !payload.startsWith(PREFIX)) {
    throw new Error('MESSAY_QR_FORMAT_INVALIDE');
  }
  const code = payload.slice(PREFIX.length);
  if (!UUID.test(code)) throw new Error('MESSAY_QR_FORMAT_INVALIDE');
  return code.toLowerCase();
}
