import { useEffect, useState } from 'react';
import api from '../services/api';

interface Category {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  createdAt: string;
}

const Categories = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3498db');
  const [error, setError] = useState('');

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const response = await api.get('/api/categories');
      setCategories(response.data);
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      setError('');
      await api.post('/api/categories', { name: newName.trim(), color: newColor });
      setNewName('');
      setNewColor('#3498db');
      loadCategories();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al añadir categoría');
    }
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta categoría?')) return;
    try {
      await api.delete(`/api/categories/${id}`);
      loadCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Categorías</h1>

      <form onSubmit={addCategory} style={styles.form}>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nombre de la categoría"
          style={styles.input}
          required
        />
        <input
          type="color"
          value={newColor}
          onChange={(e) => setNewColor(e.target.value)}
          style={styles.colorInput}
        />
        <button type="submit" style={styles.addBtn}>Añadir</button>
      </form>
      {error && <div style={styles.error}>{error}</div>}

      {loading ? (
        <p>Cargando...</p>
      ) : categories.length === 0 ? (
        <p>No hay categorías registradas</p>
      ) : (
        <div style={styles.list}>
          {categories.map((cat) => (
            <div key={cat.id} style={styles.item}>
              <div style={styles.categoryInfo}>
                <span style={{ ...styles.colorDot, background: cat.color || '#95a5a6' }}></span>
                <strong>{cat.name}</strong>
                <span style={styles.date}>
                  Creado: {new Date(cat.createdAt).toLocaleDateString()}
                </span>
              </div>
              <button
                onClick={() => deleteCategory(cat.id)}
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
    alignItems: 'center',
  },
  input: {
    flex: 1,
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
  },
  colorInput: {
    width: '50px',
    height: '40px',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
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
  categoryInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  colorDot: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    display: 'inline-block',
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

export default Categories;
