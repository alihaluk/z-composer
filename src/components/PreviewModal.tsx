import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { fillTemplate } from '../lib/zplFill';
import { generateTemplateZpl } from '../lib/zplTemplate';
import { parseZpl } from '../preview/zplParser';
import { renderZpl } from '../preview/zplRenderer';
import { useEditor, useEditorStore, type CanvasMode } from '../store/editorStore';
import { Button } from './ui/Button';
import { Segmented } from './ui/Field';
import { CultureInput } from './ui/CultureInput';
import { ZplCode } from './properties/ZplCode';

export const PreviewModal = () => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<CanvasMode>('sample');
  const [rendered, setRendered] = useState<{ zpl: string; ok: boolean } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const template = useEditor(s => s.template);
  const catalog = useEditor(s => s.catalog);
  const locale = useEditor(s => s.previewLocale);
  const store = useEditorStore();

  // The code panel shows the template; the image shows what a printer would print.
  const templateZpl = useMemo(() => (isOpen ? generateTemplateZpl(template) : ''), [isOpen, template]);
  const previewZpl = useMemo(() => {
    if (!isOpen) return '';
    // Dynamic images have no sample data; they are previewed as an outlined area.
    const fill = (data: unknown) => fillTemplate(templateZpl, data, { locale, image: (_key, w, h) => `^GB${w},${h},1` });
    return mode === 'sample' ? fill(catalog.sample ?? {}) : templateZpl;
  }, [isOpen, mode, templateZpl, catalog.sample, locale]);

  const status = rendered?.zpl !== previewZpl ? 'rendering' : rendered.ok ? 'done' : 'failed';

  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;
    let cancelled = false;
    renderZpl(parseZpl(previewZpl), canvasRef.current)
      .then(() => { if (!cancelled) setRendered({ zpl: previewZpl, ok: true }); })
      .catch((e) => {
        console.error('Preview error:', e);
        if (!cancelled) setRendered({ zpl: previewZpl, ok: false });
      });
    return () => { cancelled = true; };
  }, [isOpen, previewZpl]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  return (
    <>
      <Button onClick={() => setIsOpen(true)} className="w-full bg-green-600 hover:bg-green-700 text-white shadow-sm">{t('preview.button')}</Button>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={t('preview.title')}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
            <div className="p-3 border-b flex justify-between items-center gap-3 bg-gray-50">
              <h2 className="text-lg font-bold text-gray-800">{t('preview.title')}</h2>
              <div className="flex items-center gap-3">
                <div className="w-56">
                  <Segmented<CanvasMode> label={t('preview.title')} value={mode} onChange={setMode}
                    options={[{ value: 'sample', label: t('preview.sampleData') }, { value: 'fields', label: t('preview.fieldNames') }]} />
                </div>
                <div className="w-28"><CultureInput label={t('preview.culture')} value={locale} onChange={l => store.getState().setPreviewLocale(l)} /></div>
                <Button variant="ghost" autoFocus onClick={() => setIsOpen(false)}>{t('preview.close')}</Button>
              </div>
            </div>
            <div className="flex-1 flex overflow-hidden">
              <div className="w-1/2 p-4 border-r overflow-auto bg-gray-50">
                <h3 className="font-bold mb-2 text-xs text-gray-500 uppercase">{t('preview.generatedCode')}</h3>
                <ZplCode zpl={templateZpl} className="h-auto" />
              </div>
              <div className="w-1/2 p-4 flex flex-col items-center gap-3 bg-gray-200 overflow-auto">
                <p className="text-[11px] text-gray-500 text-center">{t('preview.approximate')}</p>
                {status === 'rendering' && (
                  <div className="flex flex-col items-center gap-2 mt-20">
                    <Loader2 className="animate-spin text-gray-500" size={32} />
                    <span className="text-gray-500 text-sm">{t('preview.rendering')}</span>
                  </div>
                )}
                {status === 'failed' && <span className="text-red-500 mt-20">{t('preview.failed')}</span>}
                <canvas ref={canvasRef} aria-label={t('preview.image')} className={cn('shadow-2xl border-2 border-white max-w-full h-auto', status !== 'done' && 'hidden')} />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
