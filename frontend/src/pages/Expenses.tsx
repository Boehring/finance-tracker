import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import api from '../services/api';
import { logger } from '../utils/logger';
import dayjs from 'dayjs';
import ConfirmDialog from '../components/ConfirmDialog';

interface Expense {
  id: string;
  title: string;
  amount: number;
  date: string;
  category?: { name: string; color?: string; icon?: string };
  payer: { id: string; name: string };
  participants: Array<{ person: { id: string; name: string }; share: number }>;
}

const VIEW_LABELS: Record<string, string> = {
  day: 'Día',
  week: 'Semana',
  month: 'Mes',
  year: 'Año',
};

const Expenses = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get('view') || 'day';
  const date = searchParams.get('date') || dayjs().format('YYYY-MM-DD');

  useEffect(() => {
    loadExpenses();
  }, [view, date]);

  const loadExpenses = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/expenses/summary?period=${view}&date=${date}`);
      const data = Object.values(response.data).flat() as Expense[];
      setExpenses(data);
    } catch (error) {
      logger.error('Error loading expenses', { view, date, error });
    } finally {
      setLoading(false);
    }
  };

  const changeView = (newView: string) => setSearchParams({ view: newView, date });
  const changeDate = (direction: number) => {
    const newDate = dayjs(date).add(direction, view as any).format('YYYY-MM-DD');
    setSearchParams({ view, date: newDate });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/api/expenses/${deleteTarget.id}`);
      logger.info('Expense deleted from list', { expenseId: deleteTarget.id });
      loadExpenses();
    } catch (error) {
      logger.error('Error deleting expense', { expenseId: deleteTarget.id, error });
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Gastos</h1>
        <Link
          to="/expenses/new"
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Nuevo Gasto
        </Link>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-2 mb-4">
          {Object.entries(VIEW_LABELS).map(([v, label]) => (
            <button
              key={v}
              onClick={() => changeView(v)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                view === v
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => changeDate(-1)}
            className="w-8 h-8 flex items-center justify-center rounded-full border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
          >
            ←
          </button>
          <span className="text-sm font-medium text-slate-700 min-w-[120px] text-center">{date}</span>
          <button
            onClick={() => changeDate(1)}
            className="w-8 h-8 flex items-center justify-center rounded-full border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
          >
            →
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-slate-400 text-sm py-12">Cargando...</div>
      ) : expenses.length === 0 ? (
        <div className="text-center text-slate-400 text-sm py-12 bg-white border border-slate-200 rounded-xl">
          No hay gastos para este período
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map((expense) => (
            <div
              key={expense.id}
              className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 flex items-center justify-between hover:border-slate-300 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <Link
                  to={`/expenses/${expense.id}`}
                  className="font-medium text-slate-900 hover:text-indigo-600 transition-colors text-sm"
                >
                  {expense.title}
                </Link>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  {expense.category?.name && (
                    <>
                      {expense.category.icon && (
                        <span className="text-xs">{expense.category.icon}</span>
                      )}
                      <span
                        className="inline-block w-2 h-2 rounded-full shrink-0"
                        style={{ background: expense.category.color || '#94a3b8' }}
                      />
                      <span className="text-xs text-slate-500">{expense.category.name}</span>
                      <span className="text-xs text-slate-300">·</span>
                    </>
                  )}
                  <span className="text-xs text-slate-500">{expense.payer.name}</span>
                  {expense.participants.length > 0 && (
                    <>
                      <span className="text-xs text-slate-300">·</span>
                      <div className="flex items-center gap-0.5">
                        {expense.participants.map((p) => (
                          <span
                            key={p.person.id}
                            title={p.person.name}
                            className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center justify-center"
                          >
                            {p.person.name.charAt(0).toUpperCase()}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 ml-4 shrink-0">
                <span className="text-rose-600 font-semibold text-sm">{Number(expense.amount).toFixed(2)}€</span>
                <div className="flex items-center gap-0.5">
                  <Link
                    to={`/expenses/${expense.id}`}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="Ver"
                  >
                    <Eye size={15} />
                  </Link>
                  <Link
                    to={`/expenses/${expense.id}/edit`}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <Pencil size={15} />
                  </Link>
                  <button
                    onClick={() => setDeleteTarget({ id: expense.id, name: expense.title })}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Eliminar gasto"
        message={`¿Eliminar "${deleteTarget?.name}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        danger
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default Expenses;
