/**
 * Point d'entrée de planification pour les Agents d'exploitation.
 * Le formulaire de planification est partagé avec les Chefs de gare, mais
 * l'accès aux actions est également vérifié côté API et SQL Supabase.
 */
import { Navigate, useOutletContext } from 'react-router-dom';
import type { GareAccessContext } from '../../services/garesManagementApi';
import PlanningGarePage from '../chef/PlanningGarePage';

export default function AgentPlanningPage() {
  const access = useOutletContext<GareAccessContext>();
  if (!access || access.role !== 'AGENT_EXPLOITATION') {
    return <Navigate to="/agent" replace />;
  }
  return <PlanningGarePage />;
}
