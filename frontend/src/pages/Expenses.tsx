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

  const changeView = (newView: string) => {
    setSearchParams({ view: newView, date });
  };

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
    <div style={styles.container}>
      <div style={styles.header}>
        <h1>Gastos</h1>
        <Link to="/expenses/new" style={styles.newBtn}>Nuevo Gasto</Link>
      </div>

      <div style={styles.controls}>
        <div style={styles.viewTabs}>
          {['day', 'week', 'month', 'year'].map((v) => (
            <button
              key={v}
              onClick={() => changeView(v)}
              style={view === v ? styles.activeTab : styles.tab}
            >
              {v === 'day' ? 'Día' : v === 'week' ? 'Semana' : v === 'month' ? 'Mes' : 'Año'}
            </button>
          ))}
        </div>
        <div style={styles.dateNav}>
          <button onClick={() => changeDate(-1)} style={styles.navBtn}>←</button>
          <span style={styles.dateDisplay}>{date}</span>
          <button onClick={() => changeDate(1)} style={styles.navBtn}>→</button>
        </div>
      </div>

      {loading ? (
        <p>Cargando...</p>
      ) : expenses.length === 0 ? (
        <p>No hay gastos para este período</p>
      ) : (
        <div style={styles.list}>
          {expenses.map((expense) => (
            <div key={expense.id} style={styles.item}>
              <div style={styles.expenseInfo}>
                <Link to={`/expenses/${expense.id}`} style={styles.title}>
                  {expense.title}
                </Link>
                <div style={styles.meta}>
                  {expense.category?.name && (
                    <span style={{ color: expense.category.color }}>{expense.category.name}</span>
                  )}
                  <span> • {expense.payer.name}</span>
                </div>
                <div style={styles.participants}>
                  {expense.participants.map((p) => (
                    <span key={p.person.id} style={styles.participantIcon} title={p.person.name}>
                      {p.person.name.charAt(0).toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>
              <div style={styles.actions}>
                <span style={styles.amount}>{expense.amount.toFixed(2)}€</span>
                <div style={styles.buttons}>
                  <Link to={`/expenses/${expense.id}`} style={styles.actionBtn}>Ver</Link>
                  <Link to={`/expenses/${expense.id}/edit`} style={styles.actionBtn}>Editar</Link>
                  <button onClick={() => deleteExpense(expense.id)} style={styles.deleteBtn}>Eliminar</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  newBtn: {
    background: '#2ecc71',
    color: 'white',
    padding: '10px 20px',
    borderRadius: '4px',
    textDecoration: 'none',
  },
  controls: {
    background: 'white',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  viewTabs: {
    display: 'flex',
    gap: '10px',
    marginBottom: '15px',
  },
  tab: {
    padding: '8px 16px',
    border: '1px solid #ddd',
    background: 'white',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  activeTab: {
    padding: '8px 16px',
    border: '1px solid #3498db',
    background: '#3498db',
    color: 'white',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  dateNav: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  navBtn: {
    padding: '8px 16px',
    border: '1px solid #ddd',
    background: 'white',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
  },
  dateDisplay: {
    fontSize: '16px',
    fontWeight: 'bold' as const,
  },
  list: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  },
  item: {
    background: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expenseInfo: {
    flex: 1,
  },
  title: {
    fontSize: '18px',
    color: '#2c3e50',
    textDecoration: 'none',
    fontWeight: 'bold' as const,
  },
  meta: {
    fontSize: '14px',
    color: '#7f8c8d',
    marginTop: '5px',
  },
  participants: {
    display: 'flex',
    gap: '5px',
    marginTop: '10px',
  },
  participantIcon: {
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    background: '#3498db',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 'bold' as const,
  },
  actions: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-end',
    gap: '10px',
  },
  amount: {
    fontSize: '20px',
    fontWeight: 'bold' as const,
    color: '#e74c3c',
  },
  buttons: {
    display: 'flex',
    gap: '10px',
  },
  actionBtn: {
    padding: '5px 10px',
    background: '#3498db',
    color: 'white',
    borderRadius: '4px',
    textDecoration: 'none',
    fontSize: '14px',
  },
  deleteBtn: {
    padding: '5px 10px',
    background: '#e74c3c',
    color: 'white',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
  },
};

export default Expenses;
