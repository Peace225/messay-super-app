developper plus le module logistique on doit voir toutes les tricycle disponible et en mouvement, voit les tickets de bus vendus pour chaque compagnie(les détails: le nom de passager, l'heure, la date etc... 2 module resource on doit voir toutes les utilisateurs connecter sur l'apps ses mouvements, et etre capable de s'inscrire un chauffeurs de lui donner un ID pour ce connecter 3 Module finance on doit voir les finances de l'apps et voir toutes les rapports technique, finance, administrative : import React, { useEffect, useState, useMemo, useRef } from 'react';

import { io, Socket } from 'socket.io-client';

import {

  UserPlus, Search, Edit2, Trash2, Shield,

  UserCheck, UserX, Wallet, TrendingUp, TrendingDown,

  Download, PlusCircle

} from 'lucide-react';



// --- CONFIG ---

const SOCKET_URL = 'http://127.0.0.1:5000';



// --- TYPES ---

type Position = { courseId: string; lat: number; lng: number; timestamp?: number };

type Chauffeur = { id: string; nom: string; telephone: string; status: 'ACTIF' | 'EN_COURS' | 'INACTIF'; vehicule: string; revenue: string };

type AppUser = { id: string; nom: string; email: string; role: 'USER' | 'ADMIN' | 'SUPER_ADMIN'; date: string };

type Transaction = { id: string; motif: string; montant: number; date: string; type: 'ENTRÉE' | 'SORTIE' };



// ==========================================

// 1. MODULES LOGISTIQUE

// ==========================================



export const TricyclesModule: React.FC = () => {

  const [positions, setPositions] = useState<Position[]>([]);

  const [isConnected, setIsConnected] = useState(false);

  const socketRef = useRef<Socket | null>(null);



  useEffect(() => {

    const socket = io(SOCKET_URL, { transports: ['websocket'], reconnection: true });

    socketRef.current = socket;



    const onConnect = () => { setIsConnected(true); socket.emit('join-admin-panel'); };

    const onDisconnect = () => setIsConnected(false);

    const onPosition = (data: Position) => setPositions(prev => [data, ...prev].slice(0, 20));



    socket.on('connect', onConnect);

    socket.on('disconnect', onDisconnect);

    socket.on('position-updated', onPosition);



    return () => {

      socket.off('connect', onConnect);

      socket.off('disconnect', onDisconnect);

      socket.off('position-updated', onPosition);

      socket.disconnect();

    };

  }, []);



  return (

    <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100 h-full">

      <div className="flex justify-between items-center mb-6">

        <h2 className="text-xl font-bold text-gray-800">📍 Suivi des Tricycles</h2>

        <div className={`flex items-center space-x-2 text-xs font-bold px-3 py-1 rounded-full ${isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>

          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>

          <span>{isConnected ? 'EN LIGNE' : 'HORS LIGNE'}</span>

        </div>

      </div>



      <div className="space-y-3 overflow-y-auto max-h-[400px] pr-2">

        {positions.length > 0 ? positions.map((pos, idx) => (

          <div key={`${pos.courseId}-${pos.timestamp ?? idx}`} className="p-4 bg-gray-50 rounded-xl border border-gray-200 hover:border-orange-300 transition-all">

            <div className="flex justify-between text-sm">

              <span className="font-bold text-orange-600">Course: #{pos.courseId?.slice(-6)}</span>

              <span className="text-gray-400">{pos.timestamp ? new Date(pos.timestamp).toLocaleTimeString('fr-FR') : new Date().toLocaleTimeString('fr-FR')}</span>

            </div>

            <div className="mt-2 text-gray-700 font-mono text-xs">

              Lat: {pos.lat?.toFixed(6)} | Lng: {pos.lng?.toFixed(6)}

            </div>

          </div>

        )) : (

          <div className="text-center py-12 text-gray-400">

            <p>En attente de données GPS...</p>

            <p className="text-xs mt-2 italic">Assurez-vous que l'application mobile envoie les positions.</p>

          </div>

        )}

      </div>

    </div>

  );

};



export const BusTicketsModule: React.FC = () => (

  <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100">

    <h2 className="text-xl font-bold mb-4 text-gray-800">🚌 Tickets de Bus</h2>

    <div className="space-y-4">

      <div className="p-4 bg-blue-50 rounded-xl">

        <p className="text-blue-800 text-sm font-medium">Tickets vendus aujourd'hui</p>

        <p className="text-3xl font-black text-blue-900">1,248</p>

      </div>

    </div>

  </div>

);



// ==========================================

// 2. MODULES RESSOURCES HUMAINES

// ==========================================



export const ChauffeursModule: React.FC = () => {

  const [searchTerm, setSearchTerm] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);



  const chauffeurs: Chauffeur[] = [

    { id: '1', nom: 'Moussa Koné', telephone: '+2250700000001', status: 'ACTIF', vehicule: 'Tricycle - 4521 AB', revenue: '45,000 F' },

    { id: '2', nom: 'Jean Yao', telephone: '+2250700000002', status: 'EN_COURS', vehicule: 'Tricycle - 8854 EF', revenue: '32,000 F' },

    { id: '3', nom: 'Ibrahim Traoré', telephone: '+2250700000003', status: 'INACTIF', vehicule: 'Camion - 1247 GH', revenue: '0 F' },

  ];



  const filtered = useMemo(() => {

    const term = searchTerm.toLowerCase();

    return chauffeurs.filter(c =>

      c.nom.toLowerCase().includes(term) ||

      c.telephone.includes(term) ||

      c.vehicule.toLowerCase().includes(term)

    );

  }, [searchTerm]);



  return (

    <div className="space-y-6">

      <div className="flex justify-between items-center">

        <div>

          <h2 className="text-2xl font-black text-gray-800">👨‍✈️ Gestion des Chauffeurs</h2>

          <p className="text-sm text-gray-500">Administration des profils et suivi d'activité de la flotte.</p>

        </div>

        <button

          onClick={() => setIsModalOpen(true)}

          className="flex items-center space-x-2 bg-orange-600 hover:bg-orange-700 text-white px-5 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-orange-100"

        >

          <UserPlus size={18} />

          <span>Ajouter un chauffeur</span>

        </button>

      </div>



      <div className="flex bg-white p-4 rounded-2xl border border-gray-100 shadow-sm gap-4">

        <div className="flex-1 relative flex items-center">

          <Search className="absolute left-4 text-gray-400" size={18} />

          <input

            type="text"

            placeholder="Rechercher un chauffeur par nom ou véhicule..."

            className="w-full pl-12 pr-4 py-3 bg-gray-50 rounded-xl text-sm border-0 focus:ring-2 focus:ring-orange-500 outline-none"

            value={searchTerm}

            onChange={(e) => setSearchTerm(e.target.value)}

          />

        </div>

      </div>



      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        <div className="overflow-x-auto">

          <table className="w-full text-left border-collapse">

            <thead>

              <tr className="bg-gray-50 text-xs font-black text-gray-400 uppercase tracking-wider">

                <th className="px-6 py-4">Chauffeur</th>

                <th className="px-6 py-4">Téléphone</th>

                <th className="px-6 py-4">Véhicule assigné</th>

                <th className="px-6 py-4">Statut</th>

                <th className="px-6 py-4">Revenus générés</th>

                <th className="px-6 py-4 text-right">Actions</th>

              </tr>

            </thead>

            <tbody className="divide-y divide-gray-100 text-sm">

              {filtered.map((c) => (

                <tr key={c.id} className="hover:bg-gray-50 transition-colors">

                  <td className="px-6 py-4 font-bold text-gray-700">{c.nom}</td>

                  <td className="px-6 py-4 font-mono text-gray-500">{c.telephone}</td>

                  <td className="px-6 py-4 text-gray-500">{c.vehicule}</td>

                  <td className="px-6 py-4">

                    <span className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-[10px] font-black tracking-wider ${

                      c.status === 'ACTIF' ? 'bg-green-50 text-green-700' :

                      c.status === 'EN_COURS' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'

                    }`}>

                      {c.status === 'ACTIF' ? <UserCheck size={12} /> : <UserX size={12} />}

                      <span>{c.status}</span>

                    </span>

                  </td>

                  <td className="px-6 py-4 font-extrabold text-gray-900">{c.revenue}</td>

                  <td className="px-6 py-4 text-right">

                    <div className="flex items-center justify-end space-x-2">

                      <button className="p-2 hover:bg-gray-100 rounded-xl text-gray-600 transition-colors"><Edit2 size={16} /></button>

                      <button className="p-2 hover:bg-red-50 rounded-xl text-red-600 transition-colors"><Trash2 size={16} /></button>

                    </div>

                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      </div>



      {/* MODAL FONCTIONNEL */}

      {isModalOpen && (

        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">

          <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl">

            <h3 className="text-xl font-bold mb-4">Nouveau Chauffeur</h3>

            <div className="space-y-4">

              <div>

                <label className="text-xs font-bold text-gray-500 uppercase">Nom complet</label>

                <input type="text" placeholder="Ex: Moussa Koné" className="w-full p-3 mt-1 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none" />

              </div>

              <div>

                <label className="text-xs font-bold text-gray-500 uppercase">Téléphone</label>

                <input type="tel" placeholder="+225 07 00 00 00 00" className="w-full p-3 mt-1 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none" />

              </div>

              <div>

                <label className="text-xs font-bold text-gray-500 uppercase">Véhicule assigné</label>

                <input type="text" placeholder="Ex: Tricycle - 1234 AB" className="w-full p-3 mt-1 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none" />

              </div>

            </div>

            <div className="flex justify-end space-x-3 mt-8">

              <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-all">

                Annuler

              </button>

              <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 transition-all shadow-lg shadow-orange-200">

                Enregistrer

              </button>

            </div>

          </div>

        </div>

      )}

    </div>

  );

};



export const UtilisateursModule: React.FC = () => {

  const users: AppUser[] = [

    { id: '1', nom: 'Kouassi Amen', email: 'amen@example.com', role: 'USER', date: '2026-05-12' },

    { id: '2', nom: 'Sylla Daouda', email: 'daouda@messay.ci', role: 'SUPER_ADMIN', date: '2026-02-01' },

    { id: '3', nom: 'Kevin Gael', email: 'kevin@messay.ci', role: 'ADMIN', date: '2026-02-01' },

  ];



  return (

    <div className="space-y-6">

      <div>

        <h2 className="text-2xl font-black text-gray-800">👥 Gestion des Utilisateurs</h2>

        <p className="text-sm text-gray-500">Administration des comptes, rôles et attributions des droits.</p>

      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        <div className="overflow-x-auto">

          <table className="w-full text-left border-collapse">

            <thead>

              <tr className="bg-gray-50 text-xs font-black text-gray-400 uppercase tracking-wider">

                <th className="px-6 py-4">Nom</th>

                <th className="px-6 py-4">Email</th>

                <th className="px-6 py-4">Rôle</th>

                <th className="px-6 py-4">Date de création</th>

              </tr>

            </thead>

            <tbody className="divide-y divide-gray-100 text-sm">

              {users.map((u) => (

                <tr key={u.id} className="hover:bg-gray-50 transition-colors">

                  <td className="px-6 py-4 font-bold text-gray-700">{u.nom}</td>

                  <td className="px-6 py-4 text-gray-500">{u.email}</td>

                  <td className="px-6 py-4">

                    <span className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-[10px] font-black tracking-wider ${

                      u.role === 'SUPER_ADMIN' ? 'bg-purple-50 text-purple-700' :

                      u.role === 'ADMIN' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'

                    }`}>

                      <Shield size={12} /><span>{u.role}</span>

                    </span>

                  </td>

                  <td className="px-6 py-4 text-gray-400">{u.date}</td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      </div>

    </div>

  );

};



// ==========================================

// 3. MODULE FINANCE

// ==========================================



export const FinanceModule: React.FC = () => {

  const [filter, setFilter] = useState<'Tout' | 'Entrées' | 'Sorties'>('Tout');

  

  const transactions: Transaction[] = [

    { id: 'TXN-001', motif: 'Commission Trajet Tricycle', montant: 4500, date: '2026-06-29', type: 'ENTRÉE' },

    { id: 'TXN-002', motif: 'Achat Ticket Bus', montant: 1200, date: '2026-06-28', type: 'ENTRÉE' },

    { id: 'TXN-003', motif: 'Maintenance Flotte', montant: 25000, date: '2026-06-28', type: 'SORTIE' },

    { id: 'TXN-004', motif: 'Commission Partenaire BTP', montant: 85000, date: '2026-06-27', type: 'ENTRÉE' },

  ];



  const filteredTransactions = useMemo(() => {

    if (filter === 'Entrées') return transactions.filter(t => t.type === 'ENTRÉE');

    if (filter === 'Sorties') return transactions.filter(t => t.type === 'SORTIE');

    return transactions;

  }, [filter]);



  const totalRevenu = useMemo(() => transactions.filter(t => t.type === 'ENTRÉE').reduce((acc, curr) => acc + curr.montant, 0), []);



  const stats = [

    { label: 'Revenu Total', value: `${totalRevenu.toLocaleString('fr-FR')} F`, icon: <Wallet size={20} />, trend: '+12.5%' },

    { label: 'Courses Validées', value: '8,240', icon: <TrendingUp size={20} />, trend: '+5.2%' },

    { label: 'Dépenses Flotte', value: '3,120,000 F', icon: <TrendingDown size={20} />, trend: '-2.1%' },

  ];



  return (

    <div className="space-y-6">

      <div className="flex justify-between items-end">

        <div>

          <h2 className="text-2xl font-black text-gray-800">💰 Finance & Rapports</h2>

          <p className="text-sm text-gray-500">Tableau de bord financier de MESSAY.</p>

        </div>

        <div className="flex gap-2">

          <button className="flex items-center space-x-2 bg-orange-600 text-white px-5 py-3 rounded-2xl font-bold hover:bg-orange-700 shadow-lg">

            <PlusCircle size={18} /><span>Nouvelle Transaction</span>

          </button>

          <button className="flex items-center space-x-2 bg-white border border-gray-200 px-5 py-3 rounded-2xl font-bold text-gray-700 hover:bg-gray-50">

            <Download size={18} />

          </button>

        </div>

      </div>



      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {stats.map((stat, idx) => (

          <div key={idx} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">

            <div className="flex justify-between items-start">

              <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">{stat.icon}</div>

              <span className="text-xs font-black text-green-600 bg-green-50 px-2 py-1 rounded-full">{stat.trend}</span>

            </div>

            <p className="text-gray-400 text-sm mt-4 font-medium">{stat.label}</p>

            <p className="text-2xl font-black text-gray-900 mt-1">{stat.value}</p>

          </div>

        ))}

      </div>



      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        <div className="px-6 py-5 border-b border-gray-50 flex justify-between items-center">

          <h3 className="font-bold text-gray-800">Historique des flux</h3>

          <div className="flex space-x-2 bg-gray-50 p-1 rounded-full">

            {(['Tout', 'Entrées', 'Sorties'] as const).map((f) => (

              <button key={f} onClick={() => setFilter(f)} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{f}</button>

            ))}

          </div>

        </div> {/* <--- C'EST CETTE BALISE QUI MANQUAIT ! */}

        

        <table className="w-full text-left border-collapse">

          <thead>

            <tr className="bg-gray-50 text-xs font-black text-gray-400 uppercase">

              <th className="px-6 py-4">ID Transaction</th>

              <th className="px-6 py-4">Motif</th>

              <th className="px-6 py-4">Date</th>

              <th className="px-6 py-4 text-right">Montant</th>

            </tr>

          </thead>

          <tbody className="divide-y divide-gray-100 text-sm">

            {filteredTransactions.map((t) => (

              <tr key={t.id} className="hover:bg-gray-50 transition-colors">

                <td className="px-6 py-4 font-mono text-gray-500">{t.id}</td>

                <td className="px-6 py-4 font-medium text-gray-700">{t.motif}</td>

                <td className="px-6 py-4 text-gray-500">{t.date}</td>

                <td className={`px-6 py-4 text-right font-black ${t.type === 'ENTRÉE' ? 'text-green-600' : 'text-red-600'}`}>

                  {t.type === 'ENTRÉE' ? '+' : '-'} {t.montant.toLocaleString('fr-FR')} F

                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

    </div>

  );

};