import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Braces, Plus, Trash2, Type } from 'lucide-react';
import { isFieldPart } from '../../lib/zplTemplate';
import { type Band, type ContentPart, type FieldPart } from '../../types';
import { Button } from '../ui/Button';
import { Field, NumberInput, TextInput } from '../ui/Field';
import { FieldPicker } from './FieldPicker';
import { FormatPicker } from './FormatPicker';

const SCALAR_TYPES = ['string', 'number', 'date', 'datetime', 'boolean'] as const;

/** Edits composed content: static text and fields in order, each field with its own format. */
export function ContentBuilder({ band, parts, onChange }: { band: Band; parts: ContentPart[]; onChange: (parts: ContentPart[]) => void }) {
  const { t } = useTranslation();
  const set = (i: number, part: ContentPart) => onChange(parts.map((p, j) => (j === i ? part : p)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...parts];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {parts.length === 0 && <p className="text-[11px] text-gray-500">{t('builder.empty')}</p>}
      <ol className="space-y-2">
        {parts.map((p, i) => (
          <li key={i} className="rounded border bg-gray-50 p-2 space-y-1.5">
            <div className="flex items-center gap-1">
              <span className="flex-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                {isFieldPart(p) ? <Braces size={11} aria-hidden /> : <Type size={11} aria-hidden />}
                {isFieldPart(p) ? t('builder.field') : t('builder.text')} {i + 1}
              </span>
              <button type="button" className="p-1 text-gray-500 hover:text-gray-800 disabled:opacity-30" aria-label={t('builder.moveUp')} title={t('builder.moveUp')} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={12} /></button>
              <button type="button" className="p-1 text-gray-500 hover:text-gray-800 disabled:opacity-30" aria-label={t('builder.moveDown')} title={t('builder.moveDown')} disabled={i === parts.length - 1} onClick={() => move(i, 1)}><ArrowDown size={12} /></button>
              <button type="button" className="p-1 text-gray-500 hover:text-red-600" aria-label={t('builder.remove')} title={t('builder.remove')} onClick={() => onChange(parts.filter((_, j) => j !== i))}><Trash2 size={12} /></button>
            </div>
            {isFieldPart(p) ? (
              <FieldPart band={band} part={p} onChange={part => set(i, part)} />
            ) : (
              <TextInput value={p.text} placeholder={t('builder.textPlaceholder')} onChange={text => set(i, { text })} />
            )}
          </li>
        ))}
      </ol>
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="outline" onClick={() => onChange([...parts, { text: '' }])}><Plus size={14} className="mr-1" />{t('builder.addText')}</Button>
        <Button size="sm" variant="outline" onClick={() => onChange([...parts, { path: '' }])}><Plus size={14} className="mr-1" />{t('builder.addField')}</Button>
      </div>
    </div>
  );
}

function FieldPart({ band, part, onChange }: { band: Band; part: FieldPart; onChange: (part: FieldPart) => void }) {
  const { t } = useTranslation();
  return (
    <>
      <FieldPicker band={band} label={t('properties.dataSource')} value={part.path || undefined} types={[...SCALAR_TYPES]}
        onChange={path => onChange({ path, max: part.max })} />
      <FormatPicker band={band} path={part.path || undefined} format={part.format} invariant={part.invariant}
        onChange={({ format, invariant }) => onChange({ ...part, format, invariant })} />
      <Field label={t('builder.max')} hint={t('builder.maxHint')}>
        {id => <NumberInput id={id} value={part.max ?? 0} min={0} max={1000} step={1} onChange={max => onChange({ ...part, max: Math.round(max) || undefined })} />}
      </Field>
    </>
  );
}
