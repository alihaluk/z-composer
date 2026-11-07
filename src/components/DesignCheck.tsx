import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { withRootPrefix, type DesignIssue } from '../lib/designCheck';
import { cn } from '../lib/utils';
import { DesignIssuesContext, useCheckedDesign, useDesignIssues } from '../store/designIssues';
import { useEditor, useEditorStore } from '../store/editorStore';
import { Button } from './ui/Button';
import { Section } from './ui/Field';

/** Runs the design check once for the whole designer. */
export function DesignIssuesProvider({ children }: { children: ReactNode }) {
  return <DesignIssuesContext.Provider value={useCheckedDesign()}>{children}</DesignIssuesContext.Provider>;
}

/** The message of a finding, e.g. "The sample text does not fit: 41.2 mm, room 32 mm". */
export function IssueMessage({ issue }: { issue: DesignIssue }) {
  const { t, i18n } = useTranslation();
  // Millimetres in the interface language: 41,2 in Turkish.
  const n = (v: number | undefined) => v?.toLocaleString(i18n.resolvedLanguage);
  return <>{t(`check.${issue.kind}`, { path: issue.path, value: n(issue.value), limit: n(issue.limit), text: issue.text })}</>;
}

const IssueIcon = ({ issue }: { issue: DesignIssue }) => issue.severity === 'error'
  ? <AlertCircle size={13} aria-hidden className="shrink-0 mt-px text-red-600" />
  : <AlertTriangle size={13} aria-hidden className="shrink-0 mt-px text-amber-600" />;

/** One finding; with `locate` it names the band and element and selects them on click. */
function IssueRow({ issue, locate }: { issue: DesignIssue; locate: boolean }) {
  const { t } = useTranslation();
  const store = useEditorStore();
  const band = useEditor(s => s.template.bands.find(b => b.id === issue.bandId));
  const el = band?.elements.find(e => e.id === issue.elementId);
  if (!band) return null;
  const what = el ? t(`tools.${el.type === 'barcode' && el.barcodeType === 'qr' ? 'qr' : el.type}`) : t('check.bandItself');
  const fix = issue.kind === 'rootPrefix' && el && issue.path
    ? () => store.getState().updateElement(band.id, el.id, withRootPrefix(el, issue.path!))
    : undefined;
  const body = (
    <span className="min-w-0 flex-1 space-y-0.5">
      {locate && <span className="block text-[10px] font-semibold text-gray-500">{band.name} · {what}</span>}
      <span className="block text-[11px] leading-snug text-gray-800 break-words"><IssueMessage issue={issue} /></span>
    </span>
  );
  return (
    <li className="flex items-start gap-1.5">
      {locate ? (
        <button type="button" className="flex flex-1 min-w-0 items-start gap-1.5 text-left rounded px-1 py-1 hover:bg-gray-100"
          onClick={() => store.getState().select({ bandId: band.id, ids: el ? [el.id] : [] })}>
          <IssueIcon issue={issue} />{body}
        </button>
      ) : <span className="flex flex-1 min-w-0 items-start gap-1.5 px-1 py-1"><IssueIcon issue={issue} />{body}</span>}
      {fix && <Button size="sm" variant="outline" className="h-6 px-2 text-[11px] mt-1" onClick={fix}>{t('check.fix')}</Button>}
    </li>
  );
}

/** All findings, for the template settings. */
export function DesignCheckSection() {
  const { t } = useTranslation();
  const issues = useDesignIssues();
  const errors = issues.filter(i => i.severity === 'error').length;
  // With nothing to fix the top bar says so; the panel keeps its room for the settings.
  if (issues.length === 0) return null;
  return (
    <Section title={t('check.title')}>
      <p className="text-[11px] text-gray-600">{t('check.summary', { errors, warnings: issues.length - errors })}</p>
      <ul className="max-h-72 overflow-y-auto space-y-0.5" aria-label={t('check.title')}>
        {issues.map((issue, i) => <IssueRow key={i} issue={issue} locate />)}
      </ul>
    </Section>
  );
}

/** Findings of one element or band, shown in its properties. */
export function OwnIssues({ issues }: { issues: DesignIssue[] }) {
  const { t } = useTranslation();
  if (issues.length === 0) return null;
  return (
    <ul className={cn('rounded border p-1 space-y-0.5', issues.some(i => i.severity === 'error') ? 'border-red-200 bg-red-50/60' : 'border-amber-200 bg-amber-50/60')}
      aria-label={t('check.title')}>
      {issues.map((issue, i) => <IssueRow key={i} issue={issue} locate={false} />)}
    </ul>
  );
}

/** The design check's state: the number of findings, or that there are none; it opens the list. */
export function DesignCheckButton() {
  const { t } = useTranslation();
  const store = useEditorStore();
  const issues = useDesignIssues();
  const errors = issues.some(i => i.severity === 'error');
  const state = issues.length === 0 ? 'none' : errors ? 'errors' : 'warnings';
  return (
    <button type="button" title={t('check.open')} aria-label={`${t('check.open')}: ${issues.length ? t('check.count', { count: issues.length }) : t('check.none')}`}
      className={cn('flex items-center gap-1 h-8 px-2 rounded text-xs font-semibold whitespace-nowrap hover:bg-gray-100',
        { none: 'text-green-700', errors: 'text-red-600', warnings: 'text-amber-700' }[state])}
      onClick={() => store.getState().select(null)}>
      {state === 'none' ? <CheckCircle2 size={15} aria-hidden /> : state === 'errors' ? <AlertCircle size={15} aria-hidden /> : <AlertTriangle size={15} aria-hidden />}
      {issues.length ? t('check.count', { count: issues.length }) : <span className="hidden xl:inline">{t('check.none')}</span>}
    </button>
  );
}
