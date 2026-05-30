import { useEffect, useState } from 'react';
import api from '../services/api';

interface Person {
  id: string;
  name: string;
  createdAt: string;
}

const People = () => {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadPeople();
  }, []);

  const loadPeople = async () => {
    try {
      const response = await api.get('/api/people');
      setPeople(response.data);
    } catch (error) {
      console.error('Error loading people:', error);
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
      setNewName('');
      loadPeople();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al añadir persona');
    }
  };

  const deletePerson = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta persona?')) return;
    try {
      await api.delete(`/api/people/${id}`);
      loadPeople();
    } catch (error) {
      console.error('Error deleting person:', error);
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
          {people.map((person) => (
            <div key={person.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-semibold shrink-0">
                  {person.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">{person.name}</p>
                  <p className="text-xs text-slate-400">
                    Añadido el {new Date(person.createdAt).toLocaleDateString('es-ES')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => deletePerson(person.id)}
                className="text-slate-400 hover:text-rose-500 transition-colors text-sm px-2 py-1 hover:bg-rose-50 rounded-lg"
              >
                Eliminar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default People;
