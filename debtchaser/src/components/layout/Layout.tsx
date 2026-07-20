import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  header,
  footer,
  className = '',
}) => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      {header}
      <main className={`max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 ${className}`}>
        {children}
      </main>
      {footer}
    </div>
  );
};

export default Layout;
