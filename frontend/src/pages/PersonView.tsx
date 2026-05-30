import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Pencil, X, Upload } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import api from '../services/api';
import { logger } from '../utils/logger';
import dayjs from 'dayjs';

interface Person {
  id: string;
  name: string;
  lastName?: string;
  avatarUrl?: string;
  identifier?: string;
  createdAt: string;
}

interface ChartBucket {
  label: string;
  totalPaid: number;
  owedToThem: number;
  paidForThem: number;
}

const PERIOD_LABELS: Record<string, string> = {
  day: 'Día',
  week: 'Semana',
  month: 'Mes',
  year: 'Año',
  all: 'Todo',
};

const PersonView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [person, setPerson] = useState<Person | null>(null);
  const [chartData, setChartData] = useState<ChartBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [period, setPeriod] = useState('week');
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editAvatar, setEditAvatar] = useState<File | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadPerson();
  }, [id]);

  useEffect(() => {
    if (person && searchParams.get('edit') === '1') openEdit();
  }, [person]);

  useEffect(() => {
    if (person) loadChart();
  }, [person, period, date]);

  const loadPerson = async () => {
    try {
      const res = await api.get(`/api/people/${id}`);
      setPerson(res.data);
    } catch (error) {
      logger.error('Error loading person', { personId: id, error });
      navigate('/people');
    } finally {
      setLoading(false);
    }
  };

  const loadChart = async () => {
    try {
      setChartLoading(true);
      const params: any = { period };
      if (period !== 'all') params.date = date;
      const res = await api.get(`/api/people/${id}/chart`, { params });
      setChartData(res.data);
    } catch (error) {
      logger.error('Error loading person chart', { personId: id, error });
    } finally {
      setChartLoading(false);
    }
  };

  const changeDate = (dir: number) => {
    setDate(dayjs(date).add(dir, period as any).format('YYYY-MM-DD'));
  };

  const openEdit = () => {
    if (!person) return;
    setEditName(person.name);
    setEditLastName(person.lastName || '');
    setEditAvatar(null);
    setEditAvatarPreview(null);
    setEditOpen(true);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditAvatar(file);
    setEditAvatarPreview(URL.createObjectURL(file));
  };

  const saveEdit = async () => {
    if (!editName.trim()) return;
    try {
      setEditSaving(true);
      const formData = new FormData();
      formData.append('name', editName.trim());
      formData.append('lastName', editLastName.trim());
      if (editAvatar) formData.append('avatar', editAvatar);

      const res = await api.put(`/api/people/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPerson(res.data);
      setEditOpen(false);
      logger.info('Person updated', { personId: id });
    } catch (error) {
      logger.error('Error updating person', { personId: id, error });
    } finally {
      setEditSaving(false);
    }
  };

  const avatarSrc = editAvatarPreview || (person?.avatarUrl ? person.avatarUrl : null);
  const initials = person ? (person.name.charAt(0) + (person.lastName?.charAt(0) || '')).toUpperCase() : '';

  const hasData = chartData.some((b) => b.totalPaid > 0 || b.owedToThem > 0 || b.paidForThem > 0);

  if (loading) {
    return <div className="text-center text-slate-400 text-sm py-16">Cargando...</div>;
  }

  if (!person) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate('/people')} className="text-slate-400 hover:text-slate-600 transition-colors text-sm">
          ← Personas
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xl font-bold shrink-0 overflow-hidden">
              {person.avatarUrl ? (
                <img src={person.avatarUrl} alt={person.name} className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">
                {person.name}{person.lastName ? ` ${person.lastName}` : ''}
              </h1>
              {person.identifier && (
                <p className="text-sm text-slate-500">@{person.identifier}</p>
              )}
              <p className="text-xs text-slate-400 mt-0.5">
                Añadido el {new Date(person.createdAt).toLocaleDateString('es-ES')}
              </p>
            </div>
          </div>
          <button
            onClick={openEdit}
            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            title="Editar"
          >
            <Pencil size={18} />
          </button>
        </div>
      </div>

      {/* Period selector */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          {Object.entries(PERIOD_LABELS).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setPeriod(v)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                period === v ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {period !== 'all' && (
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
        )}
      </div>

      {/* Chart */}
      <div className={`bg-white border border-slate-200 rounded-xl p-4 transition-opacity ${chartLoading ? 'opacity-50' : ''}`}>
        {hasData ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `${v}€`}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip
                formatter={(value) => [`${Number(value).toFixed(2)}€`]}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="totalPaid" name="Total pagado" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} />
              <Bar dataKey="owedToThem" name="Le deben" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
              <Bar dataKey="paidForThem" name="Han pagado por él" stackId="a" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[260px] flex items-center justify-center text-slate-400 text-sm">
            Sin gastos en este período
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setEditOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-900">Editar persona</h2>
              <button onClick={() => setEditOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            {/* Avatar picker */}
            <div className="flex justify-center mb-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="relative w-20 h-20 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-2xl font-bold overflow-hidden group hover:ring-2 hover:ring-indigo-400 transition-all"
              >
                {avatarSrc ? (
                  <img src={avatarSrc} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  (editName.charAt(0) + editLastName.charAt(0)).toUpperCase() || initials
                )}
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-full">
                  <Upload size={20} className="text-white" />
                </div>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Nombre</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Apellidos</label>
                <input
                  type="text"
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => setEditOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveEdit}
                disabled={editSaving || !editName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {editSaving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonView;
