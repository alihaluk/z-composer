import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { dotsPerMm, roundMm } from '../../lib/constants';
import { displayText } from '../../lib/elementDisplay';
import { measureBarcode } from '../../preview/zplRenderer';
import { useEditor, useEditorStore } from '../../store/editorStore';
import { type Band, type TemplateElement } from '../../types';
import { Button } from '../ui/Button';

/** Shows how large a barcode prints with the sample data and fits the canvas box to it. */
export function BarcodeSize({ band, element: el }: { band: Band; element: TemplateElement }) {
  const { t } = useTranslation();
  const store = useEditorStore();
  const catalog = useEditor(s => s.catalog);
  const locale = useEditor(s => s.previewLocale);
  const dpi = useEditor(s => s.template.printer.dpi);
  const [size, setSize] = useState<{ key: string; width: number; height: number } | null>(null);
  const isQr = el.barcodeType === 'qr';
  const text = displayText(el, band, catalog, 'sample', locale);
  const heightDots = Math.round(el.height * dotsPerMm(dpi));
  const key = [el.barcodeType, text, el.moduleWidth, el.magnification, el.showLabel, heightDots].join('|');

  useEffect(() => {
    let cancelled = false;
    measureBarcode(isQr ? 'qr' : 'code128', text, { moduleWidth: el.moduleWidth, magnification: el.magnification, printText: el.showLabel !== false, height: heightDots })
      .then(r => { if (!cancelled && r) setSize({ key, ...r }); });
    return () => { cancelled = true; };
  }, [key, isQr, text, el.moduleWidth, el.magnification, el.showLabel, heightDots]);

  if (!size || size.key !== key) return null;
  const mm = (dots: number) => roundMm(dots / dotsPerMm(dpi));
  const fit = () => store.getState().updateElement(band.id, el.id, isQr ? { width: mm(size.width), height: mm(size.width) } : { width: mm(size.width) });

  return (
    <div className="flex items-center justify-between gap-2 text-[11px] text-gray-500">
      <span>{t('properties.printedSize', { width: mm(size.width), height: mm(size.height) })}</span>
      <Button type="button" size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={fit}>{t('properties.fitBox')}</Button>
    </div>
  );
}
