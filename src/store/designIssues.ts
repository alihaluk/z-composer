import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { barcodeSamples, checkDesign, type DesignIssue } from '../lib/designCheck';
import { measureBarcode } from '../preview/zplRenderer';
import { useEditor } from './editorStore';

/** The design check's findings for the whole template, provided once by ZComposer. */
export const DesignIssuesContext = createContext<DesignIssue[]>([]);

export const useDesignIssues = () => useContext(DesignIssuesContext);

/** Findings for one element. */
export const useElementIssues = (elementId: string) => useDesignIssues().filter(i => i.elementId === elementId);

/** Runs the design check whenever the template, catalog or preview culture change. */
export function useCheckedDesign(): DesignIssue[] {
  const template = useEditor(s => s.template);
  const catalog = useEditor(s => s.catalog);
  const locale = useEditor(s => s.previewLocale);

  // Barcode widths are measured with the encoders, which load on demand.
  const samples = useMemo(() => barcodeSamples(template, catalog, locale), [template, catalog, locale]);
  const key = JSON.stringify(samples.map(s => [s.id, s.kind, s.text, s.element.moduleWidth, s.element.magnification]));
  const [measured, setMeasured] = useState<{ key: string; widths: Record<string, number> } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void Promise.all(samples.map(async s => [s.id, (await measureBarcode(s.kind, s.text, { moduleWidth: s.element.moduleWidth, magnification: s.element.magnification }))?.width] as const))
      .then(entries => {
        if (!cancelled) setMeasured({ key, widths: Object.fromEntries(entries.filter((e): e is readonly [string, number] => e[1] !== undefined)) });
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the key covers what the samples measure
  }, [key]);

  const widths = measured?.key === key ? measured.widths : undefined;
  return useMemo(() => checkDesign(template, catalog, locale, widths), [template, catalog, locale, widths]);
}
