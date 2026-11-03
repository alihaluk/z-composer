import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { type Catalog, type CatalogField, type FieldType } from '../lib/catalog';
import { isValidPath, parseCatalog } from '../lib/catalogIO';
import { Button } from './ui/Button';
import { Field, TextInput } from './ui/Field';

const SCALAR_TYPES: FieldType[] = ['string', 'number', 'date', 'datetime', 'boolean', 'image'];

function FieldRows({ fields, onChange, nested }: { fields: CatalogField[]; onChange: (fields: CatalogField[]) => void; nested?: boolean }) {
  const { t } = useTranslation();
  const update = (i: number, patch: Partial<CatalogField>) => onChange(fields.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  return (
    <div className={nested ? 'ml-4 border-l pl-2 space-y-1' : 'space-y-1'}>
      {fields.map((f, i) => (
        <div key={f.path}>
          <div className="grid grid-cols-[1fr_7rem_1fr_auto] gap-1 items-center">
            <code className="text-[11px] truncate" title={f.path}>{f.path}</code>
            {f.type === 'array' ? <span className="text-[11px] text-gray-500 px-1">array</span> : (
              <select aria-label={t('catalog.type')} className="h-7 text-xs border rounded px-1" value={f.type} onChange={e => update(i, { type: e.target.value as FieldType })}>
                {SCALAR_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            )}
            <input aria-label={t('catalog.label')} className="h-7 text-xs border rounded px-1.5" placeholder={f.path} value={f.label ?? ''} onChange={e => update(i, { label: e.target.value || undefined })} />
            <button type="button" aria-label={t('properties.delete')} className="p-1 text-gray-400 hover:text-red-600" onClick={() => onChange(fields.filter((_, j) => j !== i))}><Trash2 size={13} /></button>
          </div>
          {f.type === 'array' && <FieldRows nested fields={f.items ?? []} onChange={items => update(i, { items })} />}
        </div>
      ))}
      <AddField nested={nested} existing={fields.map(f => f.path)} onAdd={field => onChange([...fields, field])} />
    </div>
  );
}

function AddField({ nested, existing, onAdd }: { nested?: boolean; existing: string[]; onAdd: (field: CatalogField) => void }) {
  const { t } = useTranslation();
  const [path, setPath] = useState('');
  const [type, setType] = useState<FieldType>('string');
  const valid = isValidPath(path) && !path.startsWith('$.') && !existing.includes(path);
  const add = () => {
    if (!valid) return;
    onAdd(type === 'array' ? { path, type, items: [] } : { path, type });
    setPath('');
  };
  return (
    <div className="grid grid-cols-[1fr_7rem_auto] gap-1 items-center pt-1">
      <input aria-label={t('catalog.newPath')} placeholder={t('catalog.newPath')} value={path}
        className={`h-7 text-xs border rounded px-1.5 ${path && !valid ? 'border-red-400' : ''}`}
        title={path && !valid ? t('catalog.invalidPath') : undefined}
        onChange={e => setPath(e.target.value.trim())} onKeyDown={e => { if (e.key === 'Enter') add(); }} />
      <select aria-label={t('catalog.type')} className="h-7 text-xs border rounded px-1" value={type} onChange={e => setType(e.target.value as FieldType)}>
        {[...SCALAR_TYPES, ...(nested ? [] : ['array' as const])].map(x => <option key={x} value={x}>{x}</option>)}
      </select>
      <Button type="button" size="sm" variant="outline" className="h-7 text-xs" disabled={!valid} onClick={add}>{t('catalog.addField')}</Button>
    </div>
  );
}

export function CatalogEditor({ catalog, onSave, onClose }: { catalog: Catalog; onSave: (c: Catalog) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<Catalog>(catalog);
  const [sampleText, setSampleText] = useState(() => JSON.stringify(catalog.sample ?? null, null, 2));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = () => {
    try {
      const sample = sampleText.trim() ? JSON.parse(sampleText) : null;
      onSave(parseCatalog({ ...draft, sample: sample ?? undefined }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={t('catalog.editorTitle')}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden">
        <div className="p-3 border-b flex justify-between items-center bg-gray-50">
          <h2 className="text-lg font-bold text-gray-800">{t('catalog.editorTitle')}</h2>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>{t('catalog.cancel')}</Button>
            <Button onClick={save}>{t('catalog.apply')}</Button>
          </div>
        </div>
        {error && <p className="px-4 py-2 text-sm text-red-700 bg-red-50" role="alert">{error}</p>}
        <div className="flex-1 grid grid-cols-[3fr_2fr] overflow-hidden">
          <div className="p-4 overflow-auto space-y-3 border-r">
            <Field label={t('catalog.name')}>{id => <TextInput id={id} value={draft.name} onChange={name => setDraft({ ...draft, name })} />}</Field>
            <div className="grid grid-cols-[1fr_7rem_1fr_auto] gap-1 text-[10px] uppercase text-gray-400">
              <span>{t('catalog.path')}</span><span>{t('catalog.type')}</span><span>{t('catalog.label')}</span><span />
            </div>
            <FieldRows fields={draft.fields} onChange={fields => setDraft({ ...draft, fields })} />
          </div>
          <div className="p-4 flex flex-col gap-2 overflow-hidden">
            <label htmlFor="catalog-sample" className="text-xs font-medium text-gray-600">{t('catalog.sample')}</label>
            <p className="text-[10px] text-gray-400">{t('catalog.sampleHint')}</p>
            <textarea id="catalog-sample" spellCheck={false} className="flex-1 font-mono text-[11px] border rounded p-2 resize-none" value={sampleText} onChange={e => setSampleText(e.target.value)} />
          </div>
        </div>
      </div>
    </div>
  );
}
