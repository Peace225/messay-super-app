import React, { useState, useEffect, useMemo } from 'react';
import {
  UserPlus, Search, Edit2, Trash2, Shield,
  UserCheck, UserX, Key, Smartphone, Activity,
  Zap, CheckCircle
} from 'lucide-react';
import { io } from 'socket.io-client';

const socket = io('http://127.0.0.1:5000');

export const ChauffeursModule: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [vehicule, setVehicule] = useState('');
  const [generatedId, setGeneratedId] = useState('');

  const [chauffeurs, setChauffeurs] = useState([
    { id: '1', identifiant: 'CHAUFF-01', nom: 'Moussa Koné', telephone: '+2250700000001', status: 'ACTIF', vehicule: 'Tricycle - 4521 AB', revenue: '45,000 F' },
    { id: '2', identifiant: 'CHAUFF-02', nom: 'Jean Yao', telephone: '+2250700000002', status: 'EN_COURS', vehicule: 'Tricycle - 8854 EF', revenue: '32,000 F' },
    { id: '3', identifiant: 'CHAUFF-03', nom: 'Ibrahim Traoré', telephone: '+2250700000003', status: 'INACTIF', vehicule: 'Camion - 1247 GH', revenue: '0 F' },
  ]);

  const openInscriptionModal = () => {
    const newId = `CHAUFF-${Math.floor(1000 + Math.random() * 9000)}`;
    setGeneratedId(newId);
    setNom('');
    setTelephone('');
    setVehicule('');
    setIsModalOpen(true);
  };

  const handleInscriptionChauffeur = () => {
    if (!nom ||!telephone ||!vehicule) return;

    const nouveauChauffeur = {
      id: Date.now().toString(),
      identifiant: generatedId,
      nom,
      telephone,
      status: 'ACTIF',
      vehicule,
      revenue: '0 F'
    };

    setChauffeurs([nouveauChauffeur,...chauffeurs]);
    setIsModalOpen(false);
  };

  const filteredChauffeurs = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return chauffeurs.filter(c =>
      c.nom.toLowerCase().includes(term) ||
      c.telephone.includes(term) ||
      c.vehicule.toLowerCase().includes(term)
    );
  }, [searchTerm, chauffeurs]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-gray-800">👨✈ Gestion des Chauffeurs</h2>
          <p className="text-sm text-gray-500">Enregistrez vos conducteurs et attribuez-leur un identifiant de connexion.</p>
        </div>
        <button
          onClick={openInscriptionModal}
          className="flex items-center space-x-2 bg-orange-600 hover:bg-orange-700 text-white px-5 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-orange-100"
        >
          <UserPlus size={18} />
          <span>Inscrire un chauffeur</span>
        </button>
      </div>

      <div className="flex bg-white p-4 rounded-2xl border border-gray-100 shadow-sm gap-4">
        <div className="flex-1 relative flex items-center">
          <Search className="absolute left-4 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Rechercher un chauffeur par nom, téléphone ou véhicule..."
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
                <th className="px-6 py-4">ID Connexion</th>
                <th className="px-6 py-4">Chauffeur</th>
                <th className="px-6 py-4">Téléphone</th>
                <th className="px-6 py-4">Véhicule assigné</th>
                <th className="px-6 py-4">Statut</th>
                <th className="px-6 py-4">Revenus générés</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filteredChauffeurs.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-mono font-bold text-orange-600">
                    <div className="flex items-center gap-1.5">
                      <Key size={14} />{c.identifiant}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-bold text-gray-700">{c.nom}</td>
                  <td className="px-6 py-4 font-mono text-gray-500">{c.telephone}</td>
                  <td className="px-6 py-4 text-gray-500">{c.vehicule}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text- font-black tracking-wider ${
                      c.status === 'ACTIF'? 'bg-green-50 text-green-700' :
                      c.status === 'EN_COURS'? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {c.status === 'ACTIF'? <UserCheck size={12} /> : <UserX size={12} />}
                      <span>{c.status}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 font-extrabold text-gray-900">{c.revenue}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button className="p-2 hover:bg-gray-100 rounded-xl text-gray-600 transition-colors">
                        <Edit2 size={16} />
                      </button>
                      <button className="p-2 hover:bg-red-50 rounded-xl text-red-600 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl space-y-5 animate-in fade-in">
            <div>
              <h3 className="text-xl font-black text-gray-800">Nouvelle Inscription</h3>
              <p className="text-xs text-gray-500 mt-0.5">Cet identifiant permettra au chauffeur de se connecter.</p>
            </div>

            <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text- font-black text-orange-600 uppercase tracking-wider">Identifiant généré (ID)</p>
                <p className="text-2xl font-black font-mono text-orange-800 tracking-wide mt-0.5">{generatedId}</p>
              </div>
              <div className="p-3 bg-orange-600/10 rounded-xl text-orange-600">
                <Key size={24} />
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Nom et Prénoms</label>
                <input
                  type="text"
                  placeholder="Ex: Moussa Koné"
                  className="w-full p-3 mt-1 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-500"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Numéro de téléphone</label>
                <input
                  type="tel"
                  placeholder="+225 07 00 00 00 00"
                  className="w-full p-3 mt-1 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-500"
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Véhicule assigné (Plaque)</label>
                <input
                  type="text"
                  placeholder="Ex: Tricycle - 4521 AB"
                  className="w-full p-3 mt-1 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-500"
                  value={vehicule}
                  onChange={(e) => setVehicule(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition-all">
                Annuler
              </button>
              <button
                onClick={handleInscriptionChauffeur}
                className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-orange-100"
              >
                Enregistrer le Chauffeur
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const UtilisateursModule: React.FC = () => {
  const [activeClients, setActiveClients] = useState<any[]>([]);

  const staffUsers = [
    { id: '2', nom: 'Sylla Daouda', email: 'daouda@messay.ci', role: 'SUPER_ADMIN', mobileActivity: 'Consultation Dashboard', sessionStatus: 'Actif' },
    { id: '3', nom: 'Kevin Gael', email: 'kevin@messay.ci', role: 'ADMIN', mobileActivity: 'Administration Infrastructure', sessionStatus: 'Actif' },
  ];

  useEffect(() => {
    socket.on('connect', () => {
      socket.emit('join-admin-panel');
    });

    socket.on('client-app-state', (data: any) => {
      setActiveClients(prev => {
        const exist = prev.findIndex(c => c.userId === data.userId);
        if (exist >= 0) {
          const update = [...prev];
          update[exist] = data;
          return update;
        }
        return [data,...prev];
      });
    });

    return () => {
      socket.off('client-app-state');
    };
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-black text-gray-800">👥 Suivi Utilisateurs & Clients Mobile</h2>
        <p className="text-sm text-gray-500">Supervisez l'ensemble des clients connectés sur l'application et leurs mouvements en temps réel.</p>
      </div>

      <div className="space-y-4">
        <h3 className="text-base font-bold text-gray-700 flex items-center gap-2">
          <Smartphone size={18} className="text-orange-600"/> Sessions Actives Clients (Application Mobile)
        </h3>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-xs font-black text-gray-400 uppercase tracking-wider">
                  <th className="px-6 py-4">Client / Passager</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Mouvements & Activité récente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {activeClients.length === 0? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-gray-400">
                      <Activity className="animate-pulse mx-auto mb-2 opacity-60" size={32} />
                      <p className="font-medium text-xs">En attente de connexion de clients sur l'App Mobile...</p>
                    </td>
                  </tr>
                ) : (
                  activeClients.map((client, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-700">{client.nom || 'Client Anonyme'}</div>
                        <div className="text- text-gray-400 font-mono">ID: {client.userId}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text- font-black tracking-wider bg-emerald-50 text-emerald-700">
                          <CheckCircle size={12} /> <span>CONNECTÉ</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 flex items-center space-x-2">
                        <Zap size={14} className="text-orange-500 animate-pulse" />
                        <span className="text-xs font-medium italic">{client.action || 'Navigation sur l\'accueil...'}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t border-gray-100">
        <h3 className="text-base font-bold text-gray-700 flex items-center gap-2">
          <Shield size={18} className="text-blue-600"/> Utilisateurs Back-Office (Console Admin)
        </h3>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-xs font-black text-gray-400 uppercase tracking-wider">
                  <th className="px-6 py-4">Staff</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Rôle</th>
                  <th className="px-6 py-4">Session Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {staffUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-700">{u.nom}</td>
                    <td className="px-6 py-4 text-gray-500 font-mono">{u.email}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text- font-black tracking-wider bg-blue-50 text-blue-700">
                        <Shield size={12} /><span>{u.role}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text- font-black tracking-wider bg-green-50 text-green-700">
                        <UserCheck size={12} /> <span>{u.sessionStatus}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};