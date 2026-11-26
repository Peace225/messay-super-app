/**
 * MESSAY PRO — Socle visuel partagé des dashboards agents.
 * Ne calcule aucun chiffre métier à partir d'une liste partielle ou non autorisée.
 * Le module opérationnel existant reste responsable des appels API réels.
 */
import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  ClipboardList,
  MapPin,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import type { GareAccessContext, GareAccessRole } from '../../services/garesManagementApi';
import AgentOperationsPage from './AgentOperationsPage';

type OperationMode = 'caisse' | 'embarquement' | 'exploitation';
type Accent = 'orange' | 'sky' | 'emerald';

export interface DashboardTask {
  title: string;
  description: string;
  icon: LucideIcon;
  to: string;
  cta: string;
}

export interface AgentDashboardConfig {
  role: GareAccessRole;
  accent: Accent;
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  operationMode: OperationMode;
  operationsPath: string;
  operationTitle: string;
  operationDescription: string;
  steps: readonly { title: string; detail: string }[];
  tasks: readonly DashboardTask[];
  warning: string;
}

interface Props {
  access: GareAccessContext;
  config: AgentDashboardConfig;
}

const THEMES: Record<Accent, {
  gradient: string;
  pill: string;
  icon: string;
  button: string;
  task: string;
  link: string;
}> = {
  orange: {
    gradient: 'from-[#101827] via-[#1b2b41] to-[#533019]',
    pill: 'border-orange-300/25 bg-orange-400/15 text-orange-100',
    icon: 'bg-orange-400/20 text-orange-200',
    button: 'bg-orange-500 hover:bg-orange-600 focus-visible:ring-orange-400',
    task: 'bg-orange-50 text-orange-600',
    link: 'text-orange-700 hover:text-orange-800',
  },
  sky: {
    gradient: 'from-[#101827] via-[#163047] to-[#12445b]',
    pill: 'border-sky-300/25 bg-sky-400/15 text-sky-100',
    icon: 'bg-sky-400/20 text-sky-200',
    button: 'bg-sky-600 hover:bg-sky-700 focus-visible:ring-sky-400',
    task: 'bg-sky-50 text-sky-700',
    link: 'text-sky-700 hover:text-sky-800',
  },
  emerald: {
    gradient: 'from-[#101827] via-[#15302f] to-[#154b3b]',
    pill: 'border-emerald-300/25 bg-emerald-400/15 text-emerald-100',
    icon: 'bg-emerald-400/20 text-emerald-200',
    button: 'bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-400',
    task: 'bg-emerald-50 text-emerald-700',
    link: 'text-emerald-700 hover:text-emerald-800',
  },
};

