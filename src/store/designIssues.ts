import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { barcodeSamples, checkDesign, type DesignIssue } from '../lib/designCheck';
import { measureBarcode } from '../preview/zplRenderer';
import { useEditor } from './editorStore';

/** Whether barcode widths are known: being measured, measured, or the encoder could not be loaded. */
export type BarcodeCheck = 'measuring' | 'ready' | 'failed';

/** The design check's result for the whole template, provided once by ZComposer. */
export const DesignIssuesContext = createContext<{ issues: DesignIssue[]; barcodes: BarcodeCheck }>({ issues: [], barcodes: 'ready' });

export const useDesignIssues = () => useContext(DesignIssuesContext).issues;

export const useBarcodeCheck = () => useContext(DesignIssuesContext).barcodes;

/** Findings for one element. */
export const useElementIssues = (elementId: string) => useDesignIssues().filter(i => i.elementId === elementId);

/** Runs the design check whenever the template, catalog or preview culture change. */
export function useCheckedDesign(): { issues: DesignIssue[]; barcodes: BarcodeCheck } {
  const template = useEditor(s => s.template);
  const catalog = useEditor(s => s.catalog);
  const locale = useEditor(s => s.previewLocale);

  // Barcode widths are measured with the encoders, which load on demand.
  const samples = useMemo(() => barcodeSamples(template, catalog, locale), [template, catalog, locale]);
  const key = JSON.stringify(samples.map(s => [s.id, s.kind, s.texts, s.element.moduleWidth, s.element.magnification]));
  const [measured, setMeasured] = useState<{ key: string; widths: Record<string, number | null>; failed: boolean } | null>(null);
  useEffect(() => {
    let cancelled = false;
    // The widest row of each barcode decides; a row that cannot be encoded makes the barcode invalid.
    const measure = async (s: (typeof samples)[number]) => {
      const sizes = await Promise.all(s.texts.map(text => measureBarcode(s.kind, text, { moduleWidth: s.element.moduleWidth, magnification: s.element.magnification })));
      return [s.id, sizes.every(size => size) ? Math.max(...sizes.map(size => size!.width)) : null] as const;
    };
    void Promise.all(samples.map(measure)).then(
      entries => { if (!cancelled) setMeasured({ key, widths: Object.fromEntries(entries), failed: false }); },
      () => { if (!cancelled) setMeasured({ key, widths: {}, failed: true }); },
    );
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the key covers what the samples measure
  }, [key]);

  const current = measured?.key === key ? measured : undefined;
  const widths = current?.widths;
  const issues = useMemo(() => checkDesign(template, catalog, locale, widths), [template, catalog, locale, widths]);
  const barcodes: BarcodeCheck = samples.length === 0 ? 'ready' : !current ? 'measuring' : current.failed ? 'failed' : 'ready';
  return useMemo(() => ({ issues, barcodes }), [issues, barcodes]);
}
