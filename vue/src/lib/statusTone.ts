// The one state vocabulary shared by status labels, counts and chips.
//
// A tenant's status catalog carries its own hex, but DESIGN.md's Fixed Diff rule keeps the five
// diff hues fixed so state reads the same way in every tenant — and the catalog hexes fail WCAG AA
// as text anyway (#d97706 is 3.2:1 and #16a34a is 3.3:1 on the canvas). The catalog hex stays a
// swatch on the Statuses page; everything that paints text uses these tokens.

export type StateTone = 'open' | 'ready' | 'completed' | 'archived' | 'danger' | 'neutral';

const TONE_TEXT: Record<StateTone, string> = {
  open: 'text-state-open',
  ready: 'text-state-ready',
  completed: 'text-state-completed',
  archived: 'text-state-archived',
  danger: 'text-state-danger',
  neutral: 'text-foreground',
};

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

export function toneTextClass(tone: StateTone): string {
  return TONE_TEXT[tone];
}

/** A status column's header band: the state's tint behind its hue, so the review queue reads as
 *  four colour zones instead of one gray strip. Every pair clears 4.5:1 in both themes. */
const TONE_HEADER: Record<StateTone, string> = {
  open: 'bg-state-open-tint text-state-open',
  ready: 'bg-state-ready-tint text-state-ready',
  completed: 'bg-state-completed-tint text-state-completed',
  archived: 'bg-state-archived-tint text-state-archived',
  danger: 'bg-state-danger-tint text-state-danger',
  neutral: '',
};

export function toneHeaderClass(tone: StateTone): string {
  return TONE_HEADER[tone];
}
