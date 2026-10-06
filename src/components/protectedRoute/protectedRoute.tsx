import { Navigate, Outlet } from 'react-router-dom';
import type { Rol } from '../../api/auth';
import { useAuth } from '../../context/auth/useAuth';
import { Loader } from '../loader/loader';

interface ProtectedRouteProps {
  // Roles que pueden ver las rutas hijas; si no se pasa, alcanza con tener sesión
  roles?: Rol[];
}

// Envuelve rutas que requieren sesión. 
export const ProtectedRoute = ({ roles }: ProtectedRouteProps) => {
  const { isAuthenticated, isCheckingSession, hasRole } = useAuth();

  // Al recargar, esperar a que el backend confirme la sesión guardada antes de decidir
  if (isCheckingSession) return <Loader size="lg" fullScreen />;


  // Sin sesión: a la home
  if (!isAuthenticated) return <Navigate to="/" replace />;

  // Con sesión pero sin el rol pedido: a la home
  if (roles && !hasRole(...roles)) return <Navigate to="/" replace />;

  return <Outlet />;
};
