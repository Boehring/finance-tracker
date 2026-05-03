import { useEffect, useState } from 'react';
import api from '../services/api';

interface DebtSummary {
  personId: string;
  personName: string;
  owes: number;
  isOwed: number;
  netDebt: number;
}

interface DebtDetail {
  debtorId: string;
  debtorName: string;
  creditorId: string;
  creditorName: string;
  amount: number;
}

const Debts = () => {
  const [summary, setSummary] = useState<DebtSummary[]>([]);
  const [details, setDetails] = useState<DebtDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const response = await api.get('/api/debts');
      setSummary(response.data.summary);
      setDetails(response.data.details);
    } catch (error) {
      console.error('Error loading debts:', error);
    } finally {
      setLoading(false);
    }
  };

  const settleDebt = async (debtorId: string, creditorId: string, amount: number) => {
    if (!confirm(`¿Confirmar que se salda la deuda de ${amount.toFixed(2)}€?`)) return;

    try {
      setSettling(true);
      await api.post('/api/debts/settle', {
        debtorId,
        creditorId,
        amount,
        date: new Date().toISOString(),
      });
      alert('Deuda saldada correctamente');
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al saldar deuda');
    } finally {
      setSettling(false);
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Deudas</h1>

      {loading ? (
        <p>Cargando...</p>
      ) : (
        <>
          <div style={styles.section}>
            <h2>Resumen</h2>
            {summary.length === 0 ? (
              <p>No hay deudas pendientes</p>
            ) : (
              <div style={styles.list}>
                {summary.map((debt) => (
                  <div key={debt.personId} style={styles.summaryItem}>
                    <strong>{debt.personName}</strong>
                    <div>
                      {debt.owes > 0 && (
                        <span style={styles.owes}>Debe: {debt.owes.toFixed(2)}€</span>
                      )}
                      {debt.isOwed > 0 && (
                        <span style={styles.isOwed}>Le deben: {debt.isOwed.toFixed(2)}€</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={styles.section}>
            <h2>Detalle de Deudas</h2>
            {details.length === 0 ? (
              <p>No hay deudas específicas</p>
            ) : (
              <div style={styles.list}>
                {details.map((debt, index) => (
                  <div key={index} style={styles.detailItem}>
                    <div>
                      <strong>{debt.debtorName}</strong> debe <strong>{debt.amount.toFixed(2)}€</strong> a <strong>{debt.creditorName}</strong>
                    </div>
                    <button
                      onClick={() => settleDebt(debt.debtorId, debt.creditorId, debt.amount)}
                      disabled={settling}
                      style={styles.settleBtn}
                    >
                      Saldar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '20px',
  },
  title: {
    color: '#2c3e50',
    marginBottom: '20px',
  },
  section: {
    background: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    marginBottom: '20px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
    marginTop: '15px',
  },
  summaryItem: {
    padding: '15px',
    background: '#f8f9fa',
    borderRadius: '4px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailItem: {
    padding: '15px',
    background: '#f8f9fa',
    borderRadius: '4px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  owes: {
    color: '#e74c3c',
    marginRight: '15px',
  },
  isOwed: {
    color: '#2ecc71',
  },
  settleBtn: {
    padding: '8px 16px',
    background: '#3498db',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
};

export default Debts;
