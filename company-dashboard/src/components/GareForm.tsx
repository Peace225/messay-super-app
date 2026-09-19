import { useState } from 'react'
import { MapPin, User, Phone, Navigation, X, Building2 } from 'lucide-react'

interface GareFormProps {
  onClose: () => void;
  onSave: (gare: any) => void;
}

export default function GareForm({ onClose, onSave }: GareFormProps) {
  const [formData, setFormData] = useState({
    nom: '',
    ville: '',
    adresse: '',
    chef_nom: '',
    chef_tel: ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      {/* Conteneur principal du modal */}
      <div className="bg-white rounded-[24px] p-6 sm:p-8 w-full max-w-lg shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* En-tête du modal */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center shadow-inner">
              <Building2 size={24} />
            </div>
            <div>
              <h3 className="font-black text-xl text-gray-900">Ajouter une gare</h3>
              <p className="text-xs text-gray-500 font-medium mt-0.5">Configurez un nouveau point de départ</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 flex items-center justify-center bg-gray-50 hover:bg-gray-200 text-gray-500 rounded-full transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Section 1: Localisation */}
          <div className="p-4 bg-gray-50/50 rounded-2xl border border-gray-100 space-y-4">
            <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <MapPin size={14} /> Localisation de la gare
            </h4>
            
            {/* Champ Nom */}
            <div>
              <label className="text-[12px] font-bold text-gray-700 mb-1.5 block">
                Nom de la gare <span className="text-orange-500">*</span>
              </label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                  required
                  placeholder="Ex: Gare de Yopougon Siporex" 
                  className="w-full h-11 pl-10 pr-4 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all placeholder:text-gray-300"
                  value={formData.nom}
                  onChange={e => setFormData({...formData, nom: e.target.value})}
                />
              </div>
            </div>

            {/* Champs Ville & Adresse */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="text-[12px] font-bold text-gray-700 mb-1.5 block">
                  Ville <span className="text-orange-500">*</span>
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input 
                    required
                    placeholder="Ex: Abidjan" 
                    className="w-full h-11 pl-10 pr-4 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all placeholder:text-gray-300"
                    value={formData.ville}
                    onChange={e => setFormData({...formData, ville: e.target.value})}
                  />
                </div>
              </div>
              <div className="flex-1">
                <label className="text-[12px] font-bold text-gray-700 mb-1.5 block">Quartier / Adresse</label>
                <div className="relative">
                  <Navigation className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input 
                    placeholder="Ex: Près de la pharmacie" 
                    className="w-full h-11 pl-10 pr-4 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all placeholder:text-gray-300"
                    value={formData.adresse}
                    onChange={e => setFormData({...formData, adresse: e.target.value})}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Responsable */}
          <div className="p-4 bg-gray-50/50 rounded-2xl border border-gray-100 space-y-4">
            <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <User size={14} /> Responsable de la gare
            </h4>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-[3]">
                <label className="text-[12px] font-bold text-gray-700 mb-1.5 block">Nom complet</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input 
                    placeholder="Ex: Jean Kouassi" 
                    className="w-full h-11 pl-10 pr-4 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all placeholder:text-gray-300"
                    value={formData.chef_nom}
                    onChange={e => setFormData({...formData, chef_nom: e.target.value})}
                  />
                </div>
              </div>
              <div className="flex-[2]">
                <label className="text-[12px] font-bold text-gray-700 mb-1.5 block">Téléphone</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input 
                    placeholder="07 00..." 
                    className="w-full h-11 pl-10 pr-4 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all placeholder:text-gray-300"
                    value={formData.chef_tel}
                    onChange={e => setFormData({...formData, chef_tel: e.target.value})}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="flex gap-3 pt-2 mt-4">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 h-12 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 text-gray-700 rounded-xl font-bold text-sm transition-all"
            >
              Annuler
            </button>
            <button 
              type="submit" 
              className="flex-1 h-12 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-orange-500/20 flex items-center justify-center gap-2"
            >
              <Building2 size={18} /> Enregistrer la gare
            </button>
          </div>
        </form>

      </div>
    </div>
  )
}