export default function AgentWorkspaceDashboard({ access, config }: Props) {
  const [operationsVisible, setOperationsVisible] = useState(true);
  const theme = THEMES[config.accent];
  const Icon = config.icon;

  // Le layout parent contrôle déjà le rôle ; ce second contrôle évite toute
  // réutilisation accidentelle du mauvais dashboard.
  if (access.role !== config.role) {
    return <Navigate to="/agent" replace />;
  }
  if (!Array.isArray(access.gare_ids) || access.gare_ids.length === 0) {
    return (
      <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
        Aucune gare autorisée. Contactez votre chef de gare.
      </div>
    );
  }

  const today = new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'full',
    timeZone: 'Africa/Abidjan',
  }).format(new Date());

  return (
    <div className="space-y-6 pb-8">
      <section className={`relative isolate overflow-hidden rounded-[28px] bg-gradient-to-br ${theme.gradient} p-6 text-white shadow-xl shadow-slate-900/10 sm:p-9`}>
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full border border-white/10 bg-white/5 blur-2xl" />
        <div aria-hidden className="pointer-events-none absolute bottom-0 right-0 h-40 w-60 bg-gradient-to-t from-white/5 to-transparent" />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-2xl">
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider ${theme.pill}`}>
              <BadgeCheck size={14} aria-hidden /> {config.eyebrow}
            </span>
            <h2 className="mt-5 text-2xl font-black tracking-tight sm:text-4xl">{config.title}</h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-white/75 sm:text-base">
              {config.description}
            </p>
            <p className="mt-4 text-sm text-white/65">
              Bonjour, <span className="font-bold text-white">{access.display_name || 'Agent de gare'}</span>
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to={config.operationsPath}
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white shadow-sm transition-transform motion-safe:hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${theme.button}`}
              >
                Ouvrir mes opérations <ArrowRight size={17} aria-hidden />
              </Link>
              <Link
                to="/agent/rapports"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <ClipboardList size={17} aria-hidden /> Mes rapports
              </Link>
            </div>
          </div>
          <span className={`grid h-20 w-20 shrink-0 place-items-center rounded-3xl ${theme.icon}`} aria-hidden>
            <Icon size={38} strokeWidth={1.6} />
          </span>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            <MapPin size={16} aria-hidden /> Périmètre autorisé
          </div>
          <p className="mt-3 text-2xl font-black text-slate-900 tabular-nums">{access.gare_ids.length}</p>
          <p className="mt-1 text-xs text-slate-500">Gare{access.gare_ids.length > 1 ? 's' : ''} affectée{access.gare_ids.length > 1 ? 's' : ''} à votre compte</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            <ShieldCheck size={16} aria-hidden /> Autorisation métier
          </div>
          <p className="mt-3 text-lg font-black text-slate-900">{config.eyebrow}</p>
          <p className="mt-1 text-xs text-slate-500">Droits vérifiés par le backend pour chaque opération</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Journée de travail</p>
          <p className="mt-3 text-lg font-black capitalize text-slate-900">{today}</p>
          <p className="mt-1 text-xs text-slate-500">Heure de référence : Abidjan (GMT)</p>
        </div>
      </div>

      <section aria-labelledby="missions-agent">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-widest text-orange-600">Votre espace de travail</p>
            <h3 id="missions-agent" className="mt-1 text-xl font-black text-slate-900">Mes missions prioritaires</h3>
          </div>
          <span className="text-xs text-slate-500">Accès aux modules autorisés uniquement</span>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {config.tasks.map((task) => {
            const TaskIcon = task.icon;
            return (
              <Link
                key={`${task.to}-${task.title}`}
                to={task.to}
                className="group flex min-h-48 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 motion-safe:hover:-translate-y-1 hover:border-orange-200 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
              >
                <span className={`grid h-11 w-11 place-items-center rounded-xl ${theme.task}`}>
                  <TaskIcon size={21} aria-hidden />
                </span>
                <h4 className="mt-4 font-black text-slate-900">{task.title}</h4>
                <p className="mt-2 flex-1 text-sm leading-6 text-slate-500">{task.description}</p>
                <span className={`mt-4 inline-flex items-center gap-1.5 text-sm font-bold ${theme.link}`}>
                  {task.cta} <ArrowRight size={16} aria-hidden className="transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="etapes-agent">
          <h3 id="etapes-agent" className="text-lg font-black text-slate-900">Parcours de traitement</h3>
          <p className="mt-1 text-xs text-slate-500">Rappel des contrôles à effectuer, sans simuler leur validation.</p>
          <ol className="mt-5 space-y-4">
            {config.steps.map((step, index) => (
              <li key={step.title} className="flex items-start gap-3">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-extrabold ${theme.task}`}>{index + 1}</span>
                <div>
                  <p className="text-sm font-bold text-slate-900">{step.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <aside className="rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6" aria-label="Règles de contrôle">
          <div className="flex items-center gap-2 text-amber-800">
            <ShieldCheck size={20} aria-hidden />
            <h3 className="font-black">Contrôle et traçabilité</h3>
          </div>
          <p className="mt-4 text-sm leading-7 text-amber-950/80">{config.warning}</p>
          <p className="mt-4 text-xs leading-6 text-amber-900/70">
            Les chiffres financiers, les départs réels et les scans ne sont pas inventés ici. Le module ci-dessous utilise les API de votre projet et affiche leurs états réels.
          </p>
        </aside>
      </div>

      <section id="operations-agent" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="operations-agent-title">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5 sm:p-6">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-widest text-orange-600">Module connecté</p>
            <h3 id="operations-agent-title" className="mt-1 text-lg font-black text-slate-900">{config.operationTitle}</h3>
            <p className="mt-1 text-sm text-slate-500">{config.operationDescription}</p>
          </div>
          <button
            type="button"
            aria-expanded={operationsVisible}
            aria-controls="operations-agent-body"
            onClick={() => setOperationsVisible((previous) => !previous)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
          >
            {operationsVisible ? 'Masquer les opérations' : 'Afficher les opérations'}
            <ChevronDown size={18} aria-hidden className={`transition-transform ${operationsVisible ? 'rotate-180' : ''}`} />
          </button>
        </div>
        <div id="operations-agent-body" hidden={!operationsVisible}>
          {operationsVisible && (
            <div className="p-4 sm:p-6">
              <AgentOperationsPage mode={config.operationMode} />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
