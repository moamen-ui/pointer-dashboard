import { type ReactNode } from 'react';
import { Archive, Circle, CircleCheck, CircleX, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StateTone = 'open' | 'ready' | 'completed' | 'archived' | 'danger' | 'neutral';

export const toneClasses: Record<StateTone, string> = {
  open: 'text-state-open',
  ready: 'text-state-ready',
  completed: 'text-state-completed',
  archived: 'text-state-archived',
  danger: 'text-state-danger',
  neutral: 'text-foreground',
};

const toneIcons: Record<StateTone, React.ComponentType<{ className?: string }> | null> = {
  open: Circle,
  ready: Clock,
  completed: CircleCheck,
  archived: Archive,
  danger: CircleX,
  neutral: null,
};

/** The diff hue for a tone, as a text class — the one vocabulary status labels and counts share. */
export function toneTextClass(tone: StateTone): string {
  return toneClasses[tone];
}

/** A status column's header band: the state's tint behind its hue, so the review queue reads as
 *  four colour zones instead of one gray strip. Every pair clears 4.5:1 in both themes. */
const toneHeaderClasses: Record<StateTone, string> = {
  open: 'bg-state-open-tint text-state-open',
  ready: 'bg-state-ready-tint text-state-ready',
  completed: 'bg-state-completed-tint text-state-completed',
  archived: 'bg-state-archived-tint text-state-archived',
  danger: 'bg-state-danger-tint text-state-danger',
  neutral: '',
};

export function toneHeaderClass(tone: StateTone): string {
  return toneHeaderClasses[tone];
}

/** Built-in status values (1 open, 2 ready, 3 completed, 4 archived) mapped to their diff hue. */
export function statusTone(value: number | undefined): StateTone {
  switch (value) {
    case 1: return 'open';
    case 2: return 'ready';
    case 3: return 'completed';
    case 4: return 'archived';
    default: return 'neutral';
  }
}

/**
 * Count cell content (§3): mono number; when > 0 it takes the state hue and a 12px glyph, when 0 it is
 * faint with no glyph. `color` (a status-catalog hex) overrides the tone hue; the glyph still follows the tone.
 */
export function CountCell({
  count,
  tone = 'neutral',
  color,
  className,
}: {
  count: number;
  tone?: StateTone;
  color?: string | null;
  className?: string;
}) {
  if (count === 0) {
    return <span className={cn('font-mono text-[14px] text-faint-foreground', className)}>0</span>;
  }
  const Icon = toneIcons[tone];
  return (
    <span
      className={cn('inline-flex items-center gap-1 font-mono text-[14px]', !color && toneClasses[tone], className)}
      style={color ? { color } : undefined}
    >
      {Icon && <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />}
      {count}
    </span>
  );
}

/**
 * Diffstat line (§3): `6 comments · 2 open · 1 ready …` — mono numbers in their state hue (or the
 * catalog color), sans labels in muted ink, faint middots between items.
 */
export function DiffstatLine({
  items,
  className,
}: {
  items: Array<{
    label: string;
    count: number | string;
    icon?: ReactNode;
    tone?: StateTone;
    color?: string | null;
  }>;
  className?: string;
}) {
  return (
    <div className={cn('text-[14px] flex flex-wrap gap-2 text-muted-foreground mb-6', className)}>
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-1">
          {idx > 0 && <span className="text-faint-foreground" aria-hidden="true">·</span>}
          {item.icon && <span className="flex items-center">{item.icon}</span>}
          <span
            className={cn('font-mono tabular-nums', !item.color && toneClasses[item.tone ?? 'neutral'])}
            style={item.color ? { color: item.color } : undefined}
          >
            {item.count}
          </span>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
