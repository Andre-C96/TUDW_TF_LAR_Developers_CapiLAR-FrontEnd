import type { HTMLAttributes, ReactNode } from 'react';

interface TitleProps extends HTMLAttributes<HTMLHeadingElement> {
  variant?: 'negro' | 'gris';
  // Nivel semántico del encabezado (h1 por defecto)
  as?: 'h1' | 'h2' | 'h3' | 'h4';
  children: ReactNode;
}

const variantClasses = {
  negro: 'text-black',
  gris: 'text-capilar-grey',
};

export const Title = ({
  variant = 'negro',
  as: Tag = 'h1',
  children,
  className = '',
  ...props
}: TitleProps) => {
  return (
    <Tag
      className={`font-inter font-semibold text-2xl md:text-3xl ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </Tag>
  );
};
