/** MESSAY BUS QR V1 - format only, NOT a proof of payment or boarding entitlement. */
const QR = /^MESSAY:BUS:V1:([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})$/i;

export function normaliserQrMessayBrut(value: unknown): string {
  if (typeof value !== 'string') throw new Error('QR non reconnu');
  const trimmed = value.trim();
  const match = QR.exec(trimmed);
  if (!match || trimmed.length !== 50) throw new Error('QR MESSAY BUS invalide');
  return `MESSAY:BUS:V1:${match[1].toLowerCase()}`;
}
