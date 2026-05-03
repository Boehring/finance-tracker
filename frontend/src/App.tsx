import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import CreateExpense from './pages/CreateExpense';
import People from './pages/People';
import Categories from './pages/Categories';
import Debts from './pages/Debts';
import ExpenseView from './pages/ExpenseView';
import Navbar from './components/Navbar';

function AppContent() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="app">
      {isAuthenticated && <Navbar />}
      <main className="main-content">
        <Routes>
          <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" />} />
          <Route path="/register" element={!isAuthenticated ? <Register /> : <Navigate to="/" />} />
          <Route path="/" element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />} />
          <Route path="/expenses" element={isAuthenticated ? <Expenses /> : <Navigate to="/login" />} />
          <Route path="/expenses/new" element={isAuthenticated ? <CreateExpense /> : <Navigate to="/login" />} />
          <Route path="/expenses/:id" element={isAuthenticated ? <ExpenseView /> : <Navigate to="/login" />} />
          <Route path="/expenses/:id/edit" element={isAuthenticated ? <CreateExpense /> : <Navigate to="/login" />} />
          <Route path="/people" element={isAuthenticated ? <People /> : <Navigate to="/login" />} />
          <Route path="/categories" element={isAuthenticated ? <Categories /> : <Navigate to="/login" />} />
          <Route path="/debts" element={isAuthenticated ? <Debts /> : <Navigate to="/login" />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
