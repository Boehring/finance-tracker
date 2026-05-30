import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import api from '../services/api';
import { logger } from '../utils/logger';
import ConfirmDialog from '../components/ConfirmDialog';

interface Expense {
  id: string;
  title: string;
  description?: string;
  amount: number;
  date: string;
  type: string;
  category?: { name: string; color?: string; icon?: string };
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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    loadExpense();
  }, [id]);

  const loadExpense = async () => {
    try {
      const response = await api.get(`/api/expenses/${id}`);
      setExpense(response.data);
    } catch (error) {
      logger.error('Error loading expense detail', { expenseId: id, error });
      navigate('/expenses');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      await api.delete(`/api/expenses/${id}`);
      logger.info('Expense deleted from detail view', { expenseId: id });
      navigate('/expenses');
    } catch (error) {
      logger.error('Error deleting expense from detail', { expenseId: id, error });
    } finally {
      setShowDeleteDialog(false);
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
            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-slate-200"
            title="Editar"
          >
            <Pencil size={16} />
          </Link>
          <button
            onClick={() => setShowDeleteDialog(true)}
            className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors border border-rose-200"
            title="Eliminar"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Total</p>
        <p className="text-4xl font-bold text-rose-600 mb-6">-{Number(expense.amount).toFixed(2)}€</p>

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
                {expense.category.icon && (
                  <span className="text-base leading-none">{expense.category.icon}</span>
                )}
                <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ background: expense.category.color || '#94a3b8' }} />
                <span className="text-sm text-slate-800">{expense.category.name}</span>
              </div>
            </div>
          )}
          {expense.description && (
            <div className="col-span-2">
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Descripción</p>
              <div className="text-sm text-slate-800 [&_h1]:text-base [&_h1]:font-bold [&_h1]:mb-1 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mb-1 [&_h3]:font-semibold [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:ml-4 [&_ul]:mb-1 [&_ol]:list-decimal [&_ol]:ml-4 [&_ol]:mb-1 [&_p]:mb-1 [&_p:last-child]:mb-0 [&_code]:bg-slate-100 [&_code]:rounded [&_code]:px-1 [&_code]:font-mono [&_code]:text-xs [&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_blockquote]:text-slate-600 [&_blockquote]:italic [&_a]:text-indigo-600 [&_a]:underline">
                <ReactMarkdown>{expense.description}</ReactMarkdown>
              </div>
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
              <span className="text-sm font-semibold text-slate-700">{Number(p.share).toFixed(2)}€</span>
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

      <ConfirmDialog
        isOpen={showDeleteDialog}
        title="Eliminar gasto"
        message={`¿Eliminar "${expense.title}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        danger
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteDialog(false)}
      />
    </div>
  );
};

export default ExpenseView;
