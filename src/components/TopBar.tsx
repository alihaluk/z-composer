import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, FilePlus, FolderOpen, Redo2, Save, Undo2 } from 'lucide-react';
import { useStore } from 'zustand';
import { cn } from '../lib/utils';
import { bandNames } from '../lib/bandNames';
import { emptyTemplate, parseTemplate, withFieldsUsed } from '../lib/templateIO';
import { readJsonFile, saveJson } from '../lib/download';
import { useEditor, useEditorStore } from '../store/editorStore';
import { Button } from './ui/Button';
import { FileButton } from './ui/FileButton';
import { PresetPicker } from './PresetPicker';
import { PreviewModal } from './PreviewModal';
import { DesignCheckButton } from './DesignCheck';

/** Labels next to icons from this width on; below it the buttons show their icon and keep their name. */
const LABEL = 'hidden xl:inline';

/** The designer's command bar: the template, file actions, the design check and the preview. */
export function TopBar({ catalogEditable, showLanguageSwitch, onSave }: { catalogEditable: boolean; showLanguageSwitch: boolean; onSave?: () => void }) {
  const { t, i18n } = useTranslation();
  const store = useEditorStore();
  const templateName = useEditor(s => s.templateName);
  const canUndo = useStore(store.temporal, s => s.pastStates.length > 0);
  const canRedo = useStore(store.temporal, s => s.futureStates.length > 0);
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const s = store.getState();

  const exportFile = () => {
    const { template, templateName: name, catalog } = store.getState();
    const fileName = `${name || `z-composer-${new Date().toISOString().slice(0, 10)}`}.json`;
    void saveJson(withFieldsUsed(template, catalog), fileName, 'Z-Composer template');
  };

  const importFile = async (file: File) => {
    try {
      s.setTemplate(parseTemplate(await readJsonFile(file)), file.name.replace(/\.json$/i, ''));
      setMessage(null);
    } catch (e) {
      setMessage({ kind: 'error', text: t('files.importFailed', { reason: e instanceof Error ? e.message : String(e) }) });
    }
  };

  const action = 'h-8 px-2 gap-1.5 text-xs';
  return (
    <div className="flex items-center gap-2 border-b bg-white px-3 py-1.5" role="region" aria-label={t('topbar.label')}>
      <h2 className="text-sm font-bold text-gray-800 whitespace-nowrap">Z-Composer</h2>
      <span className="text-gray-300" aria-hidden>/</span>
      <span className={cn('min-w-0 max-w-[14rem] truncate text-sm', templateName ? 'text-gray-800' : 'text-gray-500')} title={templateName ?? undefined}>
        {templateName ?? t('topbar.untitled')}
      </span>
      <div className="flex items-center">
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!canUndo} onClick={() => store.temporal.getState().undo()} title={t('toolbar.undo')} aria-label={t('toolbar.undo')}><Undo2 size={15} /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!canRedo} onClick={() => store.temporal.getState().redo()} title={t('toolbar.redo')} aria-label={t('toolbar.redo')}><Redo2 size={15} /></Button>
      </div>

      <div className="flex items-center gap-1 border-l pl-2">
        <Button variant="ghost" className={action} title={t('files.new')} aria-label={t('files.new')}
          onClick={() => { if (window.confirm(t('files.confirmNew'))) s.setTemplate(emptyTemplate(bandNames(t))); }}>
          <FilePlus size={15} aria-hidden /><span className={LABEL}>{t('files.new')}</span>
        </Button>
        <FileButton accept=".json,application/json" variant="ghost" className={action} title={t('files.import')} aria-label={t('files.import')} onFile={f => void importFile(f)}>
          <FolderOpen size={15} aria-hidden /><span className={LABEL}>{t('files.import')}</span>
        </FileButton>
        <Button variant="ghost" className={action} title={t('files.export')} aria-label={t('files.export')} onClick={exportFile}>
          <Download size={15} aria-hidden /><span className={LABEL}>{t('files.export')}</span>
        </Button>
        <PresetPicker catalogEditable={catalogEditable} label={t('files.loadPreset')} variant="outline" className={action} />
      </div>

      <div className="min-w-0 flex-1">
        {message && <p className={cn('truncate text-[11px]', message.kind === 'error' ? 'text-red-600' : 'text-green-700')} role="status" title={message.text}>{message.text}</p>}
      </div>

      <DesignCheckButton />
      {showLanguageSwitch && (
        <div className="flex bg-gray-100 rounded p-0.5 gap-0.5" role="group" aria-label={t('language')}>
          {['tr', 'en'].map(lng => (
            <button key={lng} type="button" onClick={() => i18n.changeLanguage(lng)}
              className={cn('text-[10px] px-2 h-6 rounded uppercase', i18n.resolvedLanguage === lng ? 'bg-white shadow text-blue-600 font-bold' : 'text-gray-600')}>
              {lng}
            </button>
          ))}
        </div>
      )}
      {onSave && (
        <Button className={cn(action, 'bg-blue-600 hover:bg-blue-700 px-3')} onClick={() => { onSave(); setMessage({ kind: 'info', text: t('files.handedOver') }); }}>
          <Save size={15} aria-hidden />{t('files.save')}
        </Button>
      )}
      <PreviewModal className={cn(action, 'px-3')} />
    </div>
  );
}
