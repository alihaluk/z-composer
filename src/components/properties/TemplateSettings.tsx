import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { DPI_OPTIONS, PAPER_PRESETS_MM } from '../../lib/constants';
import { CultureInput } from '../ui/CultureInput';
import { generateTemplateZpl } from '../../lib/zplTemplate';
import { useEditor, useEditorStore, type CanvasMode } from '../../store/editorStore';
import { type Dpi } from '../../types';
import { Button } from '../ui/Button';
import { Field, NumberInput, Section, Segmented, SelectInput } from '../ui/Field';
import { ZplCode } from './ZplCode';

export function TemplateSettings() {
  const { t } = useTranslation();
  const store = useEditorStore();
  const template = useEditor(s => s.template);
  const zoom = useEditor(s => s.zoom);
  const mode = useEditor(s => s.canvasMode);
  const locale = useEditor(s => s.previewLocale);
  const s = store.getState();

  return (
    <div className="space-y-4">
      <Section title={t('settings.printer')}>
        <Field label={t('settings.printableWidth')} hint={t('settings.printableWidthHint')}>
          {id => <NumberInput id={id} value={template.printer.widthMm} min={10} max={216} step={1} onChange={widthMm => s.updatePrinter({ widthMm })} />}
        </Field>
        <div className="flex gap-1">
          {PAPER_PRESETS_MM.map(w => (
            <Button key={w} size="sm" variant={template.printer.widthMm === w ? 'default' : 'outline'} className="h-7 flex-1 text-xs" onClick={() => s.updatePrinter({ widthMm: w })}>
              {w} mm
            </Button>
          ))}
        </div>
        <Field label={t('settings.resolution')}>
          {id => (
            <SelectInput id={id} value={String(template.printer.dpi)} onChange={v => s.updatePrinter({ dpi: Number(v) as Dpi })}>
              {DPI_OPTIONS.map(d => <option key={d} value={d}>{d} dpi</option>)}
            </SelectInput>
          )}
        </Field>
      </Section>

      <Section title={t('settings.view')}>
        <Segmented<CanvasMode> label={t('settings.canvasShows')} value={mode} onChange={m => s.setCanvasMode(m)}
          options={[{ value: 'fields', label: t('preview.fieldNames') }, { value: 'sample', label: t('preview.sampleData') }]} />
        <Field label={t('settings.previewCulture')} hint={t('settings.previewCultureHint')}>
          {id => <CultureInput id={id} value={locale} onChange={l => s.setPreviewLocale(l)} />}
        </Field>
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-600"><span>{t('settings.zoom')}</span><span>{Math.round(zoom * 100)}%</span></div>
          <input type="range" min="0.5" max="4" step="0.1" value={zoom} aria-label={t('settings.zoom')} onChange={e => s.setZoom(Number(e.target.value))} className="w-full accent-blue-600" />
        </div>
      </Section>

      <Section title={t('bands.title')} actions={
        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => s.addBand()}><Plus size={12} className="mr-1" />{t('bands.add')}</Button>
      }>
        <ul className="space-y-1">
          {template.bands.map(b => (
            <li key={b.id}>
              <button type="button" className="w-full text-left text-xs px-2 py-1 rounded hover:bg-gray-100 flex justify-between" onClick={() => s.select({ bandId: b.id, ids: [] })}>
                <span>{b.name}{b.repeat ? ` ↻ ${b.repeat}` : ''}</span>
                <span className="text-gray-500">{b.height} mm</span>
              </button>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t('shortcuts.title')}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
          {(['move', 'select', 'copy', 'duplicate', 'delete', 'undo', 'deselect'] as const).map(k => (
            <div key={k} className="contents">
              <dt className="font-mono text-gray-700 whitespace-nowrap">{t(`shortcuts.${k}Keys`)}</dt>
              <dd className="text-gray-500">{t(`shortcuts.${k}`)}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title={t('settings.output')}>
        <ZplCode zpl={generateTemplateZpl(template)} />
      </Section>
    </div>
  );
}
