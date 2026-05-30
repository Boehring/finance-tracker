import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const Navbar = () => {
  const { logout, user } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const linkClass = (path: string) =>
    isActive(path)
      ? 'text-indigo-600 font-medium text-sm'
      : 'text-slate-500 hover:text-slate-800 text-sm transition-colors';

  return (
    <nav className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="font-semibold text-indigo-600 text-base tracking-tight">
          Finance Tracker
        </Link>

        <div className="flex items-center gap-6">
          <Link to="/" className={linkClass('/')}>Dashboard</Link>
          <Link to="/expenses" className={linkClass('/expenses')}>Gastos</Link>
          <Link to="/people" className={linkClass('/people')}>Personas</Link>
          <Link to="/categories" className={linkClass('/categories')}>Categorías</Link>
          <Link to="/debts" className={linkClass('/debts')}>Deudas</Link>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">{user?.name || user?.email}</span>
          <button
            onClick={logout}
            className="text-sm text-slate-500 hover:text-slate-800 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-100"
          >
            Salir
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
