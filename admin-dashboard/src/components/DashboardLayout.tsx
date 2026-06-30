import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar'; // ✅ CORRIGÉ : Importe bien le fichier Sidebar
import Header from './Header';   // ✅ CORRIGÉ : Importe le fichier Header

export default function DashboardLayout() {
  return (
    <div className="flex min-h-screen bg-[#F8F9FB]">
      
      {/* 1. Sidebar : Fixe à gauche (Largeur w-72 définie dans le composant) */}
      <Sidebar />

      {/* 2. Zone de contenu : Décalée exactement de la largeur de la Sidebar (ml-72) */}
      <div className="flex-1 ml-72 flex flex-col min-h-screen">
        
        {/* 3. Header : Sticky en haut de la zone de contenu */}
        <Header />

        {/* 4. Main : Zone où s'injectent tes pages (Dashboard, BTP, etc.) */}
        <main className="p-8 flex-1">
          <Outlet /> 
        </main>
        
      </div>
    </div>
  );
}