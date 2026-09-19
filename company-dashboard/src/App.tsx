import { BrowserRouter, Routes, Route, NavLink, Outlet, useNavigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Gares from './pages/Gares';
import Billets from './pages/Billets';
import Retraits from './pages/Retraits';
import Chauffeurs from './pages/Chauffeurs';
import TrajetsReel from './pages/TrajetsReel';
import Reservations from './pages/Reservations';
import { 
  LayoutDashboard, 
  MapPin, 
  Ticket, 
  Wallet, 
  Bus, 
  Route as RouteIcon, 
  LogOut, 
  ClipboardList 
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/gares', label: 'Gares & Départs', icon: MapPin },
  { to: '/reservations', label: 'Réservations', icon: ClipboardList },
  { to: '/billets', label: 'Billets (Gare→Gare)', icon: Ticket },
  { to: '/chauffeurs', label: 'Chauffeurs', icon: Bus },
  { to: '/trajets', label: 'Trajets Réel', icon: RouteIcon },
  { to: '/retraits', label: 'Retraits', icon: Wallet },
];

function Layout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar Navigation */}
      <aside className="w-[260px] bg-white border-r border-gray-100 p-4 flex flex-col justify-between">
        <div className="space-y-6">
          <h1 className="font-black text-xl text-gray-900 px-3">MESSAY PRO</h1>
          
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                    isActive
                      ? 'bg-[#0B4DA1] text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`
                }
              >
                <item.icon size={18} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Action Déconnexion */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-600 font-medium transition-colors px-3 py-2 rounded-xl hover:bg-red-50"
        >
          <LogOut size={16} />
          Déconnexion
        </button>
      </aside>

      {/* Zone de contenu dynamique */}
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Route parente qui applique le Layout à toutes les pages internes */}
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/gares" element={<Gares />} />
          <Route path="/reservations" element={<Reservations />} />
          <Route path="/billets" element={<Billets />} />
          <Route path="/chauffeurs" element={<Chauffeurs />} />
          <Route path="/trajets" element={<TrajetsReel />} />
          <Route path="/retraits" element={<Retraits />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}