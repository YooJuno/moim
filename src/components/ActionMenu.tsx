import { useEffect, useId, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from './ui';

interface MenuAction { label: string; icon: LucideIcon; onSelect: () => void; danger?: boolean }

export function ActionMenu({ label, actions, disabled = false }: { label: string; actions: MenuAction[]; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => container.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus());
    const outside = (event: Event) => { if (!container.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('pointerdown', outside); document.removeEventListener('focusin', outside); };
  }, [open]);
  return <div ref={container} className="action-menu" onKeyDownCapture={event => {
    if (!open) return;
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const items = [...container.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []];
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
    items[next]?.focus();
  }}>
    <span ref={element => { trigger.current = element?.querySelector('button') ?? null; }}>
      <Button iconOnly variant="ghost" icon={MoreHorizontal} disabled={disabled} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
        onClick={() => setOpen(value => !value)} onKeyDown={event => { if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); setOpen(true); } }}>{label}</Button>
    </span>
    {open && <div id={id} role="menu" aria-label={label} className="action-menu-list">{actions.map(({ label: name, icon: Icon, onSelect, danger }) =>
      <button type="button" role="menuitem" className={danger ? 'is-danger' : undefined} key={name} onClick={() => { setOpen(false); onSelect(); }}><Icon size={17} aria-hidden="true"/>{name}</button>
    )}</div>}
  </div>;
}
