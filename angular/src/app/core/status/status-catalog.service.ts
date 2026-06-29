import { computed, Injectable } from '@angular/core';
import { getApiStatusesResource } from '@moamen-ui/pointer-angular';
import type { StatusItem } from '@moamen-ui/pointer-angular';

/** Fallback used when the API fetch is empty or fails. */
export const STATUS_FALLBACK: StatusItem[] = [
  { value: 1, name: 'Open',         label: 'Open',      color: '#2563eb', order: 1 },
  { value: 2, name: 'ReadyToApply', label: 'Ready',     color: '#d97706', order: 2 },
  { value: 3, name: 'Applied',      label: 'Completed', color: '#16a34a', order: 3 },
  { value: 4, name: 'Archived',     label: 'Archived',  color: '#6b7280', order: 4 },
];

@Injectable({ providedIn: 'root' })
export class StatusCatalogService {
  private readonly resource = getApiStatusesResource();

  /** All statuses sorted by `order`, falling back to STATUS_FALLBACK when empty/error. */
  readonly ordered = computed<StatusItem[]>(() => {
    const items = this.resource.value();
    const list = items && items.length > 0 ? items : STATUS_FALLBACK;
    return [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  });

  /** Re-fetch the status catalog from the API (call after a Save/Reset on the admin page). */
  reload(): void {
    this.resource.reload();
  }

  /** Human-readable label for a status value. Falls back to the value as a string. */
  label(value: number | undefined): string {
    if (value == null) return '';
    const found = this.ordered().find((s) => s.value === value);
    return found?.label ?? found?.name ?? String(value);
  }

  /** Hex color string for a status value. Falls back to #6b7280. */
  color(value: number | undefined): string {
    if (value == null) return '#6b7280';
    const found = this.ordered().find((s) => s.value === value);
    return found?.color ?? '#6b7280';
  }
}
