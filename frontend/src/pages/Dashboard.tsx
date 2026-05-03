import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';
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
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Dashboard</h1>
      <p style={styles.welcome}>Bienvenido, {user?.name || user?.email}</p>

      <div style={styles.quickActions}>
        <Link to="/expenses/new" style={styles.actionCard}>
          <h3>Nuevo Gasto</h3>
          <p>Registrar un nuevo gasto compartido</p>
        </Link>
        <Link to="/people" style={styles.actionCard}>
          <h3>Personas</h3>
          <p>Gestionar personas para compartir gastos</p>
        </Link>
        <Link to="/debts" style={styles.actionCard}>
          <h3>Deudas</h3>
          <p>Ver y saldar deudas pendientes</p>
        </Link>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2>Gastos Recientes</h2>
          <Link to="/expenses" style={styles.viewAll}>Ver todos</Link>
        </div>
        {loading ? (
          <p>Cargando...</p>
        ) : recentExpenses.length === 0 ? (
          <p>No hay gastos registrados hoy</p>
        ) : (
          <div style={styles.expenseList}>
            {recentExpenses.map((expense) => (
              <Link key={expense.id} to={`/expenses/${expense.id}`} style={styles.expenseItem}>
                <div>
                  <strong>{expense.title}</strong>
                  <p style={styles.meta}>{expense.category?.name} • {expense.payer.name}</p>
                </div>
                <div style={styles.amount}>-{expense.amount.toFixed(2)}€</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px',
  },
  title: {
    color: '#2c3e50',
    marginBottom: '10px',
  },
  welcome: {
    color: '#7f8c8d',
    marginBottom: '30px',
  },
  quickActions: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '20px',
    marginBottom: '40px',
  },
  actionCard: {
    background: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    textDecoration: 'none',
    color: '#2c3e50',
    transition: 'transform 0.2s',
  },
  section: {
    background: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  viewAll: {
    color: '#3498db',
    textDecoration: 'none',
  },
  expenseList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  },
  expenseItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '15px',
    background: '#f8f9fa',
    borderRadius: '4px',
    textDecoration: 'none',
    color: '#2c3e50',
  },
  meta: {
    fontSize: '14px',
    color: '#7f8c8d',
    marginTop: '5px',
  },
  amount: {
    fontSize: '18px',
    fontWeight: 'bold' as const,
    color: '#e74c3c',
  },
};

export default Dashboard;
