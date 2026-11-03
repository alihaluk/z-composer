import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Lock, LockOpen, Plus, Trash2 } from 'lucide-react';
import { arrayFields, fieldLabel } from '../../lib/catalog';
import { useEditor, useEditorStore } from '../../store/editorStore';
import { type Band } from '../../types';
import { Button } from '../ui/Button';
import { Field, NumberInput, Section, SelectInput, TextInput } from '../ui/Field';
import { ConditionEditor } from './FieldPicker';

export function BandProperties({ band }: { band: Band }) {
  const { t } = useTranslation();
  const store = useEditorStore();
  const catalog = useEditor(s => s.catalog);
  const index = useEditor(s => s.template.bands.findIndex(b => b.id === band.id));
  const count = useEditor(s => s.template.bands.length);
  const s = store.getState();
  const update = (patch: Partial<Band>) => s.updateBand(band.id, patch);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-800">{t('bands.properties')}</h3>
        <Button size="sm" variant="ghost" onClick={() => s.select(null)}>{t('properties.close')}</Button>
      </div>

      <Section title={t('bands.band')}>
        <Field label={t('bands.name')}>{id => <TextInput id={id} value={band.name} onChange={name => update({ name })} />}</Field>
        <Field label={t('bands.height')}>{id => <NumberInput id={id} value={band.height} min={0.5} max={500} step={0.5} onChange={height => update({ height })} />}</Field>
        <Field label={t('bands.repeat')} hint={band.repeat ? t('bands.repeatHint') : undefined}>
          {id => (
            <SelectInput id={id} value={band.repeat ?? ''} onChange={repeat => update({ repeat: repeat || undefined })}>
              <option value="">{t('bands.static')}</option>
              {arrayFields(catalog).map(f => <option key={f.path} value={f.path}>{fieldLabel(f)} · {f.path}</option>)}
              {band.repeat && !arrayFields(catalog).some(f => f.path === band.repeat) && <option value={band.repeat}>{band.repeat} ⚠</option>}
            </SelectInput>
          )}
        </Field>
      </Section>

      <Section title={t('condition.title')}>
        <p className="text-[10px] text-gray-500">{t('bands.conditionHint')}</p>
        <ConditionEditor band={{ ...band, repeat: undefined }} value={band.condition} onChange={condition => update({ condition })} />
      </Section>

      <Section title={t('layers.title')}>
        {band.elements.length === 0 && <p className="text-[11px] text-gray-500">{t('layers.empty')}</p>}
        <ul className="space-y-0.5 max-h-48 overflow-auto">
          {[...band.elements].reverse().map(el => (
            <li key={el.id} className="flex items-center gap-1 text-xs">
              <button type="button" className="flex-1 truncate text-left px-1.5 py-1 rounded hover:bg-gray-100" onClick={() => s.select({ bandId: band.id, ids: [el.id] })}>
                <span className="text-gray-500 mr-1">{t(`tools.${el.type === 'barcode' && el.barcodeType === 'qr' ? 'qr' : el.type}`)}</span>
                {el.isDynamic ? `[${el.dataSource ?? ''}]` : el.content ?? el.imageKey ?? ''}
              </button>
              <button type="button" aria-label={el.locked ? t('layers.unlock') : t('layers.lock')} className="p-1 text-gray-500 hover:text-gray-800" onClick={() => s.updateElement(band.id, el.id, { locked: !el.locked })}>
                {el.locked ? <Lock size={12} /> : <LockOpen size={12} />}
              </button>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t('bands.arrange')}>
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="outline" disabled={index <= 0} onClick={() => s.moveBand(band.id, -1)}><ArrowUp size={14} className="mr-1" />{t('bands.moveUp')}</Button>
          <Button size="sm" variant="outline" disabled={index >= count - 1} onClick={() => s.moveBand(band.id, 1)}><ArrowDown size={14} className="mr-1" />{t('bands.moveDown')}</Button>
          <Button size="sm" variant="outline" onClick={() => s.addBand(band.id)}><Plus size={14} className="mr-1" />{t('bands.addBelow')}</Button>
          <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" disabled={count <= 1}
            onClick={() => { if (band.elements.length === 0 || window.confirm(t('bands.confirmDelete', { name: band.name }))) s.removeBand(band.id); }}>
            <Trash2 size={14} className="mr-1" />{t('bands.delete')}
          </Button>
        </div>
      </Section>
    </div>
  );
}
