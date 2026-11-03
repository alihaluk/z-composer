import { type ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
  sidebar: ReactNode;
  propertiesPanel: ReactNode;
}

// Fills its container; the standalone app gives it the whole window.
export const Layout = ({ children, sidebar, propertiesPanel }: LayoutProps) => (
  <div className="flex h-full min-h-0 w-full bg-gray-100 overflow-hidden text-gray-900">
    <aside className="w-64 shrink-0 border-r bg-white flex flex-col min-h-0">{sidebar}</aside>
    <main className="flex-1 min-w-0 overflow-auto">{children}</main>
    <aside className="w-80 shrink-0 border-l bg-white overflow-y-auto">{propertiesPanel}</aside>
  </div>
);
