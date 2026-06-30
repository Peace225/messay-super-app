import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './components/DashboardLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import { useAuthStore } from './store/authStore';

// Importation correcte depuis le dossier components
import { 
  TricyclesModule, 
  BusTicketsModule 
} from './components/modules/LogistiqueModules';

import { 
  ChauffeursModule, 
  UtilisateursModule 
} from './components/modules/RHModules';

import { FinanceModule } from './components/modules/FinanceModule';

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      
      <Route
        path="/"
        element={
          <PrivateRoute>
            <DashboardLayout />
          </PrivateRoute>
        }
      >
        {/* Page d'accueil du Dashboard */}
        <Route index element={<DashboardPage />} />
        
        {/* Logistique */}
        <Route path="logistique/tricycles" element={<TricyclesModule />} />
        <Route path="logistique/tickets-bus" element={<BusTicketsModule />} />
        
        {/* Ressources Humaines */}
        <Route path="rh/utilisateurs" element={<UtilisateursModule />} />
        <Route path="rh/chauffeurs" element={<ChauffeursModule />} />
        
        {/* Finance */}
        <Route path="finance/tresorerie" element={<FinanceModule />} />
        <Route path="finance/rapports" element={<FinanceModule />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}