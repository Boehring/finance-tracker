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

  if (loading) return <div style={styles.container}>Cargando...</div>;
  if (!expense) return <div style={styles.container}>Gasto no encontrado</div>;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1>{expense.title}</h1>
        <div style={styles.actions}>
          <Link to={`/expenses/${id}/edit`} style={styles.editBtn}>Editar</Link>
          <button onClick={deleteExpense} style={styles.deleteBtn}>Eliminar</button>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.amount}>-{expense.amount.toFixed(2)}€</div>
        <div style={styles.meta}>
          <p><strong>Fecha:</strong> {new Date(expense.date).toLocaleDateString()}</p>
          <p><strong>Pagado por:</strong> {expense.payer.name}</p>
          {expense.category && (
            <p><strong>Categoría:</strong> <span style={{ color: expense.category.color }}>{expense.category.name}</span></p>
          )}
          {expense.description && (
            <p><strong>Descripción:</strong> {expense.description}</p>
          )}
        </div>
      </div>

      <div style={styles.card}>
        <h2>Participantes</h2>
        <div style={styles.participants}>
          {expense.participants.map((p) => (
            <div key={p.person.id} style={styles.participant}>
              <div style={styles.participantIcon}>{p.person.name.charAt(0).toUpperCase()}</div>
              <div style={styles.participantInfo}>
                <strong>{p.person.name}</strong>
                <span>
                  {p.percentage !== null && p.percentage !== undefined && ` ${p.percentage}%`}
                  {p.amount !== null && p.amount !== undefined && ` ${p.amount}€`}
                </span>
              </div>
              <div style={styles.share}>{p.share.toFixed(2)}€</div>
            </div>
          ))}
        </div>
      </div>

      {expense.attachments.length > 0 && (
        <div style={styles.card}>
          <h2>Adjuntos</h2>
          <div style={styles.attachments}>
            {expense.attachments.map((att) => (
              <a
                key={att.id}
                href={`/api/uploads/${att.path.split('/').pop()}`}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.attachment}
              >
                {att.type === 'image' ? '🖼️' : '📄'} {att.originalName}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '20px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  actions: {
    display: 'flex',
    gap: '10px',
  },
  editBtn: {
    padding: '8px 16px',
    background: '#3498db',
    color: 'white',
    borderRadius: '4px',
    textDecoration: 'none',
  },
  deleteBtn: {
    padding: '8px 16px',
    background: '#e74c3c',
    color: 'white',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
  },
  card: {
    background: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    marginBottom: '20px',
  },
  amount: {
    fontSize: '32px',
    fontWeight: 'bold' as const,
    color: '#e74c3c',
    marginBottom: '20px',
  },
  meta: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
    color: '#555',
  },
  participants: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  },
  participant: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    padding: '10px',
    background: '#f8f9fa',
    borderRadius: '4px',
  },
  participantIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: '#3498db',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold' as const,
  },
  participantInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '5px',
  },
  share: {
    fontSize: '18px',
    fontWeight: 'bold' as const,
    color: '#2c3e50',
  },
  attachments: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  },
  attachment: {
    padding: '10px',
    background: '#f8f9fa',
    borderRadius: '4px',
    textDecoration: 'none',
    color: '#3498db',
    display: 'block',
  },
};

export default ExpenseView;
