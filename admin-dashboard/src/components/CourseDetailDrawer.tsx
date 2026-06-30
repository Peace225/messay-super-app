import { motion } from 'framer-motion';
import { X, MapPin, Clock, CreditCard, Phone, ShieldCheck } from 'lucide-react';

interface CourseProps {
  course: any;
  onClose: () => void;
}

export default function CourseDetailDrawer({ course, onClose }: CourseProps) {
  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed right-0 top-0 h-screen w-full md:w-[450px] bg-white shadow-[-20px_0_50px_rgba(0,0,0,0.1)] z-[100] p-8 overflow-y-auto border-l border-gray-100"
    >
      {/* HEADER DU DRAWER */}
      <div className="flex items-center justify-between mb-10">
        <div className="h-12 w-12 bg-gray-900 rounded-2xl flex items-center justify-center text-white cursor-pointer hover:bg-orange-600 transition-colors" onClick={onClose}>
          <X size={20} />
        </div>
        <span className="text-[10px] font-black uppercase tracking-[4px] text-gray-400 italic">Détails Mission</span>
      </div>

      {/* STATUT & ID */}
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-2">
          <h2 className="text-3xl font-black italic tracking-tighter uppercase text-gray-900">#{course.id.slice(0, 8)}</h2>
          <span className="bg-green-100 text-green-600 text-[10px] font-black px-3 py-1 rounded-full uppercase">En cours</span>
        </div>
        <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Type : {course.type || 'Livraison BTP'}</p>
      </div>

      {/* CHAUFFEUR (PHOTO & INFOS) */}
      <div className="bg-gray-50 rounded-[30px] p-6 mb-8 border border-gray-100 flex items-center space-x-5">
        <div className="h-16 w-16 bg-orange-200 rounded-2xl overflow-hidden border-2 border-white shadow-md">
          <img src={`https://ui-avatars.com/api/?name=${course.driverName}&background=FF5733&color=fff`} alt="Driver" />
        </div>
        <div>
          <h3 className="text-lg font-black text-gray-900 leading-none mb-1">{course.driverName}</h3>
          <div className="flex items-center text-gray-500 space-x-4">
            <div className="flex items-center text-[11px] font-bold uppercase"><Phone size={12} className="mr-1 text-orange-500" /> Appeler</div>
            <div className="flex items-center text-[11px] font-bold uppercase"><ShieldCheck size={12} className="mr-1 text-green-500" /> Vérifié</div>
          </div>
        </div>
      </div>

      {/* ITINÉRAIRE (LOOK LOGISTIQUE) */}
      <div className="space-y-8 mb-10 relative">
        <div className="absolute left-[11px] top-4 bottom-4 w-[2px] bg-dashed border-l-2 border-dashed border-gray-200"></div>
        
        <div className="flex items-start space-x-4 relative z-10">
          <div className="h-6 w-6 bg-white border-4 border-gray-900 rounded-full flex-shrink-0"></div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Départ (Dépôt)</p>
            <p className="text-sm font-bold text-gray-800">{course.startPoint || 'Zone 4, Abidjan'}</p>
          </div>
        </div>

        <div className="flex items-start space-x-4 relative z-10">
          <div className="h-6 w-6 bg-orange-500 border-4 border-white shadow-lg rounded-full flex-shrink-0"></div>
          <div>
            <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest animate-pulse">Destination</p>
            <p className="text-sm font-bold text-gray-800">{course.endPoint || 'Bouaké Center'}</p>
          </div>
        </div>
      </div>

      {/* FINANCES & TEMPS */}
      <div className="grid grid-cols-2 gap-4 mb-10">
        <div className="bg-white border border-gray-100 p-5 rounded-[25px] shadow-sm">
          <Clock className="text-gray-400 mb-2" size={18} />
          <p className="text-[10px] font-black text-gray-400 uppercase">Estimé</p>
          <p className="text-lg font-black text-gray-900 tracking-tighter italic">45 min</p>
        </div>
        <div className="bg-white border border-gray-100 p-5 rounded-[25px] shadow-sm">
          <CreditCard className="text-orange-500 mb-2" size={18} />
          <p className="text-[10px] font-black text-gray-400 uppercase">Tarif</p>
          <p className="text-lg font-black text-gray-900 tracking-tighter italic">{course.price || '25.000'} F</p>
        </div>
      </div>

      {/* ACTIONS CRITIQUES */}
      <div className="space-y-3">
        <button className="w-full bg-gray-900 text-white font-black py-5 rounded-3xl uppercase tracking-[2px] text-xs hover:bg-orange-600 transition-all shadow-xl shadow-gray-900/20">
          Contacter le Chauffeur
        </button>
        <button className="w-full bg-red-50 text-red-600 font-black py-5 rounded-3xl uppercase tracking-[2px] text-[10px] hover:bg-red-100 transition-all">
          Annuler la mission (Urgence)
        </button>
      </div>
    </motion.div>
  );
}