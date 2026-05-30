import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { logger } from '../utils/logger';
import dayjs from 'dayjs';

interface Expense {
  id: string;
  title: string;
  amount: number;
  date: string;
  category?: { name: string; color?: string };
  payer: { id: string; name: string };
  participants: Array<{ person: { name: string }; share: number }>;
}

const quickActions = [
  {
    to: '/expenses/new',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    ),
    title: 'Nuevo Gasto',
    desc: 'Registrar un nuevo gasto compartido',
  },
  {
    to: '/people',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
    title: 'Personas',
    desc: 'Gestionar personas para compartir gastos',
  },
  {
    to: '/debts',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75" />
      </svg>
    ),
    title: 'Deudas',
    desc: 'Ver y saldar deudas pendientes',
  },
];

const Dashboard = () => {
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const response = await api.get('/api/expenses?period=day&date=' + dayjs().format('YYYY-MM-DD'));
      setRecentExpenses(response.data.slice(0, 5));
    } catch (error) {
      logger.error('Error loading dashboard data', { error });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">
          Hola, {user?.name || user?.email?.split('@')[0]} 👋
        </h1>
        <p className="text-slate-500 text-sm mt-1">Aquí tienes un resumen de hoy</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {quickActions.map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md hover:border-indigo-200 transition-all group"
          >
            <div className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center mb-3 group-hover:bg-indigo-100 transition-colors">
              {action.icon}
            </div>
            <h3 className="font-medium text-slate-900 text-sm">{action.title}</h3>
            <p className="text-slate-400 text-xs mt-0.5">{action.desc}</p>
          </Link>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-medium text-slate-900 text-sm">Gastos de hoy</h2>
          <Link to="/expenses" className="text-indigo-600 hover:text-indigo-700 text-sm font-medium">
            Ver todos →
          </Link>
        </div>

        {loading ? (
          <div className="px-5 py-8 text-center text-slate-400 text-sm">Cargando...</div>
        ) : recentExpenses.length === 0 ? (
          <div className="px-5 py-8 text-center text-slate-400 text-sm">
            No hay gastos registrados hoy
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {recentExpenses.map((expense) => (
              <Link
                key={expense.id}
                to={`/expenses/${expense.id}`}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
              >
                <div>
                  <span className="font-medium text-slate-800 text-sm">{expense.title}</span>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {expense.category?.name && `${expense.category.name} · `}{expense.payer.name}
                  </p>
                </div>
                <span className="text-rose-600 font-semibold text-sm">-{Number(expense.amount).toFixed(2)}€</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
