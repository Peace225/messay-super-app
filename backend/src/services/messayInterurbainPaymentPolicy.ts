/**
 * MESSAY — revue déterministe d'un paiement de transport interurbain.
 * AUCUN effet de bord : ne valide pas un paiement et n'émet pas de billet.
 * Un résultat CANDIDAT_TRANSACTION exige ENCORE une RPC atomique SQL
 * re-vérifiant chaque ligne sous verrou et créant exactement un billet.
 */
export type PaymentDecision = Readonly<{
  action: 'ATTENDRE' | 'RAPPROCHER' | 'CANDIDAT_TRANSACTION' | 'DEJA_TRAITE';
  reason: string;
}>;

export type InterurbainPaymentSnapshot = Readonly<{
  intent: {
    id: string;
    companyId: string;
    affectationId: string;
    holdId: string;
    actorUserId: string;
    requestId: string;
    amountXof: number;
    providerReference: string | null;
    checkoutState: string;
    financialStatus: string;
    issuanceStatus: string;
    ticketId?: string | null;
    holdExpiresAt: string;
  };
  hold: {
    id: string;
    companyId: string;
    affectationId: string;
    actorUserId: string;
    requestId: string;
    status: string;
    expiresAt: string;
  };
  departure: {
    companyId: string;
    id: string;
    status: string;
    departsAt: string;
  };
  provider: {
    reference: unknown;
    environment: unknown;
    currency: unknown;
    amount: unknown;
    status: unknown;
    metadata: unknown;
  };
}>;

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function time(value: string): number {
  return typeof value === 'string' ? Date.parse(value) : NaN;
}
const wait = (reason: string): PaymentDecision => ({ action: 'ATTENDRE', reason });
const review = (reason: string): PaymentDecision => ({ action: 'RAPPROCHER', reason });

/**
 * `provider` DOIT être une réponse serveur obtenue directement auprès de GeniusPay,
 * jamais une réponse du téléphone ou un webhook non vérifié.
 */
export function examinerPaiementInterurbain(
  snapshot: InterurbainPaymentSnapshot,
  nowMs: number = Date.now(),
): PaymentDecision {
  const { intent: i, hold: h, departure: d, provider: p } = snapshot;
  if (!Number.isFinite(nowMs)) return review('HORLOGE_INVALIDE');
  if (!UUID.test(i.id) || !UUID.test(i.companyId) ||
      !UUID.test(i.affectationId) || !UUID.test(i.holdId) ||
      !UUID.test(i.actorUserId) || !UUID.test(i.requestId)) {
    return review('IDENTIFIANTS_INCOHERENTS');
  }
  if (i.financialStatus === 'SUCCEEDED' && i.issuanceStatus === 'ISSUED') {
    return typeof i.ticketId === 'string' && UUID.test(i.ticketId)
      ? { action: 'DEJA_TRAITE', reason: 'BILLET_EXISTANT' }
      : review('EMISSION_SANS_IDENTIFIANT');
  }
  if (i.financialStatus !== 'PENDING' || i.issuanceStatus !== 'NOT_ISSUED') {
    return review('ETAT_INTENTION_INCOHERENT');
  }
  if (i.checkoutState !== 'READY') return review('CHECKOUT_NON_PRET');
  if (!i.providerReference || p.reference !== i.providerReference ||
      p.currency !== 'XOF' || p.environment !== 'live' ||
      !Number.isSafeInteger(i.amountXof) || i.amountXof < 200 ||
      i.amountXof > 2_500_000 || p.amount !== i.amountXof ||
      !isRecord(p.metadata) || p.metadata.order_id !== i.id ||
      p.metadata.company_id !== i.companyId) {
    return review('MONTANT_REFERENCE_OU_METADATA_DIFFERENTS');
  }
  if (p.status === 'pending' || p.status === 'processing') {
    return wait('PAIEMENT_EN_COURS');
  }
  if (p.status !== 'completed') {
    return review('PAIEMENT_NON_CONFIRME_OU_REMBOURSE');
  }
  if (h.id !== i.holdId || h.companyId !== i.companyId ||
      h.affectationId !== i.affectationId ||
      h.actorUserId !== i.actorUserId || h.requestId !== i.requestId ||
      d.id !== i.affectationId || d.companyId !== i.companyId) {
    return review('TENANT_HOLD_AFFECTATION_INCOHERENTS');
  }
  if (h.status !== 'EN_ATTENTE') return review('HOLD_NON_ACTIF');
  const holdTime = time(h.expiresAt);
  const intentTime = time(i.holdExpiresAt);
  const departureTime = time(d.departsAt);
  if (![holdTime, intentTime, departureTime].every(Number.isFinite) ||
      holdTime !== intentTime || holdTime <= nowMs) {
    return review('HOLD_EXPIRE_OU_DIVERGENT');
  }
  if (!['PROGRAMME', 'PROGRAMMEE'].includes(d.status.toUpperCase()) ||
      departureTime <= nowMs) return review('DEPART_FERME_OU_PASSE');
  return {
    action: 'CANDIDAT_TRANSACTION',
    reason: 'REVALIDATION_SQL_ATOMIQUE_OBLIGATOIRE',
  };
}
