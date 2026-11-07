import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText } from 'lucide-react';
import { presetBandNames } from '../lib/bandNames';
import { PRESETS, type Preset } from '../lib/presets';
import { useEditorStore } from '../store/editorStore';
import { Button, type ButtonProps } from './ui/Button';
import { Dialog } from './ui/Dialog';

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

/** A button that opens the list of ready-made templates; choosing one replaces the design. */
export function PresetPicker({ catalogEditable, label, ...button }: Omit<ButtonProps, 'onClick'> & { catalogEditable: boolean; label: string }) {
  const { t } = useTranslation();
  const store = useEditorStore();
  const [open, setOpen] = useState(false);

  const apply = (preset: Preset) => {
    const s = store.getState();
    // Each template comes with its own catalog. A catalog of another template is replaced without
    // asking; the user's own catalog only when they agree. A host that locks the catalog keeps it.
    if (catalogEditable && !same(s.catalog, preset.catalog)) {
      const ownCatalog = !PRESETS.some(p => same(s.catalog, p.catalog));
      if (!ownCatalog || window.confirm(t('presets.replaceCatalog', { current: s.catalog.name, catalog: preset.catalog.name }))) s.setCatalog(preset.catalog);
    }
    s.setTemplate(preset.build(presetBandNames(t)), t(`presets.${preset.id}.name`));
    setOpen(false);
  };

  return (
    <>
      <Button {...button} onClick={() => setOpen(true)}>{label}</Button>
      {open && (
        <Dialog label={t('presets.title')} onClose={() => setOpen(false)} className="max-w-xl h-auto max-h-[85vh]">
          <div className="p-3 border-b flex justify-between items-center bg-gray-50">
            <h2 className="text-lg font-bold text-gray-800">{t('presets.title')}</h2>
            <Button variant="ghost" autoFocus onClick={() => setOpen(false)}>{t('presets.close')}</Button>
          </div>
          <div className="p-4 space-y-2 overflow-y-auto">
            <p className="text-xs text-gray-500">{t('presets.hint')}</p>
            <ul className="space-y-2">
              {PRESETS.map(preset => (
                <li key={preset.id}>
                  <button type="button" onClick={() => apply(preset)}
                    className="w-full flex items-start gap-3 text-left rounded-md border p-3 hover:border-blue-400 hover:bg-blue-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                    <FileText size={18} aria-hidden className="shrink-0 mt-0.5 text-blue-600" />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-gray-800">{t(`presets.${preset.id}.name`)}</span>
                      <span className="block text-xs text-gray-600">{t(`presets.${preset.id}.description`)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Dialog>
      )}
    </>
  );
}
