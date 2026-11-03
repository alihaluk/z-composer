import { useId, useState } from 'react';
import { PREVIEW_LOCALES } from '../../lib/constants';
import { canonicalCulture } from '../../lib/formats';
import { cn } from '../../lib/utils';

/** A culture picker with common suggestions that also accepts any culture the browser supports. */
export function CultureInput({ id, value, onChange, className, label }: { id?: string; value: string; onChange: (culture: string) => void; className?: string; label?: string }) {
  const listId = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const invalid = draft !== null && canonicalCulture(draft) === null;
  return (
    <>
      <input
        id={id}
        aria-label={label}
        list={listId}
        value={draft ?? value}
        spellCheck={false}
        className={cn('h-8 w-full rounded-md border border-input bg-white px-2 text-sm', invalid && 'border-red-400', className)}
        onFocus={() => setDraft(value)}
        onBlur={() => setDraft(null)}
        onChange={e => {
          setDraft(e.target.value);
          const culture = canonicalCulture(e.target.value);
          if (culture) onChange(culture);
        }}
      />
      <datalist id={listId}>{PREVIEW_LOCALES.map(l => <option key={l} value={l} />)}</datalist>
    </>
  );
}
