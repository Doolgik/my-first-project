import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './store/auth';
import { setAuthFailureHandler } from './lib/api';
import Login from './pages/Login';
import Register from './pages/Register';
import ChatLayout from './pages/ChatLayout';

function Protected({ children }: { children: React.ReactNode }) {
  const { user, initializing } = useAuth();
  if (initializing) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-brand-500" />
      </div>
    );
  }
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, initializing } = useAuth();
  if (initializing) return null;
  return user ? <Navigate to="/" replace /> : <>{children}</>;
}

export default function App() {
  const { bootstrap, setUser } = useAuth();

  useEffect(() => {
    setAuthFailureHandler(() => setUser(null));
    bootstrap();
  }, [bootstrap, setUser]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
        <Route path="/" element={<Protected><ChatLayout /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
