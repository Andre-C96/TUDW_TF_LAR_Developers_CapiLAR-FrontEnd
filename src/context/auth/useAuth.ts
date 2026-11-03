import { useContext } from 'react';
import { AuthContext } from './authContext';

// Sesión del usuario desde cualquier componente dentro de <AuthProvider>
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth tiene que usarse dentro de <AuthProvider>');
  return context;
};
