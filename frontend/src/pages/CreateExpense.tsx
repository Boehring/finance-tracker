import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';

interface Person {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
  color?: string;
}

interface Participant {
  personId: string;
  percentage?: string;
  amount?: string;
}

const evaluateMath = (expr: string): number | null => {
  const sanitized = expr.trim();
  if (!sanitized) return null;
  if (!/^[\d+\-*/().\s]+$/.test(sanitized)) return null;
  try {
    // eslint-disable-next-line no-new-func
    const result = new Function('return ' + sanitized)();
    return typeof result === 'number' && isFinite(result) ? result : null;
  } catch {
    return null;
  }
};

const inputClass = 'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-white';

const CreateExpense = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [categoryId, setCategoryId] = useState('');
  const [payerId, setPayerId] = useState('');
  const [splitType, setSplitType] = useState<'PERCENTAGE' | 'AMOUNT'>('PERCENTAGE');
  const [participants, setParticipants] = useState<Participant[]>([]);

  const [people, setPeople] = useState<Person[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const errorRef = useRef<HTMLDivElement>(null);
  const [existingAttachments, setExistingAttachments] = useState<Array<{ id: string; originalName: string }>>([]);

  useEffect(() => {
    loadData();
    if (isEdit) loadExpense();
  }, [id]);

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [error]);

  const loadData = async () => {
    try {
      const [peopleRes, categoriesRes] = await Promise.all([
        api.get('/api/people'),
        api.get('/api/categories'),
      ]);
      setPeople(peopleRes.data);
      setCategories(categoriesRes.data);
      if (peopleRes.data.length > 0 && !payerId) {
        setPayerId(peopleRes.data[0].id);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const loadExpense = async () => {
    try {
      const response = await api.get(`/api/expenses/${id}`);
      const expense = response.data;
      setTitle(expense.title);
      setDescription(expense.description || '');
      setAmount(expense.amount.toString());
      setDate(new Date(expense.date).toISOString().split('T')[0]);
      setCategoryId(expense.categoryId || '');
      setPayerId(expense.payerId);
      setSplitType(expense.splitType);
      setParticipants(expense.participants.map((p: any) => ({
        personId: p.personId,
        percentage: p.percentage != null ? p.percentage.toString() : undefined,
        amount: p.amount != null ? p.amount.toString() : undefined,
      })));
      setExistingAttachments(expense.attachments || []);
    } catch (error) {
      console.error('Error loading expense:', error);
      navigate('/expenses');
    }
  };

  const addParticipant = () => setParticipants([...participants, { personId: '' }]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setAttachments([...attachments, ...Array.from(e.target.files)]);
  };

  const removeAttachment = (index: number) => setAttachments(attachments.filter((_, i) => i !== index));

  const removeExistingAttachment = async (attachmentId: string) => {
    if (!confirm('¿Eliminar este adjunto?')) return;
    try {
      await api.delete(`/api/expenses/${id}/attachments/${attachmentId}`);
      setExistingAttachments(existingAttachments.filter(a => a.id !== attachmentId));
    } catch (error) {
      console.error('Error removing attachment:', error);
    }
  };

  const updateParticipant = (index: number, field: string, value: string) => {
    const updated = [...participants];
    updated[index] = { ...updated[index], [field]: value };
    setParticipants(updated);
  };

  const removeParticipant = (index: number) => setParticipants(participants.filter((_, i) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!categoryId) {
      setError('Debes seleccionar una categoría.');
      return;
    }

    const filledParticipants = participants.filter(p => p.personId);
    if (participants.length > 0 && participants.some(p => !p.personId)) {
      setError('Selecciona una persona para cada participante o elimina las filas vacías.');
      return;
    }
    if (filledParticipants.length > 0) {
      if (splitType === 'PERCENTAGE') {
        const total = filledParticipants.reduce((sum, p) => sum + parseFloat(p.percentage?.toString() || '0'), 0);
        if (Math.abs(total - 100) > 0.01) {
          setError(`Los porcentajes deben sumar 100%. Suma actual: ${total.toFixed(2)}%.`);
          return;
        }
      } else {
        const total = filledParticipants.reduce((sum, p) => sum + parseFloat(p.amount?.toString() || '0'), 0);
        const expenseAmount = parseFloat(amount);
        if (!isNaN(expenseAmount) && Math.abs(total - expenseAmount) > 0.01) {
          setError(`Los importes de los participantes deben sumar ${expenseAmount.toFixed(2)}€. Suma actual: ${total.toFixed(2)}€.`);
          return;
        }
      }
    }

    setLoading(true);

    try {
      const expensePayload = {
        title,
        description,
        amount: parseFloat(amount),
        date,
        categoryId,
        payerId,
        splitType,
        participants: participants.filter(p => p.personId).map(p => ({
          personId: p.personId,
          percentage: splitType === 'PERCENTAGE' ? parseFloat(p.percentage?.toString() || '0') : undefined,
          amount: splitType === 'AMOUNT' ? parseFloat(p.amount?.toString() || '0') : undefined,
        })),
      };

      let expenseId = id;

      if (isEdit) {
        await api.put(`/api/expenses/${id}`, expensePayload);
      } else {
        const response = await api.post('/api/expenses', expensePayload);
        expenseId = response.data.id;
      }

      if (attachments.length > 0 && expenseId) {
        for (const file of attachments) {
          const formData = new FormData();
          formData.append('file', file);
          await api.post(`/api/expenses/${expenseId}/attachments`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        }
      }

      navigate('/expenses');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al guardar el gasto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">
        {isEdit ? 'Editar Gasto' : 'Nuevo Gasto'}
      </h1>

      {error && (
        <div ref={errorRef} className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-4 py-3 mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Información general</p>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Título *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} required />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Descripción</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${inputClass} min-h-[80px] resize-none`}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Importe *</label>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onBlur={() => {
                  const result = evaluateMath(amount);
                  if (result !== null) setAmount(result.toFixed(2));
                }}
                className={inputClass}
                placeholder="0.00 o 25+15"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Fecha *</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Categoría *</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass} required>
                <option value="">Seleccionar categoría</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Pagado por *</label>
              <select value={payerId} onChange={(e) => setPayerId(e.target.value)} className={inputClass} required>
                <option value="">Seleccionar</option>
                {people.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Participantes</p>
            <button
              type="button"
              onClick={addParticipant}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
            >
              + Añadir
            </button>
          </div>

          <div className="flex items-center gap-2">
            {(['PERCENTAGE', 'AMOUNT'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSplitType(t)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  splitType === t ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {t === 'PERCENTAGE' ? 'Porcentaje' : 'Importe'}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {participants.map((participant, index) => (
              <div key={index} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
                <select
                  value={participant.personId}
                  onChange={(e) => updateParticipant(index, 'personId', e.target.value)}
                  className={inputClass}
                  required
                >
                  <option value="">Seleccionar persona</option>
                  {people.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder={splitType === 'PERCENTAGE' ? '%' : '€'}
                  value={splitType === 'PERCENTAGE' ? (participant.percentage || '') : (participant.amount || '')}
                  onChange={(e) => updateParticipant(index, splitType === 'PERCENTAGE' ? 'percentage' : 'amount', e.target.value)}
                  onBlur={() => {
                    const field = splitType === 'PERCENTAGE' ? 'percentage' : 'amount';
                    const val = splitType === 'PERCENTAGE' ? participant.percentage : participant.amount;
                    const result = evaluateMath(val || '');
                    if (result !== null) updateParticipant(index, field, result.toFixed(2));
                  }}
                  className="w-24 border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
                {participants.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeParticipant(index)}
                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors text-lg"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Adjuntos</p>
          <input type="file" multiple onChange={handleFileChange} className="text-sm text-slate-600" />

          {attachments.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-slate-500">Archivos nuevos</p>
              {attachments.map((file, index) => (
                <div key={index} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg">
                  <span className="text-sm text-slate-700">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(index)}
                    className="text-slate-400 hover:text-rose-500 text-lg leading-none transition-colors"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {isEdit && existingAttachments.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-slate-500">Archivos existentes</p>
              {existingAttachments.map((att) => (
                <div key={att.id} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg">
                  <span className="text-sm text-slate-700">{att.originalName}</span>
                  <button
                    type="button"
                    onClick={() => removeExistingAttachment(att.id)}
                    className="text-slate-400 hover:text-rose-500 text-lg leading-none transition-colors"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/expenses')}
            className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg transition-colors"
          >
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateExpense;
