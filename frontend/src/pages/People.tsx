import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import api from '../services/api';
import { logger } from '../utils/logger';
import ConfirmDialog from '../components/ConfirmDialog';

interface Person {
  id: string;
  name: string;
  lastName?: string;
  avatarUrl?: string;
  identifier?: string;
  createdAt: string;
}

const People = () => {
  const navigate = useNavigate();
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    loadPeople();
  }, []);

  const loadPeople = async () => {
    try {
      const response = await api.get('/api/people');
      setPeople(response.data);
    } catch (error) {
      logger.error('Error loading people', { error });
    } finally {
      setLoading(false);
    }
  };

  const addPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      setError('');
      await api.post('/api/people', { name: newName.trim() });
      logger.info('Person added', { name: newName.trim() });
      setNewName('');
      loadPeople();
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Error al añadir persona';
      setError(msg);
      logger.error('Error adding person', { name: newName.trim(), error: msg });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/api/people/${deleteTarget.id}`);
      logger.info('Person deleted', { personId: deleteTarget.id });
      loadPeople();
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Error al eliminar persona';
      setError(msg);
      logger.error('Error deleting person', { personId: deleteTarget.id, error: msg });
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Personas</h1>

      <form onSubmit={addPerson} className="flex gap-3 mb-6">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nombre de la persona"
          className="flex-1 border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          required
        />
        <button
          type="submit"
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Añadir
        </button>
      </form>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center text-slate-400 text-sm py-8">Cargando...</div>
      ) : people.length === 0 ? (
        <div className="text-center text-slate-400 text-sm py-8 bg-white border border-slate-200 rounded-xl">
          No hay personas registradas
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {people.map((person) => {
            const initials = (person.name.charAt(0) + (person.lastName?.charAt(0) || '')).toUpperCase();
            const fullName = person.lastName ? `${person.name} ${person.lastName}` : person.name;
            return (
              <div
                key={person.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-semibold shrink-0 overflow-hidden">
                    {person.avatarUrl ? (
                      <img src={person.avatarUrl} alt={person.name} className="w-full h-full object-cover" />
                    ) : (
                      initials
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{fullName}</p>
                    {person.identifier && (
                      <p className="text-xs text-slate-400">@{person.identifier}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-0.5 ml-3 shrink-0">
                  <Link
                    to={`/people/${person.id}`}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="Ver"
                  >
                    <Eye size={15} />
                  </Link>
                  <button
                    onClick={() => navigate(`/people/${person.id}?edit=1`)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget({ id: person.id, name: fullName })}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Eliminar persona"
        message={`¿Eliminar "${deleteTarget?.name}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        danger
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default People;
