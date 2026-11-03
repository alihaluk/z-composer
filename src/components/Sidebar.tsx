import { useState, type ChangeEvent } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { saveAs } from 'file-saver';
import { useTranslation } from 'react-i18next';
import { Barcode, FilePlus, Image, Minus, QrCode, Redo2, Save, Square, Trash, Type, Undo2, type LucideIcon } from 'lucide-react';
import { useStore } from 'zustand';
import { cn } from '../lib/utils';
import { invoicePreset } from '../lib/presets';
import { emptyTemplate, parseTemplate } from '../lib/templateIO';
import { type ToolType } from '../lib/tools';
import { useEditor, useEditorStore } from '../store/editorStore';
import { Button } from './ui/Button';
import { PreviewModal } from './PreviewModal';
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
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `tool-${tool}`, data: { type: 'tool', tool } });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn('flex items-center gap-2 p-2 bg-white border rounded shadow-sm cursor-grab hover:bg-gray-50 text-sm', isDragging && 'opacity-50 ring-2 ring-blue-500')}
    >
      <Icon size={15} />
      <span>{t(`tools.${tool}`)}</span>
    </div>
  );
}

export function Sidebar({ allowLocalTemplates = true }: { allowLocalTemplates?: boolean }) {
  const { t, i18n } = useTranslation();
  const store = useEditorStore();
  const templateName = useEditor(s => s.templateName);
  const savedTemplates = useEditor(s => s.savedTemplates);
  const canUndo = useStore(store.temporal, s => s.pastStates.length > 0);
  const canRedo = useStore(store.temporal, s => s.futureStates.length > 0);
  const [newName, setNewName] = useState('');
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const s = store.getState();

  const exportFile = async () => {
    const { template, templateName } = store.getState();
    const json = JSON.stringify(template, null, 2);
    const fileName = `${templateName || `z-composer-${new Date().toISOString().slice(0, 10)}`}.json`;
    const picker = window as Window & { showSaveFilePicker?: (options: object) => Promise<FileSystemFileHandle> };
    if (picker.showSaveFilePicker) {
      try {
        const handle = await picker.showSaveFilePicker({ suggestedName: fileName, types: [{ description: 'Z-Composer template', accept: { 'application/json': ['.json'] } }] });
        const writable = await handle.createWritable();
        await writable.write(json);
        await writable.close();
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    }
    saveAs(new Blob([json], { type: 'application/json;charset=utf-8' }), fileName);
  };

  const importFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    file.text().then(content => {
      try {
        s.setTemplate(parseTemplate(JSON.parse(content)), file.name.replace(/\.json$/i, ''));
        setMessage(null);
      } catch (e) {
        setMessage({ kind: 'error', text: t('files.importFailed', { reason: e instanceof Error ? e.message : String(e) }) });
      }
    });
  };

  const saveAsNew = () => {
    const name = newName.trim();
    if (!name) return;
    const error = s.saveTemplate(name);
    setMessage(error ? { kind: 'error', text: t('files.saveFailed', { reason: error }) } : { kind: 'info', text: t('files.saved', { name }) });
    if (!error) setNewName('');
  };

  return (
    <div className="p-4 flex flex-col gap-5 h-full overflow-y-auto">
      <div className="flex justify-between items-center">
        <h2 className="text-base font-bold text-gray-800">Z-Composer</h2>
        <div className="flex items-center gap-1">
          <div className="flex bg-gray-100 rounded p-0.5 gap-0.5" role="group" aria-label="Language">
            {['tr', 'en'].map(lng => (
              <button key={lng} type="button" onClick={() => i18n.changeLanguage(lng)}
                className={cn('text-[10px] px-2 h-6 rounded uppercase', i18n.resolvedLanguage === lng ? 'bg-white shadow text-blue-600 font-bold' : 'text-gray-500')}>
                {lng}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={!canUndo} onClick={() => store.temporal.getState().undo()} title={t('toolbar.undo')} aria-label={t('toolbar.undo')}><Undo2 size={14} /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={!canRedo} onClick={() => store.temporal.getState().redo()} title={t('toolbar.redo')} aria-label={t('toolbar.redo')}><Redo2 size={14} /></Button>
        </div>
      </div>

      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">{t('toolbox.title')}</h3>
        <div className="grid grid-cols-2 gap-2">
          {TOOLS.map(tool => <ToolItem key={tool.tool} {...tool} />)}
        </div>
        <p className="text-[10px] text-gray-400 mt-2">{t('toolbox.hint')}</p>
      </section>

      <CatalogPanel />

      {allowLocalTemplates && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase">{t('files.savedTemplates')}</h3>
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
            {savedTemplates.length === 0 && <li className="text-[10px] text-gray-400">{t('files.none')}</li>}
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

      <section className="space-y-2 mt-auto">
        <h3 className="text-xs font-semibold text-gray-400 uppercase">{t('files.title')}</h3>
        {message && <p className={cn('text-[11px]', message.kind === 'error' ? 'text-red-600' : 'text-green-700')} role="status">{message.text}</p>}
        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" className="text-xs h-8 px-0" onClick={() => { if (window.confirm(t('files.confirmNew'))) s.setTemplate(emptyTemplate()); }}>
            <FilePlus size={13} className="mr-1" />{t('files.new')}
          </Button>
          <Button variant="outline" className="text-xs h-8 px-0" onClick={() => void exportFile()}>{t('files.export')}</Button>
          <label className="inline-flex items-center justify-center rounded-md border border-input text-xs h-8 shadow-sm cursor-pointer hover:bg-gray-50">
            {t('files.import')}
            <input type="file" accept=".json,application/json" className="sr-only" onChange={importFile} />
          </label>
        </div>
        <Button variant="outline" className="w-full text-xs" onClick={() => s.setTemplate(invoicePreset(), t('files.presetName'))}>{t('files.loadPreset')}</Button>
        <PreviewModal />
      </section>
    </div>
  );
}
