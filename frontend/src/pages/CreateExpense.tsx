import { useState, useEffect } from 'react';
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
  percentage?: number;
  amount?: number;
}

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
  const [participants, setParticipants] = useState<Participant[]>([{ personId: '' }]);

  const [people, setPeople] = useState<Person[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<Array<{ id: string; originalName: string }>>([]);

  useEffect(() => {
    loadData();
    if (isEdit) loadExpense();
  }, [id]);

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
        percentage: p.percentage || undefined,
        amount: p.amount || undefined,
      })));
      setExistingAttachments(expense.attachments || []);
    } catch (error) {
      console.error('Error loading expense:', error);
      navigate('/expenses');
    }
  };

  const addParticipant = () => {
    setParticipants([...participants, { personId: '' }]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments([...attachments, ...Array.from(e.target.files)]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

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

  const removeParticipant = (index: number) => {
    setParticipants(participants.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const expensePayload = {
        title,
        description,
        amount: parseFloat(amount),
        date,
        categoryId: categoryId || null,
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
    <div style={styles.container}>
      <h1 style={styles.title}>{isEdit ? 'Editar Gasto' : 'Nuevo Gasto'}</h1>
      {error && <div style={styles.error}>{error}</div>}
      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.field}>
          <label style={styles.label}>Título *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={styles.input}
            required
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Descripción</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ ...styles.input, minHeight: '80px' }}
          />
        </div>

        <div style={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>Importe *</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={styles.input}
              required
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Fecha *</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={styles.input}
              required
            />
          </div>
        </div>

        <div style={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>Categoría</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              style={styles.input}
            >
              <option value="">Sin categoría</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Pagado por *</label>
            <select
              value={payerId}
              onChange={(e) => setPayerId(e.target.value)}
              style={styles.input}
              required
            >
              <option value="">Seleccionar</option>
              {people.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <h3>Participantes</h3>
            <button type="button" onClick={addParticipant} style={styles.addBtn}>
              Añadir
            </button>
          </div>

          <div style={styles.splitTypeToggle}>
            <button
              type="button"
              onClick={() => setSplitType('PERCENTAGE')}
              style={splitType === 'PERCENTAGE' ? styles.activeToggle : styles.toggle}
            >
              Porcentaje
            </button>
            <button
              type="button"
              onClick={() => setSplitType('AMOUNT')}
              style={splitType === 'AMOUNT' ? styles.activeToggle : styles.toggle}
            >
              Importe
            </button>
          </div>

          {participants.map((participant, index) => (
            <div key={index} style={styles.participantRow}>
              <select
                value={participant.personId}
                onChange={(e) => updateParticipant(index, 'personId', e.target.value)}
                style={styles.input}
                required
              >
                <option value="">Seleccionar persona</option>
                {people.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {splitType === 'PERCENTAGE' ? (
                <input
                  type="number"
                  placeholder="Porcentaje"
                  value={participant.percentage || ''}
                  onChange={(e) => updateParticipant(index, 'percentage', e.target.value)}
                  style={styles.input}
                />
              ) : (
                <input
                  type="number"
                  placeholder="Importe"
                  value={participant.amount || ''}
                  onChange={(e) => updateParticipant(index, 'amount', e.target.value)}
                  style={styles.input}
                />
              )}
              {participants.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeParticipant(index)}
                  style={styles.removeBtn}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        <div style={styles.section}>
          <h3>Adjuntos</h3>
          <input
            type="file"
            multiple
            onChange={handleFileChange}
            style={styles.fileInput}
          />
          {attachments.length > 0 && (
            <div style={styles.fileList}>
              <p><strong>Archivos nuevos:</strong></p>
              {attachments.map((file, index) => (
                <div key={index} style={styles.fileItem}>
                  <span>{file.name}</span>
                  <button type="button" onClick={() => removeAttachment(index)} style={styles.removeFileBtn}>×</button>
                </div>
              ))}
            </div>
          )}
          {isEdit && existingAttachments.length > 0 && (
            <div style={styles.fileList}>
              <p><strong>Archivos existentes:</strong></p>
              {existingAttachments.map((att) => (
                <div key={att.id} style={styles.fileItem}>
                  <span>{att.originalName}</span>
                  <button type="button" onClick={() => removeExistingAttachment(att.id)} style={styles.removeFileBtn}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={styles.actions}>
          <button type="button" onClick={() => navigate('/expenses')} style={styles.cancelBtn}>
            Cancelar
          </button>
          <button type="submit" disabled={loading} style={styles.saveBtn}>
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '20px',
  },
  title: {
    color: '#2c3e50',
    marginBottom: '20px',
  },
  form: {
    background: 'white',
    padding: '30px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '5px',
    flex: 1,
  },
  label: {
    fontSize: '14px',
    color: '#555',
    fontWeight: 'bold' as const,
  },
  input: {
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
  },
  section: {
    border: '1px solid #eee',
    padding: '20px',
    borderRadius: '4px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px',
  },
  addBtn: {
    background: '#3498db',
    color: 'white',
    padding: '5px 15px',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
  },
  splitTypeToggle: {
    display: 'flex',
    gap: '10px',
    marginBottom: '15px',
  },
  toggle: {
    padding: '8px 16px',
    border: '1px solid #ddd',
    background: 'white',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  activeToggle: {
    padding: '8px 16px',
    border: '1px solid #3498db',
    background: '#3498db',
    color: 'white',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  participantRow: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr auto',
    gap: '10px',
    marginBottom: '10px',
    alignItems: 'center',
  },
  removeBtn: {
    background: '#e74c3c',
    color: 'white',
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '20px',
  },
  fileInput: {
    margin: '10px 0',
  },
  fileList: {
    marginTop: '10px',
  },
  fileItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px',
    background: '#f8f9fa',
    borderRadius: '4px',
    marginBottom: '5px',
  },
  removeFileBtn: {
    background: '#e74c3c',
    color: 'white',
    border: 'none',
    borderRadius: '50%',
    width: '25px',
    height: '25px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  cancelBtn: {
    padding: '10px 20px',
    background: '#95a5a6',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  saveBtn: {
    padding: '10px 20px',
    background: '#2ecc71',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  error: {
    background: '#e74c3c',
    color: 'white',
    padding: '10px',
    borderRadius: '4px',
    marginBottom: '20px',
  },
};

export default CreateExpense;
