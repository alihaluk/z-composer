import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import { Barcode, Image, Minus, QrCode, Save, Square, Trash, Type, type LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { createElement, type ToolType } from '../lib/tools';
import { useEditor, useEditorStore } from '../store/editorStore';
import { Button } from './ui/Button';
import { CatalogPanel } from './CatalogPanel';

const TOOLS: { tool: ToolType; icon: LucideIcon }[] = [
  { tool: 'text', icon: Type },
  { tool: 'box', icon: Square },
  { tool: 'line', icon: Minus },
  { tool: 'barcode', icon: Barcode },
  { tool: 'qr', icon: QrCode },
  { tool: 'image', icon: Image },
];

function ToolItem({ tool, icon: Icon }: { tool: ToolType; icon: LucideIcon }) {
  const { t } = useTranslation();
  const store = useEditorStore();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `tool-${tool}`, data: { type: 'tool', tool } });
  // Clicking (or Enter / Space) adds the element to the selected band, so tools also work without dragging.
  const add = () => {
    const { template, selection, addElement } = store.getState();
    const band = template.bands.find(b => b.id === selection?.bandId) ?? template.bands[0];
    if (!band) return;
    const offset = (band.elements.length % 5) * 2;
    addElement(band.id, createElement(tool, 2 + offset, 1 + offset, template.printer.widthMm, t('tools.defaultText')));
  };
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={add}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); add(); } }}
      title={t('toolbox.itemHint')}
      className={cn('flex items-center gap-2 p-2 bg-white border rounded shadow-sm cursor-grab hover:bg-gray-50 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500', isDragging && 'opacity-50 ring-2 ring-blue-500')}
    >
      <Icon size={15} />
      <span>{t(`tools.${tool}`)}</span>
    </div>
  );
}

export function Sidebar({ allowLocalTemplates = true, catalogEditable = true }: { allowLocalTemplates?: boolean; catalogEditable?: boolean }) {
  const { t } = useTranslation();
  const store = useEditorStore();
  const templateName = useEditor(s => s.templateName);
  const savedTemplates = useEditor(s => s.savedTemplates);
  const [newName, setNewName] = useState('');
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const s = store.getState();

  const saveAsNew = () => {
    const name = newName.trim();
    if (!name) return;
    const error = s.saveTemplate(name);
    setMessage(error ? { kind: 'error', text: t('files.saveFailed', { reason: error }) } : { kind: 'info', text: t('files.saved', { name }) });
    if (!error) setNewName('');
  };

  return (
    <div className="p-4 flex flex-col gap-5 h-full overflow-y-auto">
      <section>
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">{t('toolbox.title')}</h3>
        <div className="grid grid-cols-2 gap-2">
          {TOOLS.map(tool => <ToolItem key={tool.tool} {...tool} />)}
        </div>
        <p className="text-[10px] text-gray-500 mt-2">{t('toolbox.hint')}</p>
      </section>

      <CatalogPanel editable={catalogEditable} />

      {allowLocalTemplates && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase">{t('files.savedTemplates')}</h3>
          {templateName && savedTemplates.some(x => x.name === templateName) && (
            <Button size="sm" className="w-full h-7 text-xs bg-blue-600 hover:bg-blue-700" onClick={() => {
              const error = s.saveTemplate(templateName);
              setMessage(error ? { kind: 'error', text: t('files.saveFailed', { reason: error }) } : { kind: 'info', text: t('files.saved', { name: templateName }) });
            }}>
              {t('files.update', { name: templateName })}
            </Button>
          )}
          <div className="flex gap-2">
            <input className="flex-1 min-w-0 text-xs border rounded px-2 h-8" placeholder={t('files.newName')} value={newName}
              onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveAsNew(); }} aria-label={t('files.newName')} />
            <Button size="sm" variant="outline" className="h-8" onClick={saveAsNew} title={t('files.saveNew')} aria-label={t('files.saveNew')}><Save size={14} /></Button>
          </div>
          <ul className="max-h-32 overflow-y-auto space-y-1">
            {savedTemplates.length === 0 && <li className="text-[10px] text-gray-500">{t('files.none')}</li>}
            {savedTemplates.map(saved => (
              <li key={saved.name} className={cn('flex items-center text-xs rounded group border', templateName === saved.name ? 'bg-blue-50 border-blue-100' : 'bg-gray-50 border-transparent')}>
                <button type="button" className="flex-1 truncate text-left p-1 hover:text-blue-600" onClick={() => s.loadTemplate(saved.name)}>{saved.name}</button>
                <button type="button" aria-label={t('files.delete', { name: saved.name })} className="p-1 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 focus:opacity-100"
                  onClick={() => { if (window.confirm(t('files.confirmDelete', { name: saved.name }))) s.deleteTemplate(saved.name); }}>
                  <Trash size={12} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {message && <p className={cn('text-[11px]', message.kind === 'error' ? 'text-red-600' : 'text-green-700')} role="status">{message.text}</p>}
    </div>
  );
}
