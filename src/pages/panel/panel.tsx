import { Link } from 'react-router-dom';
import { Card } from '../../components/card/card';
import { GradientIcon } from '../../components/gradientIcon/gradientIcon';
import { Title } from '../../components/title/title';
import { useAuth } from '../../context/auth/useAuth';
import { panelSections } from '../../layouts/panelLayout/panelSections';

// Inicio de profesional y admin: accesos a sus espacios de trabajo (los mismos del menú lateral)
export const Panel = () => {
  const { hasRole } = useAuth();
  const visible = panelSections.filter((section) => hasRole(...section.roles));

  return (
    <section className="mx-auto flex max-w-5xl flex-col items-center gap-10 px-6 pt-32 pb-16">
      <div className="flex flex-col items-center gap-2 text-center">
        <Title>Tu espacio de trabajo</Title>
        <p className="font-inter text-capilar-grey">Elegí a dónde querés ir.</p>
      </div>

      <div className="flex w-full flex-wrap justify-center gap-8">
        {visible.map((section) => (
          <Link
            key={section.to}
            to={section.to}
            className="w-full rounded-[6px] transition duration-300 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-capilar-violet sm:w-64"
          >
            <Card icon={<GradientIcon id={`icon-${section.to.split('/').pop()}`}>{section.icon}</GradientIcon>} title={section.title} className="h-full">
              {section.text}
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
};
