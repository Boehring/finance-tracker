import { useEffect, useState } from 'react';
import api from '../services/api';

interface Category {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  createdAt: string;
}

const Categories = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#4f46e5');
  const [error, setError] = useState('');

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const response = await api.get('/api/categories');
      setCategories(response.data);
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      setError('');
      await api.post('/api/categories', { name: newName.trim(), color: newColor });
      setNewName('');
      setNewColor('#4f46e5');
      loadCategories();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al añadir categoría');
    }
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta categoría?')) return;
    try {
      await api.delete(`/api/categories/${id}`);
      loadCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Categorías</h1>

      <form onSubmit={addCategory} className="flex items-center gap-3 mb-6">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nombre de la categoría"
          className="flex-1 border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          required
        />
        <div className="relative">
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="w-10 h-10 rounded-lg border border-slate-300 cursor-pointer p-0.5"
          />
        </div>
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
      ) : categories.length === 0 ? (
        <div className="text-center text-slate-400 text-sm py-8 bg-white border border-slate-200 rounded-xl">
          No hay categorías registradas
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <span
                  className="w-4 h-4 rounded-full ring-2 ring-slate-200 shrink-0"
                  style={{ background: cat.color || '#94a3b8' }}
                />
                <div>
                  <p className="text-sm font-medium text-slate-800">{cat.name}</p>
                  <p className="text-xs text-slate-400">
                    Añadida el {new Date(cat.createdAt).toLocaleDateString('es-ES')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => deleteCategory(cat.id)}
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

export default Categories;
