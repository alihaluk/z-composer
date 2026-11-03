import { useTranslation } from 'react-i18next';
import { useEditor } from '../store/editorStore';

export function CatalogPanel() {
  const { t } = useTranslation();
  const catalog = useEditor(s => s.catalog);
  return (
    <section className="space-y-1">
      <h3 className="text-xs font-semibold text-gray-400 uppercase">{t('catalog.title')}</h3>
      <p className="text-xs text-gray-700 truncate" title={catalog.name}>{catalog.name}</p>
    </section>
  );
}
