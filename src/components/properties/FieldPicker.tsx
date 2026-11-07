import { useTranslation } from 'react-i18next';
import { arrayFields, fieldLabel, fieldsForBand, findField, type FieldType } from '../../lib/catalog';
import { useEditor } from '../../store/editorStore';
import { type Band, type Condition, type ConditionOp } from '../../types';
import { Field, SelectInput } from '../ui/Field';

/** Grouped select of the fields a band can bind to, optionally filtered by type. */
export function FieldPicker({ band, value, onChange, types, label, includeArrays }: {
  band: Band; value: string | undefined; onChange: (path: string) => void; types?: FieldType[]; label: string; includeArrays?: boolean;
}) {
  const { t } = useTranslation();
  const catalog = useEditor(s => s.catalog);
  const fields = fieldsForBand(catalog, band.repeat).filter(f => !types || types.includes(f.field.type));
  const arrays = includeArrays && !band.repeat ? arrayFields(catalog).map(f => ({ path: f.path, field: f, group: '' })) : [];
  const groups = new Map<string, typeof fields>();
  for (const f of [...fields, ...arrays]) {
    const group = f.path.startsWith('$.') ? t('fields.document') : band.repeat ? t('fields.item') : f.group || t('fields.general');
    groups.set(group, [...(groups.get(group) ?? []), f]);
  }
  const known = !value || [...fields, ...arrays].some(f => f.path === value);

  return (
    <Field label={label} hint={!known ? t('fields.missing') : undefined}>
      {id => (
        <SelectInput id={id} value={value ?? ''} onChange={onChange}>
          <option value="">{t('fields.select')}</option>
          {!known && <option value={value}>{value} ⚠</option>}
          {[...groups].map(([group, list]) => (
            <optgroup key={group} label={group}>
              {list.map(f => <option key={f.path} value={f.path}>{fieldLabel(f.field)} · {f.path}</option>)}
            </optgroup>
          ))}
        </SelectInput>
      )}
    </Field>
  );
}

export function ConditionEditor({ band, value, onChange }: { band: Band; value: Condition | undefined; onChange: (c: Condition | undefined) => void }) {
  const { t } = useTranslation();
  const catalog = useEditor(s => s.catalog);
  // A new condition on a number field defaults to "not zero"; the type is the newly picked field's.
  const defaultOp = (path: string): ConditionOp => (findField(catalog, path, band.repeat)?.type === 'number' ? 'notZero' : 'notEmpty');
  return (
    <div className="space-y-2">
      <FieldPicker band={band} includeArrays label={t('condition.field')} value={value?.path}
        onChange={path => onChange(path ? { path, op: value?.op ?? defaultOp(path) } : undefined)} />
      {value?.path && (
        <Field label={t('condition.show')}>
          {id => (
            <SelectInput<ConditionOp> id={id} value={value.op} onChange={op => onChange({ ...value, op })}>
              <option value="notEmpty">{t('condition.notEmpty')}</option>
              <option value="notZero">{t('condition.notZero')}</option>
            </SelectInput>
          )}
        </Field>
      )}
    </div>
  );
}
