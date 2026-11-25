import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { MailPlus, ShieldCheck, Users, UserMinus, XCircle, History, RefreshCw } from 'lucide-react';
import {
  garesHierarchyApi,
  garesManagementApi,
  type GareInvitation,
  type GareResponsable,
  type GareStaffAgent,
  type GareAccessRole,
} from '../../services/garesManagementApi';
import {
  Alert, Card, ChefPage, EmptyState, Field, StationScope, StatusTag,
  actionClass, inputClass, toMessage, useChefStation,
} from './ChefShared';

type AgentRole = Exclude<GareAccessRole, 'DIRECTION' | 'CHEF_GARE'>;

const agentRoles: { value: AgentRole; label: string }[] = [
  { value: 'AGENT_BILLETTERIE', label: 'Agent de billetterie' },
  { value: 'AGENT_CAISSE', label: 'Agent de caisse' },
  { value: 'AGENT_EMBARQUEMENT', label: 'Agent d’embarquement' },
  { value: 'AGENT_EXPLOITATION', label: 'Agent d’exploitation' },
];

const isAgent = (role: GareAccessRole): role is AgentRole =>
  agentRoles.some((item) => item.value === role);

const roleLabel = (role: string) =>
  agentRoles.find((item) => item.value === role)?.label ?? role.replaceAll('_', ' ');

