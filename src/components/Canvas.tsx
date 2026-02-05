import { useStore } from '../store/useStore';
import { CanvasSection } from './CanvasSection';
import { MM_TO_PX } from '../lib/constants';

export const Canvas = () => {
  const { header, body, footer } = useStore();
  const widthMm = 104; // 104mm is standard 4 inch
  const widthPx = widthMm * MM_TO_PX;

  return (
    <div className="flex flex-col shadow-lg border border-gray-300 bg-white" style={{ width: widthPx }}>
      <CanvasSection name="header" state={header} width={widthPx} className="border-b-2 border-gray-800" />
      <CanvasSection name="body" state={body} width={widthPx} className="bg-yellow-50/30" />
      <CanvasSection name="footer" state={footer} width={widthPx} className="border-t-2 border-gray-800" />
    </div>
  );
};
