import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlignCenter, AlignLeft, AlignRight, BringToFront, Copy, SendToBack, Trash2 } from 'lucide-react';
import { findField } from '../../lib/catalog';
import { mmToDots } from '../../lib/constants';
import { DATE_FORMATS, NUMBER_FORMATS } from '../../lib/formats';
import { loadGrayBitmap } from '../../lib/imageUtils';
import { DEFAULT_FONT_MM, DEFAULT_THICKNESS_MM, elementLines, textMetrics } from '../../lib/zplTemplate';
import { useEditor, useEditorStore } from '../../store/editorStore';
import { type Align, type Band, type OverflowMode, type Rotation, type TemplateElement } from '../../types';
import { Button } from '../ui/Button';
import { Checkbox, Field, NumberInput, Section, Segmented, SelectInput, TextInput } from '../ui/Field';
import { ConditionEditor, FieldPicker } from './FieldPicker';
import { ZplCode } from './ZplCode';

export function ElementProperties({ band, element: el }: { band: Band; element: TemplateElement }) {
  const { t } = useTranslation();
  const store = useEditorStore();
  const catalog = useEditor(s => s.catalog);
  const dpi = useEditor(s => s.template.printer.dpi);
  const [imageError, setImageError] = useState<string | null>(null);
  const s = store.getState();
  const update = (patch: Partial<TemplateElement>) => s.updateElement(band.id, el.id, patch);
  const locked = !!el.locked;
  const isQr = el.type === 'barcode' && el.barcodeType === 'qr';
  const fieldType = el.isDynamic && el.dataSource ? findField(catalog, el.dataSource, band.repeat)?.type : undefined;
  const formats = fieldType === 'number' ? NUMBER_FORMATS : fieldType === 'date' || fieldType === 'datetime' ? DATE_FORMATS : [];

  const uploadImage = async (file: File | undefined) => {
    if (!file) return;
    setImageError(null);
    try {
      const { bitmap, dataUrl } = await loadGrayBitmap(file);
      const height = Math.round((el.width * bitmap.height / bitmap.width) * 10) / 10;
      update({ imageKey: undefined, imageBase64: dataUrl, bitmap, height });
    } catch (e) {
      setImageError(e instanceof Error ? e.message : String(e));
    }
  };

  const typeKey = isQr ? 'qr' : el.type;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-800">{t(`tools.${typeKey}`)}</h3>
        <Button size="sm" variant="ghost" onClick={() => s.select({ bandId: band.id, ids: [] })}>{t('properties.close')}</Button>
      </div>

      <Section title={t('properties.position')}>
        <div className="grid grid-cols-2 gap-2">
          <Field label="X (mm)">{id => <NumberInput id={id} value={el.x} min={0} step={0.5} disabled={locked} onChange={x => update({ x })} />}</Field>
          <Field label="Y (mm)">{id => <NumberInput id={id} value={el.y} min={0} step={0.5} disabled={locked} onChange={y => update({ y })} />}</Field>
          <Field label={t('properties.width')}>{id => <NumberInput id={id} value={el.width} min={0.1} step={0.5} disabled={locked}
            onChange={width => update(isQr ? { width, height: width } : { width })} />}</Field>
          {!isQr && <Field label={t('properties.height')}>{id => <NumberInput id={id} value={el.height} min={0.1} step={0.5} disabled={locked} onChange={height => update({ height })} />}</Field>}
        </div>
        <Checkbox label={t('layers.locked')} checked={locked} onChange={v => update({ locked: v || undefined })} />
      </Section>

      {(el.type === 'text' || el.type === 'barcode') && (
        <Section title={t('properties.content')}>
          <Segmented<'static' | 'dynamic'> label={t('properties.content')} value={el.isDynamic ? 'dynamic' : 'static'}
            onChange={v => update({ isDynamic: v === 'dynamic' })}
            options={[{ value: 'static', label: t('properties.static') }, { value: 'dynamic', label: t('properties.dynamic') }]} />
          {el.isDynamic ? (
            <>
              <FieldPicker band={band} label={t('properties.dataSource')} value={el.dataSource} types={['string', 'number', 'date', 'datetime', 'boolean']}
                onChange={dataSource => update({ dataSource: dataSource || undefined, format: undefined })} />
              {(formats.length > 0 || el.format) && (
                <Field label={t('properties.format')} hint={t('properties.formatHint')}>
                  {id => (
                    <div className="space-y-1">
                      <SelectInput id={id} value={el.format && (formats as readonly string[]).includes(el.format) ? el.format : el.format ? 'custom' : ''}
                        onChange={v => update({ format: v === 'custom' ? el.format || 'dd.MM.yyyy' : v || undefined })}>
                        <option value="">{t('properties.formatNone')}</option>
                        {formats.map(f => <option key={f} value={f}>{t(`formats.${f}`, { defaultValue: f })}</option>)}
                        {fieldType !== 'number' && <option value="custom">{t('properties.formatCustom')}</option>}
                      </SelectInput>
                      {el.format && !(formats as readonly string[]).includes(el.format) && (
                        <TextInput value={el.format} placeholder="dd.MM.yyyy HH:mm" onChange={format => update({ format: format || undefined })} />
                      )}
                    </div>
                  )}
                </Field>
              )}
              {el.format && <Checkbox label={t('properties.invariant')} checked={!!el.invariant} onChange={v => update({ invariant: v || undefined })} />}
            </>
          ) : (
            <Field label={t('properties.text')}>{id => <TextInput id={id} value={el.content ?? ''} onChange={content => update({ content })} />}</Field>
          )}
        </Section>
      )}

      {el.type === 'text' && (
        <Section title={t('properties.text')}>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t('properties.fontSize')} hint={`${textMetrics(el, dpi).height} dots`}>
              {id => <NumberInput id={id} value={el.fontSize ?? DEFAULT_FONT_MM} min={0.5} max={50} step={0.1} onChange={fontSize => update({ fontSize })} />}
            </Field>
            <Field label={t('properties.rotation')}>
              {id => (
                <SelectInput id={id} value={String(el.rotation ?? 0)} onChange={v => update({ rotation: Number(v) as Rotation })}>
                  {[0, 90, 180, 270].map(r => <option key={r} value={r}>{r}°</option>)}
                </SelectInput>
              )}
            </Field>
          </div>
          <Segmented<Align> label={t('properties.align')} value={el.align ?? 'left'} onChange={align => update({ align })}
            options={[
              { value: 'left', label: <AlignLeft size={14} />, title: t('properties.alignLeft') },
              { value: 'center', label: <AlignCenter size={14} />, title: t('properties.alignCenter') },
              { value: 'right', label: <AlignRight size={14} />, title: t('properties.alignRight') },
            ]} />
          <Checkbox label={t('properties.bold')} checked={!!el.fontBold} disabled={!!el.grow && el.overflow === 'wrap'} onChange={v => update({ fontBold: v || undefined })} />

          <Field label={t('overflow.title')}>
            {id => (
              <SelectInput<OverflowMode> id={id} value={el.overflow ?? 'none'} onChange={overflow => update({ overflow, maxChars: el.maxChars ?? 20, maxLines: el.maxLines ?? 2 })}>
                <option value="none">{t('overflow.none')}</option>
                <option value="truncate">{t('overflow.truncate')}</option>
                <option value="wrap">{t('overflow.wrap')}</option>
              </SelectInput>
            )}
          </Field>
          {el.overflow === 'truncate' && (
            <Field label={t('overflow.maxChars')}>{id => <NumberInput id={id} value={el.maxChars} min={1} step={1} onChange={maxChars => update({ maxChars: Math.round(maxChars) })} />}</Field>
          )}
          {el.overflow === 'wrap' && (
            <>
              <Field label={t('overflow.maxLines')}>{id => <NumberInput id={id} value={el.maxLines ?? 2} min={1} max={20} step={1} onChange={maxLines => update({ maxLines: Math.round(maxLines) })} />}</Field>
              <Checkbox label={t('overflow.grow')} checked={!!el.grow} onChange={grow => update({ grow: grow || undefined, fontBold: grow ? undefined : el.fontBold })} />
              {el.grow && (
                <>
                  <p className="text-[10px] text-gray-400">{t('overflow.growHint')}</p>
                  <Field label={t('overflow.charsPerLine')} hint={t('overflow.charsPerLineHint', { n: textMetrics({ ...el, charsPerLine: undefined }, dpi).charsPerLine })}>
                    {id => <NumberInput id={id} value={el.charsPerLine} min={1} step={1} onChange={cpl => update({ charsPerLine: Math.round(cpl) || undefined })} />}
                  </Field>
                </>
              )}
            </>
          )}
        </Section>
      )}

      {el.type === 'box' && (
        <Section title={t('tools.box')}>
          <Field label={t('properties.thickness')} hint={`${Math.max(1, mmToDots(el.thickness ?? DEFAULT_THICKNESS_MM, dpi))} dots`}>
            {id => <NumberInput id={id} value={el.thickness ?? DEFAULT_THICKNESS_MM} min={0.1} step={0.05} onChange={thickness => update({ thickness })} />}
          </Field>
        </Section>
      )}

      {el.type === 'barcode' && (
        <Section title={t('tools.barcode')}>
          <Field label={t('properties.barcodeType')}>
            {id => (
              <SelectInput id={id} value={el.barcodeType ?? 'code128'}
                onChange={barcodeType => update(barcodeType === 'qr' ? { barcodeType, magnification: el.magnification ?? 4, height: el.width } : { barcodeType, moduleWidth: el.moduleWidth ?? 2 })}>
                <option value="code128">Code 128</option>
                <option value="qr">QR</option>
              </SelectInput>
            )}
          </Field>
          {isQr ? (
            <Field label={t('properties.magnification')} hint={t('properties.magnificationHint')}>
              {id => <NumberInput id={id} value={el.magnification ?? 4} min={1} max={10} step={1} onChange={magnification => update({ magnification: Math.round(magnification) })} />}
            </Field>
          ) : (
            <>
              <Field label={t('properties.moduleWidth')}>
                {id => <NumberInput id={id} value={el.moduleWidth ?? 2} min={1} max={10} step={1} onChange={moduleWidth => update({ moduleWidth: Math.round(moduleWidth) })} />}
              </Field>
              <Checkbox label={t('properties.showLabel')} checked={el.showLabel !== false} onChange={showLabel => update({ showLabel })} />
            </>
          )}
        </Section>
      )}

      {el.type === 'image' && (
        <Section title={t('tools.image')}>
          <FieldPicker band={band} types={['image']} label={t('properties.imageField')} value={el.imageKey}
            onChange={imageKey => update({ imageKey: imageKey || undefined })} />
          <p className="text-[10px] text-gray-400">{t('properties.imageFieldHint')}</p>
          {!el.imageKey && (
            <>
              <Field label={t('properties.upload')}>
                {id => <input id={id} type="file" accept="image/*" className="text-xs w-full" onChange={e => { void uploadImage(e.target.files?.[0]); e.target.value = ''; }} />}
              </Field>
              {imageError && <p className="text-xs text-red-600">{imageError}</p>}
              {el.bitmap && (
                <Field label={t('properties.threshold')} hint={t('properties.thresholdHint')}>
                  {id => <input id={id} type="range" min={16} max={240} step={4} value={el.threshold ?? 128} className="w-full accent-blue-600" onChange={e => update({ threshold: Number(e.target.value) })} />}
                </Field>
              )}
            </>
          )}
        </Section>
      )}

      <Section title={t('condition.title')}>
        <ConditionEditor band={band} value={el.condition} onChange={condition => update({ condition })} />
      </Section>

      <Section title={t('properties.zpl')}>
        <ZplCode zpl={elementLines(el, dpi).join('\n')} className="max-h-32" />
      </Section>

      <div className="grid grid-cols-3 gap-2">
        <Button size="sm" variant="outline" title={t('properties.duplicate')} onClick={() => s.duplicateSelection()}><Copy size={14} /></Button>
        <Button size="sm" variant="outline" title={t('properties.toFront')} onClick={() => s.reorderElement(band.id, el.id, 'front')}><BringToFront size={14} /></Button>
        <Button size="sm" variant="outline" title={t('properties.toBack')} onClick={() => s.reorderElement(band.id, el.id, 'back')}><SendToBack size={14} /></Button>
      </div>
      <Button variant="outline" className="w-full text-red-600 border-red-200 hover:bg-red-50" disabled={locked} onClick={() => s.removeElements(band.id, [el.id])}>
        <Trash2 size={14} className="mr-2" />{t('properties.delete')}
      </Button>
    </div>
  );
}
