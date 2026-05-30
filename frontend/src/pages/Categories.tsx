import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import api from '../services/api';
import { logger } from '../utils/logger';

interface Category {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  createdAt: string;
}

interface CategoryStat {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  totalAmount: number;
  expenseCount: number;
}

type Period = 'day' | 'week' | 'month' | 'year' | 'all';

const ICON_PALETTE = [
  '🍕','🚗','🏠','💊','🎬','📚','🛒','✈️','💪','👕',
  '💻','🎁','💰','🏦','🍺','🐕','💆','🔧','📱','⚡',
  '🌱','🎮','🎵','🏥','🍔','☕','🎓','🏋️','🎭','🧴',
];

const PERIOD_LABELS: Record<Period, string> = {
  day: 'Día',
  week: 'Semana',
  month: 'Mes',
  year: 'Año',
  all: 'Total',
};

function IconPicker({
  selected,
  onSelect,
  onClose,
}: {
  selected: string;
  onSelect: (icon: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute z-20 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg p-2 grid grid-cols-6 gap-1 w-52">
      {ICON_PALETTE.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => { onSelect(emoji); onClose(); }}
          className={`text-lg p-1 rounded-lg hover:bg-slate-100 transition-colors ${selected === emoji ? 'bg-indigo-100 ring-1 ring-indigo-400' : ''}`}
        >
          {emoji}
        </button>
      ))}
      {selected && (
        <button
          type="button"
          onClick={() => { onSelect(''); onClose(); }}
          className="col-span-6 text-xs text-slate-400 hover:text-rose-500 pt-1 text-center"
        >
          Quitar icono
        </button>
      )}
    </div>
  );
}

const Categories = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#4f46e5');
  const [newIcon, setNewIcon] = useState('');
  const [showNewIconPicker, setShowNewIconPicker] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#4f46e5');
  const [editIcon, setEditIcon] = useState('');
  const [showEditIconPicker, setShowEditIconPicker] = useState(false);

  const [period, setPeriod] = useState<Period>('month');
  const [stats, setStats] = useState<CategoryStat[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => { loadCategories(); }, []);
  useEffect(() => { loadStats(period); }, [period]);

  const loadCategories = async () => {
    try {
      const response = await api.get('/api/categories');
      setCategories(response.data);
    } catch (err) {
      logger.error('Error loading categories', { err });
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async (p: Period) => {
    setStatsLoading(true);
    try {
      const response = await api.get(`/api/categories/stats?period=${p}`);
      setStats(response.data);
    } catch (err) {
      logger.error('Error loading category stats', { err });
    } finally {
      setStatsLoading(false);
    }
  };

  const refresh = () => {
    loadCategories();
    loadStats(period);
  };

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      setError('');
      await api.post('/api/categories', { name: newName.trim(), color: newColor, icon: newIcon || undefined });
      logger.info('Category added', { name: newName.trim() });
      setNewName('');
      setNewColor('#4f46e5');
      setNewIcon('');
      setShowNewIconPicker(false);
      refresh();
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Error al añadir categoría';
      setError(msg);
      logger.error('Error adding category', { error: msg });
    }
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditColor(cat.color || '#4f46e5');
    setEditIcon(cat.icon || '');
    setShowEditIconPicker(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setShowEditIconPicker(false);
  };

  const saveEdit = async (id: string) => {
    if (!editName.trim()) return;
    try {
      setError('');
      await api.put(`/api/categories/${id}`, { name: editName.trim(), color: editColor, icon: editIcon || undefined });
      logger.info('Category updated', { categoryId: id });
      setEditingId(null);
      setShowEditIconPicker(false);
      refresh();
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Error al guardar categoría';
      setError(msg);
      logger.error('Error updating category', { categoryId: id, error: msg });
    }
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta categoría?')) return;
    try {
      await api.delete(`/api/categories/${id}`);
      logger.info('Category deleted', { categoryId: id });
      if (editingId === id) setEditingId(null);
      refresh();
    } catch (err) {
      logger.error('Error deleting category', { categoryId: id, err });
    }
  };

  const chartData = stats
    .filter(s => s.totalAmount > 0)
    .map(s => ({ name: s.name, total: s.totalAmount, color: s.color || '#94a3b8' }));

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Categorías</h1>

      {/* Add form */}
      <form onSubmit={addCategory} className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre de la categoría"
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
            required
          />
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            title="Color"
            className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer p-0.5 shrink-0"
          />
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowNewIconPicker(!showNewIconPicker)}
              title="Elegir icono"
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-300 hover:border-indigo-400 text-lg transition-colors"
            >
              {newIcon || <span className="text-slate-400 text-sm">＋</span>}
            </button>
            {showNewIconPicker && (
              <IconPicker
                selected={newIcon}
                onSelect={setNewIcon}
                onClose={() => setShowNewIconPicker(false)}
              />
            )}
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors shrink-0"
          >
            Añadir
          </button>
        </div>
      </form>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {/* Category list */}
      {loading ? (
        <div className="text-center text-slate-400 text-sm py-8">Cargando...</div>
      ) : categories.length === 0 ? (
        <div className="text-center text-slate-400 text-sm py-8 bg-white border border-slate-200 rounded-xl">
          No hay categorías registradas
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 mb-8">
          {categories.map((cat) => (
            <div key={cat.id}>
              {editingId === cat.id ? (
                <div className="px-4 py-3 bg-indigo-50 border-l-2 border-indigo-400">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      autoFocus
                    />
                    <input
                      type="color"
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value)}
                      title="Color"
                      className="w-8 h-8 rounded-lg border border-slate-300 cursor-pointer p-0.5 shrink-0"
                    />
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowEditIconPicker(!showEditIconPicker)}
                        title="Elegir icono"
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-300 hover:border-indigo-400 text-base transition-colors"
                      >
                        {editIcon || <span className="text-slate-400 text-xs">＋</span>}
                      </button>
                      {showEditIconPicker && (
                        <IconPicker
                          selected={editIcon}
                          onSelect={setEditIcon}
                          onClose={() => setShowEditIconPicker(false)}
                        />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => saveEdit(cat.id)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors"
                    >
                      Guardar
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="px-3 py-1.5 text-slate-500 hover:text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    {cat.icon ? (
                      <span className="text-xl leading-none w-6 text-center">{cat.icon}</span>
                    ) : (
                      <span
                        className="w-6 h-6 rounded-full ring-2 ring-slate-200 shrink-0"
                        style={{ background: cat.color || '#94a3b8' }}
                      />
                    )}
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: cat.color || '#94a3b8' }}
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-800">{cat.name}</p>
                      <p className="text-xs text-slate-400">
                        Añadida el {new Date(cat.createdAt).toLocaleDateString('es-ES')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEdit(cat)}
                      className="text-slate-400 hover:text-indigo-600 transition-colors text-xs px-2 py-1 hover:bg-indigo-50 rounded-lg"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => deleteCategory(cat.id)}
                      className="text-slate-400 hover:text-rose-500 transition-colors text-xs px-2 py-1 hover:bg-rose-50 rounded-lg"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Stats chart */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-800">Gasto por categoría</h2>
          <div className="flex gap-1">
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                  period === p
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        {statsLoading ? (
          <div className="text-center text-slate-400 text-sm py-8">Cargando...</div>
        ) : chartData.length === 0 ? (
          <div className="text-center text-slate-400 text-sm py-8">
            Sin gastos en este periodo
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${v}€`}
                width={52}
              />
              <Tooltip
                formatter={(value) => [`${Number(value ?? 0).toFixed(2)} €`, 'Total']}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                cursor={{ fill: '#f1f5f9' }}
              />
              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default Categories;
