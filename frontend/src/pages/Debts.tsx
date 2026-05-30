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
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Deudas</h1>

      {loading ? (
        <div className="text-center text-slate-400 text-sm py-12">Cargando...</div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-medium text-slate-900 text-sm">Resumen</h2>
            </div>
            {summary.length === 0 ? (
              <div className="px-5 py-8 text-center text-slate-400 text-sm">No hay deudas pendientes</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {summary.map((debt) => (
                  <div key={debt.personId} className="flex items-center justify-between px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-sm font-semibold shrink-0">
                        {debt.personName.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-slate-800">{debt.personName}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {debt.owes > 0 && (
                        <span className="text-sm font-medium px-3 py-1 bg-rose-50 text-rose-600 rounded-full border border-rose-100">
                          Debe {debt.owes.toFixed(2)}€
                        </span>
                      )}
                      {debt.isOwed > 0 && (
                        <span className="text-sm font-medium px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
                          Le deben {debt.isOwed.toFixed(2)}€
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-medium text-slate-900 text-sm">Detalle de Deudas</h2>
            </div>
            {details.length === 0 ? (
              <div className="px-5 py-8 text-center text-slate-400 text-sm">No hay deudas específicas</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {details.map((debt, index) => (
                  <div key={index} className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <span className="font-medium text-slate-900">{debt.debtorName}</span>
                      <span className="text-slate-400">→</span>
                      <span className="font-semibold text-rose-600">{debt.amount.toFixed(2)}€</span>
                      <span className="text-slate-400">→</span>
                      <span className="font-medium text-slate-900">{debt.creditorName}</span>
                    </div>
                    <button
                      onClick={() => settleDebt(debt.debtorId, debt.creditorId, debt.amount)}
                      disabled={settling}
                      className="px-3 py-1.5 text-sm font-medium border border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      Saldar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Debts;