export default function ChefAgentsPage() {
  const station = useChefStation();
  const gareId = station.gare?.id ?? '';
  const latestGareId = useRef(gareId);
  latestGareId.current = gareId;

  const [invitations, setInvitations] = useState<GareInvitation[]>([]);
  const [agents, setAgents] = useState<GareStaffAgent[]>([]);
  const [responsables, setResponsables] = useState<GareResponsable[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AgentRole>('AGENT_BILLETTERIE');

  const reload = useCallback(async () => {
    if (!gareId) {
      setInvitations([]);
      setAgents([]);
      setResponsables([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const [invitationsResponse, overviewResponse, agentsResponse] = await Promise.all([
        garesHierarchyApi.invitations(gareId),
        garesManagementApi.overview(gareId),
        garesHierarchyApi.agents(gareId),
      ]);

      // Évite d'afficher les données de la précédente gare lors d'un changement de sélection.
      if (latestGareId.current !== gareId) return;
      setInvitations(invitationsResponse.invitations.filter(
        (inv) => inv.gare_id === gareId && isAgent(inv.role)
      ));
      setResponsables(overviewResponse.responsables);
      setAgents(agentsResponse.agents.filter(
        (agent) => agent.gare_id === gareId && agent.actif && isAgent(agent.role)
      ));
    } catch (err) {
      if (latestGareId.current === gareId) setError(toMessage(err));
    } finally {
      if (latestGareId.current === gareId) setLoading(false);
    }
  }, [gareId]);

  useEffect(() => { void reload(); }, [reload]);

  const visibleInvitations = useMemo(() => (
    showHistory
      ? invitations
      : invitations.filter((inv) => inv.statut === 'en_attente')
  ), [invitations, showHistory]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!gareId || saving || busyId) return;
    setError('');
    setNotice('');
    setSaving(true);
    try {
      await garesHierarchyApi.invite(gareId, {
        nom: name.trim(),
        email: email.trim().toLowerCase(),
        role,
      });
      setNotice('MESSAY PRO : invitation enregistrée. Le destinataire devra confirmer son accès.');
      setName('');
      setEmail('');
      await reload();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function cancelInvitation(invitation: GareInvitation) {
    if (!gareId || busyId || saving || invitation.statut !== 'en_attente' || !isAgent(invitation.role)) return;
    if (!window.confirm(`Annuler l'invitation de ${invitation.nom} (${invitation.email}) ?\n\nLe lien ne permettra plus d'activer l'accès.`)) return;

    setBusyId(invitation.id);
    setError('');
    setNotice('');
    try {
      await garesHierarchyApi.cancelInvitation(gareId, invitation.id);
      setNotice(`MESSAY PRO : l'invitation de ${invitation.nom} a été annulée.`);
      await reload();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function removeAgentAccess(agent: GareStaffAgent) {
    if (!gareId || busyId || saving || !agent.actif || !isAgent(agent.role)) return;
    const label = agent.nom || agent.email || 'cet agent';
    if (!window.confirm(
      `Retirer l'accès de ${label} à cette gare ?\n\n` +
      'Cette opération désactive ses droits MESSAY PRO dans cette gare. ' +
      'Elle ne supprime pas son identité ni les ventes et rapports déjà enregistrés.'
    )) return;

    setBusyId(agent.id);
    setError('');
    setNotice('');
    try {
      await garesHierarchyApi.removeAgentAccess(gareId, agent.id);
      setNotice(`MESSAY PRO : accès de ${label} à la gare désactivé.`);
      await reload();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ChefPage
      title="Agents de ma gare"
      description="Invitez vos agents, gérez leurs invitations et leurs accès à la gare. Les droits sont contrôlés par le serveur MESSAY PRO."
    >
      <StationScope
        gares={station.gares}
        selectedId={station.selectedId}
        onSelect={station.setSelectedId}
        onReload={() => { void station.reload(); void reload(); }}
        loading={station.loading || loading}
      />
      {station.error && <Alert>{station.error}</Alert>}
      {error && <Alert>{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}
      {!station.loading && !gareId && <Alert>Aucune gare autorisée pour ce compte.</Alert>}

      {gareId && (
        <>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <Card>
              <div className="mb-5 flex items-center gap-3">
                <MailPlus className="text-orange-600" size={22} />
                <h3 className="text-lg font-black">Inviter un agent</h3>
              </div>
              <form onSubmit={(event) => { void submit(event); }} className="space-y-4">
                <Field label="Nom complet">
                  <input required minLength={3} maxLength={160} autoComplete="name" value={name}
                    onChange={(event) => setName(event.target.value)} className={inputClass} placeholder="Nom et prénom" />
                </Field>
                <Field label="E-mail professionnel">
                  <input required type="email" maxLength={254} autoComplete="email" value={email}
                    onChange={(event) => setEmail(event.target.value)} className={inputClass} placeholder="agent@compagnie.ci" />
                </Field>
                <Field label="Fonction">
                  <select className={inputClass} value={role} onChange={(event) => setRole(event.target.value as AgentRole)}>
                    {agentRoles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </Field>
                <button type="submit" disabled={saving || busyId !== null || loading} className={actionClass}>
                  <MailPlus size={17} />{saving ? 'Envoi…' : "Envoyer l'invitation"}
                </button>
              </form>
              <p className="mt-4 text-xs leading-5 text-slate-500">
                Le Chef de gare ne peut pas nommer ni supprimer un autre Chef. Ces décisions relèvent de la Direction.
              </p>
            </Card>

            <Card>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Users className="text-orange-600" size={22} />
                  <h3 className="text-lg font-black">Demandes d'invitation</h3>
                </div>
                <button type="button" onClick={() => setShowHistory((value) => !value)}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  <History size={15} />{showHistory ? 'Masquer l’historique' : 'Voir l’historique'}
                </button>
              </div>
              <p className="mb-3 text-xs text-slate-500">
                {showHistory ? 'Historique des demandes conservé pour le suivi.' : 'Seules les invitations en attente sont affichées.'}
              </p>
              {loading ? <p className="text-sm text-slate-500">Chargement des invitations…</p> :
                visibleInvitations.length === 0 ? <EmptyState>Aucune invitation à afficher.</EmptyState> : (
                  <div className="space-y-3">
                    {visibleInvitations.map((inv) => (
                      <div key={inv.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900">{inv.nom}</p>
                          <p className="break-all text-sm text-slate-600">{inv.email}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {roleLabel(inv.role)} · {new Date(inv.created_at).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusTag value={inv.statut} />
                          {inv.statut === 'en_attente' && (
                            <button type="button" disabled={busyId !== null || saving}
                              onClick={() => { void cancelInvitation(inv); }}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
                              <XCircle size={15} />{busyId === inv.id ? 'Annulation…' : 'Annuler'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </Card>
          </div>

          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <UserMinus className="text-orange-600" size={22} />
                <h3 className="text-lg font-black">Comptes agents actifs</h3>
              </div>
              <button type="button" onClick={() => { void reload(); }} disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                <RefreshCw size={15} /> Actualiser
              </button>
            </div>
            <p className="mb-4 text-xs text-slate-500">
              « Retirer l'accès » désactive uniquement le rôle de l'agent dans cette gare. Le compte de connexion n'est pas effacé.
            </p>
            {loading ? <p className="text-sm text-slate-500">Chargement des comptes…</p> :
              agents.length === 0 ? <EmptyState>Aucun compte agent actif dans cette gare.</EmptyState> : (
                <div className="grid gap-3 md:grid-cols-2">
                  {agents.map((agent) => (
                    <div key={agent.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 p-4">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900">{agent.nom || `Compte ${agent.auth_user_id.slice(0, 8)}`}</p>
                        {agent.email && <p className="break-all text-sm text-slate-600">{agent.email}</p>}
                        <p className="mt-1 text-xs text-orange-700">{roleLabel(agent.role)}</p>
                      </div>
                      <button type="button" disabled={busyId !== null || saving}
                        onClick={() => { void removeAgentAccess(agent); }}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">
                        <UserMinus size={15} />{busyId === agent.id ? 'Retrait…' : "Retirer l'accès"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
          </Card>

          <Card>
            <div className="mb-4 flex items-center gap-3">
              <ShieldCheck className="text-orange-600" size={22} />
              <h3 className="text-lg font-black">Annuaire des responsables</h3>
            </div>
            <p className="mb-4 text-xs text-slate-500">
              Cet annuaire administratif est distinct des comptes de connexion. Désactiver un responsable ici ne retirerait pas automatiquement ses accès.
            </p>
            {loading ? <p className="text-sm text-slate-500">Chargement…</p> :
              responsables.length === 0 ? <EmptyState>Aucun responsable enregistré dans l'annuaire de la gare.</EmptyState> : (
                <div className="grid gap-3 md:grid-cols-2">
                  {responsables.map((r) => (
                    <div key={r.id} className="rounded-xl border border-slate-200 p-4">
                      <p className="font-bold text-slate-900">{r.nom}</p>
                      <p className="text-sm text-orange-700">{r.fonction}</p>
                      {r.email && <p className="mt-1 break-all text-sm text-slate-500">{r.email}</p>}
                      {r.telephone && <p className="text-sm text-slate-500">{r.telephone}</p>}
                    </div>
                  ))}
                </div>
              )}
          </Card>
        </>
      )}
    </ChefPage>
  );
}
