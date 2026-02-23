import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { statsService } from '../services/statsService';

export default function DashboardPage() {
  // Récupérer les statistiques depuis l'API
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: () => statsService.getStats(),
  });

  const { data: chartData, isLoading: chartLoading } = useQuery({
    queryKey: ['weeklyData'],
    queryFn: () => statsService.getWeeklyData(),
  });

  if (statsLoading || chartLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Chargement...</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Tableau de bord</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-gray-500 text-sm">Utilisateurs</div>
          <div className="text-3xl font-bold text-primary">{stats?.totalUsers || 0}</div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-gray-500 text-sm">Courses totales</div>
          <div className="text-3xl font-bold text-primary">{stats?.totalCourses || 0}</div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-gray-500 text-sm">Revenus (FCFA)</div>
          <div className="text-3xl font-bold text-primary">
            {(stats?.totalRevenue || 0).toLocaleString()}
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-gray-500 text-sm">Conducteurs actifs</div>
          <div className="text-3xl font-bold text-primary">{stats?.activeConducteurs || 0}</div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Activité de la semaine</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="courses" fill="#FF6B35" name="Courses" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
