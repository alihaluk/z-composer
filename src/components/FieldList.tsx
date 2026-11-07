import { useMemo, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import { Calendar, CalendarClock, Hash, Image, QrCode, Repeat, Search, ToggleLeft, Type, type LucideIcon } from 'lucide-react';
import { fieldLabel, type FieldType } from '../lib/catalog';
import { bandForField, createFieldElement, fieldRefs, matchesField, nextFieldPosition, type FieldRef } from '../lib/fieldElements';
import { GIB_QR_FIELD } from '../lib/gibQr';
import { cn } from '../lib/utils';
import { useEditor, useEditorStore } from '../store/editorStore';

const ICONS: Record<Exclude<FieldType, 'array'>, LucideIcon> = {
  string: Type, number: Hash, date: Calendar, datetime: CalendarClock, boolean: ToggleLeft, image: Image,
};

const fieldDragId = (ref: FieldRef) => `field-${ref.array ?? ''}:${ref.path}`;

function FieldItem({ field: ref, onAdd }: { field: FieldRef; onAdd: (ref: FieldRef) => void }) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: fieldDragId(ref), data: { type: 'field', field: ref } });
  const Icon = !ref.array && ref.path === GIB_QR_FIELD ? QrCode : ICONS[ref.field.type as Exclude<FieldType, 'array'>] ?? Type;
  return (
    <li>
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        onClick={() => onAdd(ref)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAdd(ref); } }}
        title={`${ref.path} · ${t('fieldList.itemHint')}`}
        className={cn(
          'flex items-center gap-1.5 px-1.5 py-1 rounded cursor-grab select-none hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
          isDragging && 'opacity-50',
        )}
      >
        <Icon size={12} aria-hidden className="shrink-0 text-gray-500" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs text-gray-800">{fieldLabel(ref.field)}</span>
        </span>
      </div>
    </li>
  );
}

/** The catalog's fields; click or drag one onto a band to add an element bound to it. */
export function FieldList() {
  const { t } = useTranslation();
  const store = useEditorStore();
  const catalog = useEditor(s => s.catalog);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const groups = useMemo(() => {
    const result = new Map<string, { key: string; title: string; array?: string; fields: FieldRef[] }>();
    for (const ref of fieldRefs(catalog)) {
      // Document fields together, then one group per array under its label: the catalog names
      // fields, not path segments, so no group is titled with an English path part.
      const key = ref.array ? `array:${ref.array}` : '';
      const array = ref.array ? catalog.fields.find(f => f.path === ref.array) : undefined;
      const title = array ? fieldLabel(array) : t('fieldList.document');
      // Searching for a group's name ("satırlar") lists its fields.
      if (!matchesField(ref, query, title)) continue;
      if (!result.has(key)) result.set(key, { key, title, array: ref.array, fields: [] });
      result.get(key)!.fields.push(ref);
    }
    return [...result.values()];
  }, [catalog, query, t]);

  const add = (ref: FieldRef) => {
    const { template, selection, addElement } = store.getState();
    const band = bandForField(ref, template.bands, selection?.bandId);
    if (!band) {
      const array = catalog.fields.find(f => f.path === ref.array);
      setMessage(t('fieldList.noBand', { array: array ? fieldLabel(array) : ref.array }));
      return;
    }
    setMessage(null);
    const el = createFieldElement(ref, band, 0, 0, catalog, template.printer.widthMm);
    if (!el) return;
    // The karekod keeps the corner the guide asks for; other fields line up below each other.
    const placed = el.barcodeType === 'qr' ? el : { ...el, ...nextFieldPosition(band, el, template.printer.widthMm) };
    addElement(band.id, placed);
  };

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Search size={12} aria-hidden className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t('fieldList.search')} aria-label={t('fieldList.search')}
          className="w-full h-7 text-xs border rounded pl-6 pr-2" />
      </div>
      <div className="max-h-80 overflow-y-auto rounded border bg-gray-50/50 p-1" role="region" aria-label={t('fieldList.title')}>
        {groups.length === 0 && <p className="text-[11px] text-gray-500 p-1">{t('fieldList.none')}</p>}
        {groups.map(g => (
          <section key={g.key} aria-label={g.title}>
            <h4 className="flex items-center gap-1 px-1.5 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500"
              title={g.array ? t('fieldList.arrayHint', { array: g.array }) : undefined}>
              {g.array && <Repeat size={9} aria-hidden />}{g.title}
            </h4>
            <ul>{g.fields.map(ref => <FieldItem key={fieldDragId(ref)} field={ref} onAdd={add} />)}</ul>
          </section>
        ))}
      </div>
      <p className="text-[10px] text-gray-500">{t('fieldList.hint')}</p>
      {message && <p className="text-[11px] text-amber-800" role="status">{message}</p>}
    </div>
  );
}
