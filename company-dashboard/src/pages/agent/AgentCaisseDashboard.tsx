/**
 * MESSAY PRO — Tableau de bord de l'agent de caisse.
 * Le rôle et les gares autorisées proviennent du contexte vérifié par le backend.
 * Les opérations réelles restent prises en charge par AgentOperationsPage,
 * via le composant partagé AgentWorkspaceDashboard.
 */
import { Banknote, ClipboardCheck, ReceiptText, Wallet } from 'lucide-react';
import type { GareAccessContext } from '../../services/garesManagementApi';
import AgentWorkspaceDashboard, {
  type AgentDashboardConfig,
} from './AgentWorkspaceDashboard';

type Props = {
  access: GareAccessContext;
};

const CONFIG = {
  role: 'AGENT_CAISSE',
  accent: 'orange',
  eyebrow: 'Agent de caisse',
  title: 'Ma caisse, mes opérations',
  description:
    'Consultez vos opérations autorisées, contrôlez les justificatifs et préparez votre rapport à transmettre au Chef de Gare.',
  icon: Wallet,
  operationMode: 'caisse',
  operationsPath: '/agent/caisse',
  operationTitle: 'Opérations de caisse',
  operationDescription:
    'Consultez les mouvements réellement disponibles dans le module de caisse connecté au backend.',
  tasks: [
    {
      title: 'Mouvements de caisse',
      description:
        'Consulter les encaissements et remboursements accessibles à votre compte.',
      icon: Banknote,
      to: '/agent/caisse',
      cta: 'Voir ma caisse',
    },
    {
      title: 'Contrôle des justificatifs',
      description:
        'Comparer les transactions enregistrées aux justificatifs disponibles et signaler les écarts.',
      icon: ReceiptText,
      to: '/agent/caisse',
      cta: 'Consulter les mouvements',
    },
    {
      title: 'Rapport de caisse',
      description:
        'Déclarer les espèces réellement détenues et transmettre vos observations au Chef de Gare.',
      icon: ClipboardCheck,
      to: '/agent/rapports',
      cta: 'Ouvrir mes rapports',
    },
  ],
  steps: [
    {
      title: 'Vérifier les opérations',
      detail:
        'Distinguer les paiements confirmés, les remboursements et les opérations en attente.',
    },
    {
      title: 'Contrôler les justificatifs',
      detail:
        'Identifier et documenter tout écart sans altérer les montants enregistrés.',
    },
    {
      title: 'Soumettre le rapport',
      detail:
        'Communiquer le montant des espèces et les observations au Chef de Gare.',
    },
  ],
  warning:
    'Un paiement en attente n’est pas un encaissement confirmé. Les totaux consolidés, le rapprochement et la clôture de caisse doivent être sécurisés et validés côté serveur.',
} satisfies AgentDashboardConfig;

export default function AgentCaisseDashboard({ access }: Props) {
  if (access.role !== 'AGENT_CAISSE') {
    return (
      <section
        role="alert"
        className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700"
      >
        Accès réservé aux agents de caisse.
      </section>
    );
  }

  if (!Array.isArray(access.gare_ids) || access.gare_ids.length === 0) {
    return (
      <section
        role="alert"
        className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
      >
        Aucune gare autorisée. Contactez votre Chef de Gare.
      </section>
    );
  }

  return <AgentWorkspaceDashboard access={access} config={CONFIG} />;
}
