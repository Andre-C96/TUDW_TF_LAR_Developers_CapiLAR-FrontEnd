import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/button/button';
import { Title } from '../../components/title/title';

// Página para cualquier ruta que no existe
export const NotFound = () => {
  const navigate = useNavigate();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <img src="/capiLAR_logo1.png" alt="CapiLAR" className="h-10 w-auto" />
      <p className="bg-capilar-gradient bg-clip-text font-inter text-7xl font-bold text-transparent">404</p>
      <div className="flex flex-col gap-2">
        <Title>Página no encontrada</Title>
        <p className="font-inter text-capilar-grey">La página que buscás no existe o fue movida.</p>
      </div>
      <Button onClick={() => navigate('/')}>VOLVER AL INICIO</Button>
    </main>
  );
};
