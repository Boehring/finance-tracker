import { useEffect, useState } from 'react';
import api from '../services/api';

interface Person {
  id: string;
  name: string;
  createdAt: string;
}

const People = () => {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadPeople();
  }, []);

  const loadPeople = async () => {
    try {
      const response = await api.get('/api/people');
      setPeople(response.data);
    } catch (error) {
      console.error('Error loading people:', error);
    } finally {
      setLoading(false);
    }
  };

  const addPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      setError('');
      await api.post('/api/people', { name: newName.trim() });
      setNewName('');
      loadPeople();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al añadir persona');
    }
  };

  const deletePerson = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta persona?')) return;
    try {
      await api.delete(`/api/people/${id}`);
      loadPeople();
    } catch (error) {
      console.error('Error deleting person:', error);
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Personas</h1>

      <form onSubmit={addPerson} style={styles.form}>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nombre de la persona"
          style={styles.input}
          required
        />
        <button type="submit" style={styles.addBtn}>Añadir</button>
      </form>
      {error && <div style={styles.error}>{error}</div>}

      {loading ? (
        <p>Cargando...</p>
      ) : people.length === 0 ? (
        <p>No hay personas registradas</p>
      ) : (
        <div style={styles.list}>
          {people.map((person) => (
            <div key={person.id} style={styles.item}>
              <div style={styles.personInfo}>
                <strong>{person.name}</strong>
                <span style={styles.date}>
                  Creado: {new Date(person.createdAt).toLocaleDateString()}
                </span>
              </div>
              <button
                onClick={() => deletePerson(person.id)}
                style={styles.deleteBtn}
              >
                Eliminar
              </button>
            </div>
          ))}
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
  title: {
    color: '#2c3e50',
    marginBottom: '20px',
  },
  form: {
    display: 'flex',
    gap: '10px',
    marginBottom: '30px',
  },
  input: {
    flex: 1,
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
  },
  addBtn: {
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
  list: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  },
  item: {
    background: 'white',
    padding: '15px 20px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  personInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '5px',
  },
  date: {
    fontSize: '12px',
    color: '#95a5a6',
  },
  deleteBtn: {
    padding: '8px 16px',
    background: '#e74c3c',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
};

export default People;
