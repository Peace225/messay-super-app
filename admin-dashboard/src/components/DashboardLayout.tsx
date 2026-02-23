import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function DashboardLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-secondary text-white">
        <div className="p-6">
          <h1 className="text-2xl font-bold">MESSAY Admin</h1>
        </div>
        
        <nav className="mt-6">
          <Link
            to="/"
            className="block px-6 py-3 hover:bg-primary transition"
          >
            📊 Dashboard
          </Link>
          <Link
            to="/users"
            className="block px-6 py-3 hover:bg-primary transition"
          >
            👥 Utilisateurs
          </Link>
          <Link
            to="/conducteurs"
            className="block px-6 py-3 hover:bg-primary transition"
          >
            🚗 Conducteurs
          </Link>
          <Link
            to="/courses"
            className="block px-6 py-3 hover:bg-primary transition"
          >
            🛺 Courses
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="ml-64">
        {/* Header */}
        <header className="bg-white shadow-sm">
          <div className="flex justify-between items-center px-8 py-4">
            <h2 className="text-xl font-semibold text-gray-800">
              Bienvenue, {user?.nom}
            </h2>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Déconnexion
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
