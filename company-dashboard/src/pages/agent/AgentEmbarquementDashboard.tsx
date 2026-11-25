/** Dashboard dédié à l'AGENT_EMBARQUEMENT. */
import { ClipboardList, QrCode, ScanLine, UsersRound } from 'lucide-react';
import type { GareAccessContext } from '../../services/garesManagementApi';
import AgentWorkspaceDashboard, { type AgentDashboardConfig } from './AgentWorkspaceDashboard';

const CONFIG: AgentDashboardConfig = {
  role: 'AGENT_EMBARQUEMENT',
  accent: 'sky',
  eyebrow: 'Agent d’embarquement',
  title: 'Contrôle des embarquements',
  description: 'Vérifiez les billets et les passagers avec les outils autorisés, puis remontez les anomalies au Chef de Gare.',
  icon: ScanLine,
  operationMode: 'embarquement',
  operationsPath: '/agent/embarquement',
  operationTitle: 'Contrôle des passagers',
  operationDescription: 'Le module d’embarquement existant conserve les vérifications et traitements de billets.',
  tasks: [
    { title: 'Contrôle des billets', description: 'Vérifier les titres de transport à l’aide du système de la compagnie.', icon: QrCode, to: '/agent/embarquement', cta: 'Contrôler les billets' },
    { title: 'Liste d’embarquement', description: 'Consulter uniquement les passagers et départs effectivement autorisés.', icon: UsersRound, to: '/agent/embarquement', cta: 'Accéder à l’embarquement' },
    { title: 'Rapport d’embarquement', description: 'Signaler les incidents, les refus et les situations à régulariser.', icon: ClipboardList, to: '/agent/rapports', cta: 'Rédiger mon rapport' },
  ],
  steps: [
    { title: 'Identifier le départ', detail: 'Vérifier la ligne, l’horaire et les informations du voyage prévu.' },
    { title: 'Vérifier le billet', detail: 'Contrôler sa validité et son statut côté serveur avant de confirmer le passage.' },
    { title: 'Signaler les anomalies', detail: 'Transmettre au Chef de Gare les incidents et les refus nécessitant un suivi.' },
  ],
  warning: 'Un QR code affiché ne suffit pas à prouver un embarquement. La validation doit être atomique et réalisée côté backend pour éviter tout double passage.',
};

export default function AgentEmbarquementDashboard({ access }: { access: GareAccessContext }) {
  return <AgentWorkspaceDashboard access={access} config={CONFIG} />;
}
