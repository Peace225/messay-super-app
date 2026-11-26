import { NavLink } from 'react-router-dom';
import { ArrowLeft, CircleAlert, type LucideIcon,
  BarChart3, Bell, BusFront, CalendarClock, CircleHelp,
  FileCheck2, Route, Settings2, TicketCheck, Wallet, Building2 } from 'lucide-react';

type ModuleDescription = { title: string; description: string; icon: LucideIcon; requirements: string[] };

/** Les routes sont utilisables, mais ces fonctions nécessitent l'API MESSAY. */
export const MODULES_A_CONNECTER = {
  '/validation': {title:'Validation de ma compagnie',description:'Suivi du dossier transmis au Super Admin.',icon:FileCheck2,requirements:['État du dossier et pièces obligatoires','Historique des demandes de correction','Approbation effectuée côté Super Admin uniquement']},
  '/lignes': {title:'Lignes de transport',description:'Définir des trajets entre deux gares réellement enregistrées.',icon:Route,requirements:['Gare de départ et gare d’arrivée de la compagnie','Prix, durée et disponibilité de la ligne','Correction des itinéraires historiques incomplets']},
  '/horaires': {title:'Horaires et départs',description:'Programmer les voyages disponibles à la réservation.',icon:CalendarClock,requirements:['Date ou jours de circulation','Affectation d’un bus et d’un chauffeur','Heure réelle et état du départ']},
  '/vehicules': {title:'Bus et capacités',description:'Inventaire des véhicules de transport interurbain.',icon:BusFront,requirements:['Immatriculation et capacité par bus','Plans de sièges et maintenance','Affectation des véhicules aux départs']},
  '/embarquement': {title:'Contrôle embarquement',description:'Vérifier les billets payés pour un départ précis.',icon:TicketCheck,requirements:['Recherche par billet ou QR code','Validation serveur anti-double usage','Journal d’embarquement par chauffeur et gare']},
  '/portefeuille': {title:'Portefeuille compagnie',description:'Suivi comptable des recettes nettes.',icon:Wallet,requirements:['Recettes confirmées par paiement serveur','Commission plateforme et part compagnie','Soldes disponible, bloqué et retiré']},
  '/transactions': {title:'Paiements et commissions',description:'Rapprochement des billets payés et des versements.',icon:Building2,requirements:['Événements de paiement vérifiés','Historique des mouvements financiers','Remboursements et reversions']},
  '/rapports': {title:'Rapports des ventes',description:'Indicateurs par gare, trajet, départ et période.',icon:BarChart3,requirements:['Billets réellement payés','Taux d’occupation par départ','Exports comptables autorisés']},
  '/notifications': {title:'Notifications',description:'Alertes et événements importants.',icon:Bell,requirements:['Réservations et annulations','Messages du Super Admin','État des versements']},
  '/parametres': {title:'Paramètres et accès',description:'Administrer les accès autorisés de la compagnie.',icon:Settings2,requirements:['Responsables et agents de gare','Sécurisation de la session','Coordonnées de versement validées']},
  '/assistance': {title:'Aide et assistance',description:'Support dédié aux compagnies.',icon:CircleHelp,requirements:['Demandes d’assistance','Suivi des incidents de réservation','Guide de configuration des trajets']},
} satisfies Record<string, ModuleDescription>;

export type MissingModulePath = keyof typeof MODULES_A_CONNECTER;

export default function ModulesAConnecter({ path }: { path: MissingModulePath }) {
  const module = MODULES_A_CONNECTER[path];
  const Icon = module.icon;
  return <div className="mx-auto max-w-4xl">
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-600"><Icon size={27}/></div>
      <div className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-orange-600"><CircleAlert size={15}/>Module à connecter</div>
      <h2 className="text-2xl font-black text-slate-900">{module.title}</h2>
      <p className="mt-2 text-sm text-slate-500">{module.description}</p>
      <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Cette route est prête. Le module métier et ses autorisations restent à connecter au backend MESSAY ; aucune action financière ou administrative fictive n'est exécutée.
      </p>
      <h3 className="mt-7 text-sm font-extrabold text-slate-800">Fonctions à développer / raccorder</h3>
      <ul className="mt-3 space-y-2">{module.requirements.map(r => <li key={r} className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">• {r}</li>)}</ul>
      <NavLink to="/" className="mt-6 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"><ArrowLeft size={17}/>Retour au tableau de bord</NavLink>
    </div>
  </div>;
}
