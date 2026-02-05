import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  propertiesPanel: React.ReactNode;
}

export const Layout = ({ children, sidebar, propertiesPanel }: LayoutProps) => {
  return (
    <div className="flex h-screen w-full bg-gray-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-white flex flex-col">
        {sidebar}
      </aside>

      {/* Main Content (Canvas) */}
      <main className="flex-1 overflow-auto p-8 flex justify-center items-start">
        {children}
      </main>

      {/* Right Sidebar (Properties) */}
      <aside className="w-80 border-l bg-white flex flex-col">
        {propertiesPanel}
      </aside>
    </div>
  );
};
