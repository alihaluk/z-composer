import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Pencil } from 'lucide-react';
import { DEFAULT_CATALOG, type Catalog } from '../lib/catalog';
import { catalogFromJsonSchema, catalogFromSample, missingFields, parseCatalog, type CatalogResult } from '../lib/catalogIO';
import { readJsonFile, saveJson } from '../lib/download';
import { cn } from '../lib/utils';
import { useEditor, useEditorStore } from '../store/editorStore';
import { Button } from './ui/Button';
import { FileButton } from './ui/FileButton';
import { CatalogEditor } from './CatalogEditor';

const countFields = (catalog: Catalog) => catalog.fields.reduce((n, f) => n + (f.type === 'array' ? 1 + (f.items?.length ?? 0) : 1), 0);

export function CatalogPanel({ editable = true }: { editable?: boolean }) {
  const { t } = useTranslation();
  const store = useEditorStore();
  const catalog = useEditor(s => s.catalog);
  const template = useEditor(s => s.template);
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const missing = useMemo(() => missingFields(template, catalog), [template, catalog]);

  const load = async (file: File, build: (json: unknown, name: string) => CatalogResult) => {
    try {
      const { catalog: next, skipped } = build(await readJsonFile(file), file.name.replace(/\.json$/i, ''));
      store.getState().setCatalog(next);
      const extra = skipped.length ? ` · ${t('catalog.skipped', { count: skipped.length, list: skipped.slice(0, 4).join(', ') })}` : '';
      setMessage({ kind: 'info', text: t('catalog.imported', { count: countFields(next) }) + extra });
    } catch (e) {
      setMessage({ kind: 'error', text: t('catalog.importFailed', { reason: e instanceof Error ? e.message : String(e) }) });
    }
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-400 uppercase">{t('catalog.title')}</h3>
        {editable && (
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setEditing(true)}><Pencil size={12} className="mr-1" />{t('catalog.edit')}</Button>
        )}
      </div>
      <div className="text-xs">
        <p className="text-gray-800 font-medium truncate" title={catalog.name}>{catalog.name}</p>
        <p className="text-gray-500">{t('catalog.fields', { count: countFields(catalog) })} · {catalog.sample ? t('catalog.hasSample') : t('catalog.noSample')}</p>
      </div>
      {missing.length > 0 && (
        <p className="flex gap-1 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded p-1.5" role="status">
          <AlertTriangle size={12} className="shrink-0 mt-0.5" />
          {t('catalog.missing', { count: missing.length, paths: missing.slice(0, 5).join(', ') + (missing.length > 5 ? '…' : '') })}
        </p>
      )}
      {editable && (
        <>
          <div className="grid grid-cols-2 gap-1.5">
            <FileButton accept=".json,application/json" variant="outline" size="sm" className="h-7 text-[11px] px-1" onFile={f => void load(f, catalogFromSample)}>{t('catalog.fromSample')}</FileButton>
            <FileButton accept=".json,application/json" variant="outline" size="sm" className="h-7 text-[11px] px-1" onFile={f => void load(f, catalogFromJsonSchema)}>{t('catalog.fromSchema')}</FileButton>
            <FileButton accept=".json,application/json" variant="outline" size="sm" className="h-7 text-[11px] px-1" onFile={f => void load(f, json => ({ catalog: parseCatalog(json), skipped: [] }))}>{t('catalog.openFile')}</FileButton>
            <Button variant="outline" size="sm" className="h-7 text-[11px] px-1" onClick={() => void saveJson(catalog, `${catalog.name || 'catalog'}.catalog.json`, 'Z-Composer catalog')}>{t('catalog.saveFile')}</Button>
          </div>
          {catalog !== DEFAULT_CATALOG && (
            <button type="button" className="text-[11px] text-gray-500 hover:text-gray-800 underline" onClick={() => { if (window.confirm(t('catalog.confirmReset'))) store.getState().setCatalog(DEFAULT_CATALOG); }}>
              {t('catalog.reset')}
            </button>
          )}
        </>
      )}
      {message && <p className={cn('text-[11px]', message.kind === 'error' ? 'text-red-600' : 'text-green-700')} role="status">{message.text}</p>}
      {editing && <CatalogEditor catalog={catalog} onClose={() => setEditing(false)} onSave={next => { store.getState().setCatalog(next); setEditing(false); }} />}
    </section>
  );
}
