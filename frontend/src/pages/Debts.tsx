import { useEffect, useState } from 'react';
import api from '../services/api';
import { logger } from '../utils/logger';

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

interface MonthlyDebtGroup {
  month: string;
  debts: DebtDetail[];
}

const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const formatMonth = (yearMonth: string) => {
  const [year, month] = yearMonth.split('-');
  return `${MONTHS_ES[parseInt(month, 10) - 1]} ${year}`;
};

const Debts = () => {
  const [summary, setSummary] = useState<DebtSummary[]>([]);
  const [details, setDetails] = useState<DebtDetail[]>([]);
  const [monthlyDetails, setMonthlyDetails] = useState<MonthlyDebtGroup[]>([]);
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
      setMonthlyDetails(response.data.monthlyDetails || []);
    } catch (error) {
      logger.error('Error loading debts', { error });
    } finally {
      setLoading(false);
    }
  };

  const settleDebt = async (debtorId: string, creditorId: string, amount: number) => {
    if (!confirm(`¿Confirmar que se salda la deuda de ${Number(amount).toFixed(2)}€?`)) return;
    try {
      setSettling(true);
      await api.post('/api/debts/settle', {
        debtorId,
        creditorId,
        amount,
        date: new Date().toISOString(),
      });
      logger.info('Debt settled', { debtorId, creditorId, amount });
      alert('Deuda saldada correctamente');
      loadData();
    } catch (error: any) {
      const msg = error.response?.data?.error || 'Error al saldar deuda';
      logger.error('Error settling debt', { debtorId, creditorId, amount, error: msg });
      alert(msg);
    } finally {
      setSettling(false);
    }
  };

  const sortedSummary = [...summary].sort((a, b) => b.netDebt - a.netDebt);

  const detailsByDebtor = details.reduce<
    Record<string, { debtorName: string; debts: DebtDetail[] }>
  >((acc, debt) => {
    if (!acc[debt.debtorId]) {
      acc[debt.debtorId] = { debtorName: debt.debtorName, debts: [] };
    }
    acc[debt.debtorId].debts.push(debt);
    return acc;
  }, {});

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
            {sortedSummary.length === 0 ? (
              <div className="px-5 py-8 text-center text-slate-400 text-sm">No hay deudas pendientes</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {sortedSummary.map((person) => {
                  const isDebtor = person.netDebt > 0.005;
                  const isCreditor = person.netDebt < -0.005;
                  return (
                    <div key={person.personId} className="flex items-center justify-between px-5 py-3.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${
                          isDebtor ? 'bg-rose-100 text-rose-700'
                          : isCreditor ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                        }`}>
                          {person.personName.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-slate-800 truncate">{person.personName}</span>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 ml-3 shrink-0">
                        {isDebtor ? (
                          <span className="text-sm font-semibold px-3 py-1 bg-rose-50 text-rose-600 rounded-full border border-rose-200">
                            Debe {Number(person.netDebt).toFixed(2)}€
                          </span>
                        ) : isCreditor ? (
                          <span className="text-sm font-semibold px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-200">
                            Le deben {Number(-person.netDebt).toFixed(2)}€
                          </span>
                        ) : (
                          <span className="text-sm font-medium px-3 py-1 bg-slate-50 text-slate-400 rounded-full border border-slate-200">
                            Saldado
                          </span>
                        )}
                        {person.owes > 0.005 && person.isOwed > 0.005 && (
                          <span className="text-xs text-slate-400">
                            Debe {Number(person.owes).toFixed(2)}€ · Le deben {Number(person.isOwed).toFixed(2)}€
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
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
                {Object.entries(detailsByDebtor).map(([debtorId, group]) => {
                  const groupTotal = group.debts.reduce((sum, d) => sum + d.amount, 0);
                  return (
                    <div key={debtorId} className="px-5 py-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-sm font-semibold shrink-0">
                            {group.debtorName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="text-sm font-semibold text-rose-700">{group.debtorName}</span>
                            <span className="text-sm text-slate-500"> le debe a:</span>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-rose-600">
                          {Number(groupTotal).toFixed(2)}€ total
                        </span>
                      </div>
                      <div className="space-y-2 pl-10">
                        {group.debts.map((debt, i) => (
                          <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-semibold shrink-0">
                                {debt.creditorName.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5 text-rose-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                                </svg>
                                <span className="text-sm font-medium text-emerald-700">{debt.creditorName}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-base font-bold text-slate-800">
                                {Number(debt.amount).toFixed(2)}€
                              </span>
                              <button
                                onClick={() => settleDebt(debt.debtorId, debt.creditorId, debt.amount)}
                                disabled={settling}
                                className="px-3 py-1.5 text-xs font-semibold border border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                              >
                                Saldar
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-medium text-slate-900 text-sm">Desglose Mensual</h2>
            </div>
            {monthlyDetails.length === 0 ? (
              <div className="px-5 py-8 text-center text-slate-400 text-sm">No hay gastos registrados</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {monthlyDetails.map(({ month, debts: monthDebts }) => {
                  const monthDebtsByDebtor = monthDebts.reduce<
                    Record<string, { debtorName: string; debts: DebtDetail[] }>
                  >((acc, debt) => {
                    if (!acc[debt.debtorId]) acc[debt.debtorId] = { debtorName: debt.debtorName, debts: [] };
                    acc[debt.debtorId].debts.push(debt);
                    return acc;
                  }, {});

                  return (
                    <div key={month} className="px-5 py-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm font-semibold text-slate-700">{formatMonth(month)}</span>
                        {monthDebts.length === 0 && (
                          <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full">
                            Saldadas
                          </span>
                        )}
                      </div>
                      {monthDebts.length > 0 && (
                        <div className="space-y-3">
                          {Object.entries(monthDebtsByDebtor).map(([debtorId, group]) => {
                            const groupTotal = group.debts.reduce((sum, d) => sum + d.amount, 0);
                            return (
                              <div key={debtorId}>
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-xs font-semibold shrink-0">
                                      {group.debtorName.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="text-sm font-semibold text-rose-700">{group.debtorName}</span>
                                    <span className="text-xs text-slate-500">le debe a:</span>
                                  </div>
                                  <span className="text-sm font-bold text-rose-600">{Number(groupTotal).toFixed(2)}€</span>
                                </div>
                                <div className="space-y-1.5 pl-9">
                                  {group.debts.map((debt, i) => (
                                    <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                                      <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-semibold shrink-0">
                                          {debt.creditorName.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="text-sm font-medium text-emerald-700">{debt.creditorName}</span>
                                      </div>
                                      <span className="text-sm font-bold text-slate-800">{Number(debt.amount).toFixed(2)}€</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Debts;
