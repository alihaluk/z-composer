import { useTranslation } from 'react-i18next';
import { findField } from '../../lib/catalog';
import { DATE_FORMATS, NUMBER_FORMATS, formatValue } from '../../lib/formats';
import { sampleContext } from '../../lib/elementDisplay';
import { lookup } from '../../lib/zplFill';
import { useEditor } from '../../store/editorStore';
import { type Band } from '../../types';
import { Checkbox, Field, SelectInput, TextInput } from '../ui/Field';

// A custom pattern starts from one that is not in the list, so its text box shows.
const CUSTOM_START = 'dd.MM.yyyy HH:mm';

/** Format code and culture choice for one field, with examples from its sample value. */
export function FormatPicker({ band, path, format, invariant, onChange }: {
  band: Band; path: string | undefined; format: string | undefined; invariant: boolean | undefined;
  onChange: (patch: { format?: string; invariant?: boolean }) => void;
}) {
  const { t } = useTranslation();
  const catalog = useEditor(s => s.catalog);
  const locale = useEditor(s => s.previewLocale);
  const fieldType = path ? findField(catalog, path, band.repeat)?.type : undefined;
  const formats = fieldType === 'number' ? NUMBER_FORMATS : fieldType === 'date' || fieldType === 'datetime' ? DATE_FORMATS : [];
  // Format options show the field's own sample value in the preview culture.
  const sampleValue = path ? lookup(sampleContext(catalog, band), catalog.sample, path) : undefined;
  const exampleValue = sampleValue ?? (fieldType === 'number' ? 1234.5 : '2026-11-13T14:37:00');
  const known = !!format && (formats as readonly string[]).includes(format);

  return (
    <>
      {(formats.length > 0 || format) && (
        <Field label={t('properties.format')} hint={t('properties.formatHint')}>
          {id => (
            <div className="space-y-1">
              <SelectInput id={id} value={known ? format! : format ? 'custom' : ''}
                onChange={v => onChange({ format: v === 'custom' ? CUSTOM_START : v || undefined, invariant })}>
                <option value="">{t('properties.formatNone')}</option>
                {formats.map(f => (
                  <option key={f} value={f}>{f} · {formatValue(exampleValue, f, locale, !!invariant) ?? '—'} ({t(`formats.${f}`, { defaultValue: t('properties.formatPattern') })})</option>
                ))}
                {fieldType !== 'number' && <option value="custom">{t('properties.formatCustom')}</option>}
              </SelectInput>
              {format && !known && (
                <TextInput value={format} placeholder={CUSTOM_START} onChange={f => onChange({ format: f.replace(/[|{}^~\r\n]/g, '') || undefined, invariant })} />
              )}
            </div>
          )}
        </Field>
      )}
      {format && <Checkbox label={t('properties.invariant')} checked={!!invariant} onChange={v => onChange({ format, invariant: v || undefined })} />}
    </>
  );
}
