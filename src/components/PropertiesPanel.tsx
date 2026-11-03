import { useTranslation } from 'react-i18next';
import { AlignCenterVertical, AlignEndVertical, AlignStartHorizontal, AlignStartVertical, Copy, Trash2 } from 'lucide-react';
import { bandOf, useEditor, useEditorStore, useSelectedBand, useSelectedElements } from '../store/editorStore';
import { type TemplateElement } from '../types';
import { Button } from './ui/Button';
import { Section } from './ui/Field';
import { BandProperties } from './properties/BandProperties';
import { ElementProperties } from './properties/ElementProperties';
import { TemplateSettings } from './properties/TemplateSettings';

type AlignTo = 'left' | 'center' | 'right' | 'top';

function MultiSelection({ bandId, elements }: { bandId: string; elements: TemplateElement[] }) {
  const { t } = useTranslation();
  const s = useEditorStore().getState();
  const movable = elements.filter(el => !el.locked);
  // Tops of different bands are not comparable, so aligning tops needs one band.
  const oneBand = useEditor(st => new Set(elements.map(el => bandOf(st.template, el.id)?.id)).size === 1);

  const align = (to: AlignTo) => {
    const left = Math.min(...movable.map(el => el.x));
    const right = Math.max(...movable.map(el => el.x + el.width));
    const top = Math.min(...movable.map(el => el.y));
    const patches: Record<string, Partial<TemplateElement>> = {};
    for (const el of movable) {
      const x = to === 'left' ? left : to === 'right' ? right - el.width : to === 'center' ? (left + right) / 2 - el.width / 2 : el.x;
      patches[el.id] = { x: Math.round(x * 100) / 100, y: to === 'top' ? top : el.y };
    }
    s.patchElements(patches);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-800">{t('selection.count', { count: elements.length })}</h3>
        <Button size="sm" variant="ghost" onClick={() => s.select({ bandId, ids: [] })}>{t('properties.close')}</Button>
      </div>
      <Section title={t('selection.align')}>
        <div className="grid grid-cols-4 gap-2">
          <Button size="sm" variant="outline" title={t('selection.alignLeft')} onClick={() => align('left')}><AlignStartVertical size={14} /></Button>
          <Button size="sm" variant="outline" title={t('selection.alignCenter')} onClick={() => align('center')}><AlignCenterVertical size={14} /></Button>
          <Button size="sm" variant="outline" title={t('selection.alignRight')} onClick={() => align('right')}><AlignEndVertical size={14} /></Button>
          <Button size="sm" variant="outline" title={oneBand ? t('selection.alignTop') : t('selection.alignTopOneBand')} disabled={!oneBand} onClick={() => align('top')}><AlignStartHorizontal size={14} /></Button>
        </div>
      </Section>
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="outline" onClick={() => s.duplicateSelection()}><Copy size={14} className="mr-1" />{t('properties.duplicate')}</Button>
        <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => s.deleteElements(movable.map(el => el.id))}>
          <Trash2 size={14} className="mr-1" />{t('properties.delete')}
        </Button>
      </div>
      <p className="text-[10px] text-gray-500">{t('selection.hint')}</p>
    </div>
  );
}

export const PropertiesPanel = () => {
  const band = useSelectedBand();
  const elements = useSelectedElements();
  const elementBand = useEditor(s => (elements.length === 1 ? bandOf(s.template, elements[0].id) : undefined));
  return (
    <div className="p-4">
      {!band ? <TemplateSettings />
        : elements.length === 0 ? <BandProperties band={band} />
          : elements.length === 1 && elementBand ? <ElementProperties key={elements[0].id} band={elementBand} element={elements[0]} />
            : <MultiSelection bandId={band.id} elements={elements} />}
    </div>
  );
};
