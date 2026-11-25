
/**
 * MESSAY PRO — Dashboard d'accueil des agents (/agent).
 * Sélectionne le dashboard selon le rôle confirmé par le backend.
 */
import { Navigate, useOutletContext } from 'react-router-dom';
import type { GareAccessContext } from '../../services/garesManagementApi';

import AgentDashboard from './AgentDashboard';
import AgentCaisseDashboard from './AgentCaisseDashboard';
import AgentEmbarquementDashboard from './AgentEmbarquementDashboard';
import AgentExploitationDashboard from './AgentExploitationDashboard';

export default function AgentRoleDashboard() {
  const access = useOutletContext<GareAccessContext | undefined>();

  if (!access || !Array.isArray(access.gare_ids) || access.gare_ids.length === 0) {
    return (
      <section
        role="alert"
        className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700"
      >
        Aucune gare autorisée pour ce compte.
        Contactez votre chef de gare.
      </section>
    );
  }

  switch (access.role) {
    case 'AGENT_BILLETTERIE':
      return <AgentDashboard />;

    case 'AGENT_CAISSE':
      return <AgentCaisseDashboard access={access} />;

    case 'AGENT_EMBARQUEMENT':
      return <AgentEmbarquementDashboard access={access} />;

    case 'AGENT_EXPLOITATION':
      return <AgentExploitationDashboard access={access} />;

    case 'DIRECTION':
      return <Navigate to="/" replace />;

    case 'CHEF_GARE':
      return <Navigate to="/chef-gare" replace />;

    default:
      return <Navigate to="/login" replace />;
  }
}
