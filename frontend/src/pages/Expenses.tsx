import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import dayjs from 'dayjs';

interface Expense {
  id: string;
  title: string;
  amount: number;
  date: string;
  category?: { name: string; color?: string };
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
      console.error('Error loading expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const changeView = (newView: string) => setSearchParams({ view: newView, date });
  const changeDate = (direction: number) => {
    const newDate = dayjs(date).add(direction, view as any).format('YYYY-MM-DD');
    setSearchParams({ view, date: newDate });
  };

  const deleteExpense = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este gasto?')) return;
    try {
      await api.delete(`/api/expenses/${id}`);
      loadExpenses();
    } catch (error) {
      console.error('Error deleting expense:', error);
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
        <div className="space-y-3">
          {expenses.map((expense) => (
            <div
              key={expense.id}
              className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex items-center justify-between hover:border-slate-300 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <Link
                  to={`/expenses/${expense.id}`}
                  className="font-medium text-slate-900 hover:text-indigo-600 transition-colors"
                >
                  {expense.title}
                </Link>
                <div className="flex items-center gap-1.5 mt-1">
                  {expense.category?.name && (
                    <>
                      <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ background: expense.category.color || '#94a3b8' }}
                      />
                      <span className="text-xs text-slate-500">{expense.category.name}</span>
                      <span className="text-xs text-slate-300">·</span>
                    </>
                  )}
                  <span className="text-xs text-slate-500">{expense.payer.name}</span>
                </div>
                <div className="flex items-center gap-1 mt-2">
                  {expense.participants.map((p) => (
                    <span
                      key={p.person.id}
                      title={p.person.name}
                      className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center justify-center"
                    >
                      {p.person.name.charAt(0).toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-4 ml-4 shrink-0">
                <span className="text-rose-600 font-semibold">{expense.amount.toFixed(2)}€</span>
                <div className="flex items-center gap-1.5">
                  <Link
                    to={`/expenses/${expense.id}`}
                    className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  >
                    Ver
                  </Link>
                  <Link
                    to={`/expenses/${expense.id}/edit`}
                    className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  >
                    Editar
                  </Link>
                  <button
                    onClick={() => deleteExpense(expense.id)}
                    className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Expenses;
