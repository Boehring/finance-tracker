import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';

interface Expense {
  id: string;
  title: string;
  description?: string;
  amount: number;
  date: string;
  type: string;
  category?: { name: string; color?: string };
  payer: { id: string; name: string };
  participants: Array<{
    person: { id: string; name: string };
    percentage?: number;
    amount?: number;
    share: number;
  }>;
  attachments: Array<{
    id: string;
    originalName: string;
    type: string;
    path: string;
  }>;
  createdAt: string;
}

const ExpenseView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [expense, setExpense] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExpense();
  }, [id]);

  const loadExpense = async () => {
    try {
      const response = await api.get(`/api/expenses/${id}`);
      setExpense(response.data);
    } catch (error) {
      console.error('Error loading expense:', error);
      navigate('/expenses');
    } finally {
      setLoading(false);
    }
  };

  const deleteExpense = async () => {
    if (!confirm('¿Estás seguro de eliminar este gasto?')) return;
    try {
      await api.delete(`/api/expenses/${id}`);
      navigate('/expenses');
    } catch (error) {
      console.error('Error deleting expense:', error);
    }
  };

  if (loading) return <div className="max-w-2xl mx-auto px-4 py-12 text-slate-400 text-sm">Cargando...</div>;
  if (!expense) return <div className="max-w-2xl mx-auto px-4 py-12 text-slate-400 text-sm">Gasto no encontrado</div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <Link to="/expenses" className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
            ← Gastos
          </Link>
          <h1 className="text-xl font-semibold text-slate-900 mt-1">{expense.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={`/expenses/${id}/edit`}
            className="px-3 py-1.5 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Editar
          </Link>
          <button
            onClick={deleteExpense}
            className="px-3 py-1.5 text-sm font-medium text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-50 transition-colors"
          >
            Eliminar
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Total</p>
        <p className="text-4xl font-bold text-rose-600 mb-6">-{expense.amount.toFixed(2)}€</p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Fecha</p>
            <p className="text-sm text-slate-800">{new Date(expense.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Pagado por</p>
            <p className="text-sm text-slate-800">{expense.payer.name}</p>
          </div>
          {expense.category && (
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Categoría</p>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: expense.category.color || '#94a3b8' }} />
                <span className="text-sm text-slate-800">{expense.category.name}</span>
              </div>
            </div>
          )}
          {expense.description && (
            <div className="col-span-2">
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Descripción</p>
              <p className="text-sm text-slate-800">{expense.description}</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Participantes</h2>
        <div className="space-y-2">
          {expense.participants.map((p) => (
            <div key={p.person.id} className="flex items-center gap-3 py-2">
              <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-semibold shrink-0">
                {p.person.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-800">{p.person.name}</p>
                <p className="text-xs text-slate-400">
                  {p.percentage != null ? `${p.percentage}%` : p.amount != null ? `${p.amount}€` : ''}
                </p>
              </div>
              <span className="text-sm font-semibold text-slate-700">{p.share.toFixed(2)}€</span>
            </div>
          ))}
        </div>
      </div>

      {expense.attachments.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Adjuntos</h2>
          <div className="flex flex-wrap gap-2">
            {expense.attachments.map((att) => (
              <a
                key={att.id}
                href={`/uploads/${att.path.split('/').pop()}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm rounded-full transition-colors"
              >
                <span>{att.type === 'image' ? '🖼️' : '📄'}</span>
                <span>{att.originalName}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpenseView;
