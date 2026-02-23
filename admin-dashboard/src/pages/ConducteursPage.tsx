import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function ConducteursPage() {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingConducteur, setEditingConducteur] = useState<any>(null);
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
    password: 'password123',
    permis: 'PERMIS_A',
    numeroPermis: '',
    vehiculeType: 'TRICYCLE',
    immatriculation: '',
  });

  // Récupérer les conducteurs
  const { data: conducteurs = [], isLoading } = useQuery({
    queryKey: ['conducteurs'],
    queryFn: async () => {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(`${API_URL}/conducteurs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data.conducteurs || [];
    },
  });

  // Mutation pour ajouter un conducteur
  const addConducteurMutation = useMutation({
    mutationFn: async (data: any) => {
      const token = localStorage.getItem('accessToken');
      // Créer l'utilisateur
      const userResponse = await axios.post(
        `${API_URL}/auth/register`,
        {
          nom: data.nom,
          prenom: data.prenom,
          email: data.email,
          telephone: data.telephone,
          password: data.password,
          role: 'CONDUCTEUR',
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Créer le profil conducteur
      await axios.post(
        `${API_URL}/conducteurs`,
        {
          userId: userResponse.data.user.id,
          permis: data.permis,
          numeroPermis: data.numeroPermis,
          vehiculeType: data.vehiculeType,
          immatriculation: data.immatriculation,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      return userResponse.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conducteurs'] });
      setShowAddForm(false);
      setFormData({
        nom: '',
        prenom: '',
        email: '',
        telephone: '',
        password: 'password123',
        permis: 'PERMIS_A',
        numeroPermis: '',
        vehiculeType: 'TRICYCLE',
        immatriculation: '',
      });
      alert('Conducteur ajouté avec succès !');
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Erreur lors de l\'ajout');
    },
  });

  // Mutation pour modifier un conducteur
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const token = localStorage.getItem('accessToken');
      await axios.patch(
        `${API_URL}/conducteurs/${data.id}`,
        {
          permis: data.permis,
          numeroPermis: data.numeroPermis,
          vehiculeType: data.vehiculeType,
          immatriculation: data.immatriculation,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conducteurs'] });
      setEditingConducteur(null);
      setShowAddForm(false);
      alert('Conducteur modifié avec succès !');
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Erreur lors de la modification');
    },
  });

  // Mutation pour supprimer un conducteur
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = localStorage.getItem('accessToken');
      await axios.delete(`${API_URL}/conducteurs/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conducteurs'] });
      alert('Conducteur supprimé avec succès !');
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Erreur lors de la suppression');
    },
  });

  const handleEdit = (conducteur: any) => {
    setEditingConducteur(conducteur);
    setFormData({
      nom: conducteur.user.nom,
      prenom: conducteur.user.prenom,
      email: conducteur.user.email,
      telephone: conducteur.user.telephone,
      password: 'password123',
      permis: conducteur.permis,
      numeroPermis: conducteur.numeroPermis,
      vehiculeType: conducteur.vehiculeType,
      immatriculation: conducteur.immatriculation,
    });
    setShowAddForm(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce conducteur ?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingConducteur) {
      updateMutation.mutate({
        id: editingConducteur.id,
        ...formData,
      });
    } else {
      addConducteurMutation.mutate(formData);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Chargement...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Gestion des conducteurs</h1>
        <button
          onClick={() => {
            setShowAddForm(!showAddForm);
            setEditingConducteur(null);
            setFormData({
              nom: '',
              prenom: '',
              email: '',
              telephone: '',
              password: 'password123',
              permis: 'PERMIS_A',
              numeroPermis: '',
              vehiculeType: 'TRICYCLE',
              immatriculation: '',
            });
          }}
          className="bg-primary text-white px-4 py-2 rounded hover:bg-opacity-90"
        >
          {showAddForm ? 'Annuler' : '+ Ajouter un conducteur'}
        </button>
      </div>

      {/* Formulaire d'ajout */}
      {showAddForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">
            {editingConducteur ? 'Modifier le conducteur' : 'Nouveau conducteur'}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nom</label>
              <input
                type="text"
                value={formData.nom}
                onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                className="w-full border rounded px-3 py-2"
                required
                disabled={!!editingConducteur}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Prénom</label>
              <input
                type="text"
                value={formData.prenom}
                onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                className="w-full border rounded px-3 py-2"
                required
                disabled={!!editingConducteur}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full border rounded px-3 py-2"
                required
                disabled={!!editingConducteur}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Téléphone</label>
              <input
                type="tel"
                value={formData.telephone}
                onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                className="w-full border rounded px-3 py-2"
                placeholder="+225..."
                required
                disabled={!!editingConducteur}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Type de permis</label>
              <select
                value={formData.permis}
                onChange={(e) => setFormData({ ...formData, permis: e.target.value })}
                className="w-full border rounded px-3 py-2"
              >
                <option value="PERMIS_A">Permis A</option>
                <option value="PERMIS_B">Permis B</option>
                <option value="PERMIS_C">Permis C</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Numéro de permis</label>
              <input
                type="text"
                value={formData.numeroPermis}
                onChange={(e) => setFormData({ ...formData, numeroPermis: e.target.value })}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Type de véhicule</label>
              <select
                value={formData.vehiculeType}
                onChange={(e) => setFormData({ ...formData, vehiculeType: e.target.value })}
                className="w-full border rounded px-3 py-2"
              >
                <option value="TRICYCLE">Tricycle</option>
                <option value="MOTO">Moto</option>
                <option value="VOITURE">Voiture</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Immatriculation</label>
              <input
                type="text"
                value={formData.immatriculation}
                onChange={(e) => setFormData({ ...formData, immatriculation: e.target.value })}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>
            <div className="col-span-2">
              <button
                type="submit"
                disabled={addConducteurMutation.isPending || updateMutation.isPending}
                className="bg-primary text-white px-6 py-2 rounded hover:bg-opacity-90 disabled:opacity-50"
              >
                {addConducteurMutation.isPending || updateMutation.isPending
                  ? 'En cours...'
                  : editingConducteur
                  ? 'Modifier'
                  : 'Ajouter'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Liste des conducteurs */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Conducteur</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Véhicule</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Permis</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Note</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Courses</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {conducteurs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                  Aucun conducteur trouvé
                </td>
              </tr>
            ) : (
              conducteurs.map((conducteur: any) => (
                <tr key={conducteur.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="font-medium">{conducteur.user.prenom} {conducteur.user.nom}</div>
                      <div className="text-sm text-gray-500">{conducteur.user.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {conducteur.user.telephone}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="font-medium">{conducteur.vehiculeType}</div>
                      <div className="text-sm text-gray-500">{conducteur.immatriculation}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="font-medium">{conducteur.permis}</div>
                      <div className="text-sm text-gray-500">{conducteur.numeroPermis}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded ${
                      conducteur.statut === 'DISPONIBLE' ? 'bg-green-100 text-green-800' :
                      conducteur.statut === 'EN_COURSE' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {conducteur.statut}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    ⭐ {conducteur.note || 0}/5
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {conducteur.nombreCourses || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleEdit(conducteur)}
                      className="text-blue-500 hover:underline mr-3"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => handleDelete(conducteur.id)}
                      className="text-red-500 hover:underline"
                      disabled={deleteMutation.isPending}
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
