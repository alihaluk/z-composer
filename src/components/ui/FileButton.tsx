import { useRef, type ReactNode } from 'react';
import { Button, type ButtonProps } from './Button';

/** A real button that opens a file dialog, so it works with the keyboard and screen readers. */
export function FileButton({ accept, onFile, children, ...props }: Omit<ButtonProps, 'onClick'> & { accept: string; onFile: (file: File) => void; children: ReactNode }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button type="button" {...props} onClick={() => input.current?.click()}>{children}</Button>
      <input
        ref={input}
        type="file"
        accept={accept}
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onFile(file);
        }}
      />
    </>
  );
}
