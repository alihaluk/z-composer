import { useId, useState, type ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Label } from './Label';

export function Section({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="space-y-2 border-t pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{title}</h4>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, children, hint }: { label: string; children: (id: string) => ReactNode; hint?: string }) {
  const id = useId();
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs text-gray-600">{label}</Label>
      {children(id)}
      {hint && <p className="text-[10px] text-gray-400">{hint}</p>}
    </div>
  );
}

const inputClass = 'flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:opacity-50';

/** A number input that keeps what the user types until it is a valid number. */
export function NumberInput({ id, value, onChange, step = 0.1, min, max, disabled }: {
  id?: string; value: number | undefined; onChange: (v: number) => void; step?: number; min?: number; max?: number; disabled?: boolean;
}) {
  // While focused the input shows what is typed; otherwise it shows the stored value.
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      id={id}
      type="number"
      inputMode="decimal"
      className={inputClass}
      value={draft ?? (value === undefined ? '' : String(value))}
      step={step}
      min={min}
      max={max}
      disabled={disabled}
      onFocus={e => { setDraft(e.target.value); e.target.select(); }}
      onBlur={() => setDraft(null)}
      onChange={e => {
        setDraft(e.target.value);
        const n = Number(e.target.value.replace(',', '.'));
        if (e.target.value.trim() !== '' && Number.isFinite(n)) onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n)));
      }}
    />
  );
}

export function TextInput({ id, value, onChange, placeholder, disabled }: { id?: string; value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean }) {
  return <input id={id} className={inputClass} value={value} placeholder={placeholder} disabled={disabled} onChange={e => onChange(e.target.value)} />;
}

export function SelectInput<T extends string>({ id, value, onChange, children, disabled }: {
  id?: string; value: T; onChange: (v: T) => void; children: ReactNode; disabled?: boolean;
}) {
  return (
    <select id={id} className={cn(inputClass, 'pr-6')} value={value} disabled={disabled} onChange={e => onChange(e.target.value as T)}>
      {children}
    </select>
  );
}

export function Checkbox({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <input id={id} type="checkbox" className="h-4 w-4 accent-blue-600" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
      <Label htmlFor={id} className={cn('text-xs text-gray-700', disabled && 'opacity-50')}>{label}</Label>
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: ReactNode; title?: string }[]; onChange: (v: T) => void; label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex bg-gray-100 rounded p-0.5 gap-0.5">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn('flex-1 text-xs h-7 rounded transition-colors flex items-center justify-center', value === o.value ? 'bg-white shadow text-blue-600 font-semibold' : 'text-gray-500 hover:text-gray-700')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
