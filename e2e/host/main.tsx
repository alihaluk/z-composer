// A host application for the end-to-end tests: embeds the built package (dist-lib) the way the
// integration guide does. Query parameters choose the props.
import { createRoot } from 'react-dom/client';
import { ZComposer, invoicePreset, type Catalog, type Template, type ZComposerProps, type ZComposerSaveResult } from 'z-composer';
import 'z-composer/style.css';

interface HostState { saved: ZComposerSaveResult[]; changes: Template[] }
const state: HostState = { saved: [], changes: [] };
(window as unknown as { host: HostState }).host = state;

const q = new URLSearchParams(location.search);
const smallCatalog: Catalog = {
  catalogVersion: 1,
  name: 'Adisyon',
  fields: [{ path: 'Table', type: 'string', label: 'Masa' }, { path: 'Total', type: 'number', label: 'Toplam' }],
  sample: { Table: 'A4', Total: 1234.5 },
};

const props = (n: number): ZComposerProps => ({
  language: (q.get(`lang${n}`) ?? q.get('lang') ?? undefined) as ZComposerProps['language'],
  locale: q.get('locale') ?? undefined,
  storageKey: q.get('storage') === 'none' ? null : q.get('storage') ?? undefined,
  catalogEditable: q.get('catalog') !== 'locked',
  catalog: q.get('catalogData') === 'small' ? smallCatalog : undefined,
  template: q.get('template') === 'preset' ? invoicePreset() : undefined,
  onChange: t => state.changes.push(t),
  onSave: q.has('save') ? r => state.saved.push(r) : undefined,
});

const count = q.get('two') ? 2 : 1;
createRoot(document.getElementById('root')!).render(
  <div className="designers">
    {Array.from({ length: count }, (_, i) => <div key={i} data-designer={i + 1}><ZComposer {...props(i + 1)} /></div>)}
  </div>,
);
