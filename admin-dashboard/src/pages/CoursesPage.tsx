import { useQuery } from '@tanstack/react-query';
import { courseService } from '../services/courseService';

export default function CoursesPage() {
  // Récupérer les courses depuis l'API
  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['courses'],
    queryFn: () => courseService.getCourses(),
  });

  const getStatusColor = (statut: string) => {
    switch (statut) {
      case 'TERMINEE':
        return 'bg-green-100 text-green-800';
      case 'EN_COURS':
        return 'bg-blue-100 text-blue-800';
      case 'EN_ATTENTE':
        return 'bg-yellow-100 text-yellow-800';
      case 'ANNULEE':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
      <h1 className="text-3xl font-bold mb-8">Gestion des courses</h1>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Conducteur</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trajet</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prix</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {courses.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                  Aucune course trouvée
                </td>
              </tr>
            ) : (
              courses.map((course: any) => (
                <tr key={course.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {course.user?.prenom} {course.user?.nom}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {course.conducteur ? `${course.conducteur.user.prenom} ${course.conducteur.user.nom}` : 'En attente'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm">
                      <div>{course.departAdresse}</div>
                      <div className="text-gray-500">→ {course.destinationAdresse}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{course.prix} FCFA</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded ${getStatusColor(course.statut)}`}>
                      {course.statut}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {new Date(course.createdAt).toLocaleDateString()}
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
