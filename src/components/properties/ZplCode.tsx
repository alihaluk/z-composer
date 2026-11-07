const MAX_CHARS = 6000;

/** ZPL with commands highlighted; long graphic data is shortened for display. */
export function ZplCode({ zpl, className = 'h-56' }: { zpl: string; className?: string }) {
  const shown = (zpl.length > MAX_CHARS ? `${zpl.slice(0, MAX_CHARS)}\n…` : zpl).replace(/(\^GFA,\d+,\d+,\d+,)([0-9A-F]{40})[0-9A-F]+/g, '$1$2…');
  return (
    // Focusable: a long template is scrolled with the keyboard too.
    <pre tabIndex={0} className={`text-[10px] leading-snug bg-gray-50 p-2 border rounded overflow-auto whitespace-pre-wrap break-all font-mono ${className}`}>
      {shown.split(/(\^[A-Z0-9@]{2}|\{\{.*?\}\})/g).map((part, i) =>
        part.startsWith('^') ? <span key={i} className="text-blue-700 font-semibold">{part}</span>
          : part.startsWith('{{') ? <span key={i} className="text-amber-700">{part}</span>
            : <span key={i} className="text-gray-600">{part}</span>)}
    </pre>
  );
}
