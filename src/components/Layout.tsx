import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
  sidebar: ReactNode;
  propertiesPanel: ReactNode;
}

const toggleClass = 'absolute top-2 z-40 p-1 rounded-md border bg-white shadow text-gray-600 hover:bg-gray-100';

// Fills its container; the standalone app gives it the whole window. Both side panels can be
// hidden to give the canvas room on narrow screens.
export const Layout = ({ children, sidebar, propertiesPanel }: LayoutProps) => {
  const { t } = useTranslation();
  const [left, setLeft] = useState(true);
  const [right, setRight] = useState(true);
  return (
    <div className="flex h-full min-h-0 w-full bg-gray-100 overflow-hidden text-gray-900">
      {left && <aside className="w-64 shrink-0 border-r bg-white flex flex-col min-h-0">{sidebar}</aside>}
      <div className="relative flex-1 min-w-0 flex">
        <button type="button" className={`${toggleClass} left-2`} aria-expanded={left}
          aria-label={t(left ? 'panels.hideTools' : 'panels.showTools')} title={t(left ? 'panels.hideTools' : 'panels.showTools')} onClick={() => setLeft(v => !v)}>
          {left ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
        </button>
        <main className="flex-1 min-w-0 overflow-auto">{children}</main>
        <button type="button" className={`${toggleClass} right-2`} aria-expanded={right}
          aria-label={t(right ? 'panels.hideProperties' : 'panels.showProperties')} title={t(right ? 'panels.hideProperties' : 'panels.showProperties')} onClick={() => setRight(v => !v)}>
          {right ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
        </button>
      </div>
      {right && <aside className="w-80 shrink-0 border-l bg-white overflow-y-auto">{propertiesPanel}</aside>}
    </div>
  );
};
