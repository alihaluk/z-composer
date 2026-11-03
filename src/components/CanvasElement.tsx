import { useState, type CSSProperties, type PointerEvent } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Lock } from 'lucide-react';
import { cn } from '../lib/utils';
import { mmToDots, mmToPx, pxToMm, roundMm } from '../lib/constants';
import { displayText, hiddenInSample } from '../lib/elementDisplay';
import { DEFAULT_FONT_MM, DEFAULT_THICKNESS_MM, textMetrics } from '../lib/zplTemplate';
import { useEditor, useEditorStore } from '../store/editorStore';
import { type Band, type Dpi, type TemplateElement } from '../types';

export const CANVAS_FONT = '"Roboto Condensed", "Arial Narrow", sans-serif';
const MIN_SIZE_MM = 1;

interface Props {
  element: TemplateElement;
  band: Band;
  /** Extra offset from a growing text above this element (sample mode). */
  offsetY?: number;
  /** Wrapped lines of a growing text, broken like the filler does. */
  lines?: string[];
}

export function CanvasElement({ element: el, band, offsetY = 0, lines }: Props) {
  const store = useEditorStore();
  const selected = useEditor(s => s.selection?.bandId === band.id && s.selection.ids.includes(el.id));
  const zoom = useEditor(s => s.zoom);
  const catalog = useEditor(s => s.catalog);
  const mode = useEditor(s => s.canvasMode);
  const locale = useEditor(s => s.previewLocale);
  const dpi = useEditor(s => s.template.printer.dpi);
  const [resize, setResize] = useState<{ width: number; height: number } | null>(null);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${band.id}:${el.id}`,
    data: { type: 'element', bandId: band.id, id: el.id },
    disabled: el.locked,
  });

  const width = resize?.width ?? el.width;
  const height = resize?.height ?? el.height;

  // The size follows the pointer locally and is stored once, as one undo step.
  const startResize = (e: PointerEvent) => {
    e.stopPropagation();
    if (el.locked) return;
    const start = { x: e.clientX, y: e.clientY };
    let latest = { width: el.width, height: el.height };
    const move = (ev: globalThis.PointerEvent) => {
      latest = {
        width: Math.max(MIN_SIZE_MM, roundMm(el.width + pxToMm((ev.clientX - start.x) / zoom))),
        height: Math.max(el.type === 'box' ? 0.1 : MIN_SIZE_MM, roundMm(el.height + pxToMm((ev.clientY - start.y) / zoom))),
      };
      setResize(latest);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setResize(null);
      const patch: Partial<TemplateElement> = el.barcodeType === 'qr' ? { width: latest.width, height: latest.width } : latest;
      store.getState().updateElement(band.id, el.id, patch);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const select = (e: React.MouseEvent) => {
    e.stopPropagation();
    const { selection, select } = store.getState();
    if ((e.shiftKey || e.metaKey || e.ctrlKey) && selection?.bandId === band.id) {
      const ids = selection.ids.includes(el.id) ? selection.ids.filter(id => id !== el.id) : [...selection.ids, el.id];
      select({ bandId: band.id, ids });
    } else if (!selected || (selection?.ids.length ?? 0) > 1) {
      select({ bandId: band.id, ids: [el.id] });
    }
  };

  const hidden = hiddenInSample(el, band, catalog, mode);
  const style: CSSProperties = {
    position: 'absolute',
    left: mmToPx(el.x),
    top: mmToPx(el.y + offsetY),
    width: mmToPx(width),
    height: mmToPx(height),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group select-none outline outline-1 outline-transparent hover:outline-blue-300',
        el.locked ? 'cursor-default' : 'cursor-move',
        selected && 'outline-blue-500 outline-2 bg-blue-50/40 z-10',
        isDragging && 'opacity-20',
        hidden && 'opacity-30',
      )}
      onClick={select}
      {...listeners}
      {...attributes}
    >
      <ElementBody element={el} band={band} text={lines ? lines.join('\n') : displayText(el, band, catalog, mode, locale)} dpi={dpi} preformatted={!!lines} />
      {el.condition?.path && (
        <span title={`${el.condition.path} ${el.condition.op}`} className="absolute top-0 left-0 w-0 h-0 border-t-[5px] border-r-[5px] border-t-amber-500 border-r-transparent" />
      )}
      {el.locked && <Lock size={8} className="absolute -top-2.5 right-0 text-gray-500 pointer-events-none" />}
      {selected && !el.locked && (
        <div
          role="presentation"
          className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-nwse-resize z-20"
          onPointerDown={startResize}
          onMouseDown={e => e.stopPropagation()}
        />
      )}
    </div>
  );
}

export function ElementBody({ element: el, text, dpi, preformatted }: { element: TemplateElement; band?: Band; text: string; dpi: Dpi; preformatted?: boolean }) {
  if (el.type === 'box') {
    const t = Math.max(1, mmToPx(el.thickness ?? DEFAULT_THICKNESS_MM));
    const filled = t * 2 >= Math.min(mmToPx(el.width), mmToPx(el.height));
    return <div className="w-full h-full" style={filled ? { background: '#000' } : { border: `${t}px solid #000` }} />;
  }
  if (el.type === 'barcode') {
    if (el.barcodeType === 'qr') {
      return (
        <div className="w-full h-full grid place-items-center bg-[repeating-conic-gradient(#000_0_25%,#fff_0_50%)] bg-[length:12.5%_12.5%] opacity-80">
          <span className="bg-white text-[8px] px-0.5 font-mono truncate max-w-full">{text || 'QR'}</span>
        </div>
      );
    }
    return (
      <div className="w-full h-full flex flex-col">
        <div className="flex-1 bg-[repeating-linear-gradient(90deg,#000_0_2px,#fff_2px_3px,#000_3px_4px,#fff_4px_7px)]" />
        {el.showLabel !== false && <span className="text-[8px] font-mono text-center truncate leading-tight">{text}</span>}
      </div>
    );
  }
  if (el.type === 'image') {
    if (el.imageBase64 && !el.imageKey) return <img src={el.imageBase64} alt="" className="w-full h-full object-contain pointer-events-none" style={{ filter: 'grayscale(1) contrast(4)' }} />;
    return (
      <div className="w-full h-full border border-dashed border-slate-400 bg-slate-50 grid place-items-center overflow-hidden">
        <span className="text-[8px] text-slate-500 text-center px-0.5 truncate">{el.imageKey ?? 'IMAGE'}</span>
      </div>
    );
  }

  const metrics = textMetrics(el, dpi);
  const fontPx = mmToPx(el.fontSize ?? DEFAULT_FONT_MM);
  const lineHeightPx = (metrics.lineHeight / metrics.height) * fontPx;
  const wraps = el.overflow === 'wrap';
  const maxLines = Math.max(1, el.maxLines ?? 2);
  const rotation = el.rotation ?? 0;
  // ^FO is the top-left corner of the rotated text, so the text is laid out unrotated in a box
  // whose rotated outline is the element box, then turned into place.
  const sideways = rotation === 90 || rotation === 270;
  const boxW = mmToPx(sideways ? el.height : el.width);
  const boxH = mmToPx(sideways ? el.width : el.height);
  const placement = {
    0: undefined,
    90: `translate(${boxH}px, 0) rotate(90deg)`,
    180: `translate(${boxW}px, ${boxH}px) rotate(180deg)`,
    270: `translate(0, ${boxW}px) rotate(-90deg)`,
  }[rotation];
  return (
    <div className="w-full h-full relative overflow-visible">
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: rotation ? boxW : '100%',
          height: rotation ? boxH : '100%',
          fontFamily: CANVAS_FONT,
          fontWeight: 700,
          fontSize: fontPx,
          lineHeight: `${lineHeightPx}px`,
          textAlign: el.align ?? 'left',
          whiteSpace: preformatted ? 'pre' : wraps ? 'normal' : 'pre',
          wordBreak: wraps ? 'break-word' : undefined,
          WebkitTextStroke: el.fontBold ? `${mmToPx(1 / (mmToDots(1, dpi) || 8)) * 0.6}px #000` : undefined,
          maxHeight: wraps && !el.grow ? lineHeightPx * maxLines : undefined,
          overflow: wraps && !el.grow ? 'hidden' : 'visible',
          transform: placement,
          transformOrigin: 'top left',
        }}
      >
        {text}
      </div>
    </div>
  );
}
