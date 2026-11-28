/** Fonctions utilitaires partagées, sans données de démonstration. */
export function formatAmount(value: unknown, suffix = '', digits = 0): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${value.toLocaleString('fr-FR', { maximumFractionDigits: digits })}${suffix}` : '—';
}
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'Non renseigné';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('fr-FR');
}
export function exportCsv(name: string, columns: string[], rows: unknown[][]): void {
  const escape = (value: unknown): string => {
    const text = value === null || value === undefined ? '' : String(value);
    // Prévention d'injection de formule dans les tableurs.
    const safe = /^[\s]*[=+@\-\t\r]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const csv = '\uFEFF' + [columns, ...rows].map(row => row.map(escape).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
