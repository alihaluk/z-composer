import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/Button';
import { useStore } from '../store/useStore';
import { generateZPL } from '../lib/zplGenerator';
import { parseZpl } from '../preview/zplParser';
import { renderZpl } from '../preview/zplRenderer';
import { cn } from '../lib/utils';
import { Loader2 } from 'lucide-react';

const PREVIEW_ROWS = 3;

export const PreviewModal = () => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [useSampleData, setUseSampleData] = useState(true);
    const [rendered, setRendered] = useState<{ zpl: string; ok: boolean } | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const { header, body, footer, canvasWidth } = useStore();

    // The code panel shows the template; the image shows what the printer would print.
    const templateZpl = isOpen ? generateZPL(header, body, footer, 1, false, canvasWidth) : '';
    const previewZpl = isOpen ? generateZPL(header, body, footer, PREVIEW_ROWS, useSampleData, canvasWidth) : '';

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

    return (
        <>
            <Button onClick={() => setIsOpen(true)} className="w-full bg-green-600 hover:bg-green-700 text-white shadow-sm">
                {t('preview.button')}
            </Button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <h2 className="text-xl font-bold text-gray-800">{t('preview.title')}</h2>
                            <div className="flex items-center gap-3">
                                <div className="flex bg-gray-100 rounded p-0.5 gap-0.5">
                                    {[true, false].map(sample => (
                                        <button
                                            key={String(sample)}
                                            onClick={() => setUseSampleData(sample)}
                                            className={cn("text-xs px-2 h-7 rounded transition-colors", useSampleData === sample ? "bg-white shadow text-blue-600 font-bold" : "text-gray-500 hover:text-gray-700")}
                                        >
                                            {t(sample ? 'preview.sampleData' : 'preview.fieldNames')}
                                        </button>
                                    ))}
                                </div>
                                <Button variant="ghost" onClick={() => setIsOpen(false)}>{t('preview.close')}</Button>
                            </div>
                        </div>

                        <div className="flex-1 flex overflow-hidden">
                            <div className="w-1/2 p-4 border-r overflow-auto bg-gray-50">
                                <h3 className="font-bold mb-2 text-sm text-gray-500 uppercase">{t('preview.generatedCode')}</h3>
                                <pre className="text-xs font-mono whitespace-pre-wrap break-all bg-white p-2 border rounded text-gray-700">{templateZpl}</pre>
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
                                <canvas
                                    ref={canvasRef}
                                    aria-label={t('preview.title')}
                                    className={cn("shadow-2xl border-2 border-white max-w-full h-auto", status !== 'done' && "hidden")}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
