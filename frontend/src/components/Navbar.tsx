import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const Navbar = () => {
  const { logout, user } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav style={styles.nav}>
      <div style={styles.container}>
        <Link to="/" style={styles.brand}>Finance Tracker</Link>
        <div style={styles.menu}>
          <Link to="/" style={isActive('/') ? styles.activeLink : styles.link}>Dashboard</Link>
          <Link to="/expenses" style={isActive('/expenses') ? styles.activeLink : styles.link}>Gastos</Link>
          <Link to="/people" style={isActive('/people') ? styles.activeLink : styles.link}>Personas</Link>
          <Link to="/categories" style={isActive('/categories') ? styles.activeLink : styles.link}>Categorías</Link>
          <Link to="/debts" style={isActive('/debts') ? styles.activeLink : styles.link}>Deudas</Link>
          <div style={styles.userSection}>
            <span style={styles.userName}>{user?.name || user?.email}</span>
            <button onClick={logout} style={styles.logoutBtn}>Salir</button>
          </div>
        </div>
      </div>
    </nav>
  );
};

const styles = {
  nav: {
    background: '#2c3e50',
    padding: '0 20px',
    color: 'white',
  },
  container: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: '1200px',
    margin: '0 auto',
    height: '60px',
  },
  brand: {
    fontSize: '20px',
    fontWeight: 'bold' as const,
    color: 'white',
  },
  menu: {
    display: 'flex',
    gap: '20px',
    alignItems: 'center',
  },
  link: {
    color: '#bdc3c7',
    textDecoration: 'none',
    padding: '5px 10px',
  },
  activeLink: {
    color: 'white',
    textDecoration: 'none',
    padding: '5px 10px',
    borderBottom: '2px solid #3498db',
  },
  userSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
  },
  userName: {
    color: '#ecf0f1',
  },
  logoutBtn: {
    background: '#e74c3c',
    color: 'white',
    padding: '8px 15px',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
  },
};

export default Navbar;
