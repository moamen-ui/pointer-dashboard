import { computed, inject, Injectable } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { getApiStatusesResource } from '@moamen-ui/pointer-angular';
import type { StatusItem } from '@moamen-ui/pointer-angular';
import { PreferencesService } from '../prefs/preferences.service';

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
  private readonly transloco = inject(TranslocoService);
  private readonly prefs = inject(PreferencesService);

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

  /**
   * Label to *show a reader*, localized. The API stores one unlocalized `label`
   * per status, so an untouched built-in status is translated from its enum name
   * (`statuses.builtin.<Name>`) while an admin's custom label is shown verbatim —
   * an override is deliberate copy and must not be replaced by a translation.
   * Keyed by value and recomputed when the UI language changes.
   */
  private readonly displayLabels = computed<Record<number, string>>(() => {
    this.prefs.language(); // dependency: re-translate on a language switch
    const out: Record<number, string> = {};
    for (const st of this.ordered()) {
      if (st.value == null) continue;
      out[st.value] = this.translateLabel(st);
    }
    return out;
  });

  displayLabel(status: StatusItem): string {
    if (status.value == null) return status.label ?? status.name ?? '';
    return this.displayLabels()[status.value] ?? status.label ?? status.name ?? '';
  }

  /** Localized label for a status value (for callers that only hold the value). */
  displayLabelFor(value: number | undefined): string {
    if (value == null) return '';
    return this.displayLabels()[value] ?? this.label(value);
  }

  private translateLabel(status: StatusItem): string {
    const builtinDefault = STATUS_FALLBACK.find((f) => f.value === status.value)?.label;
    // Admin override → their wording wins.
    if (builtinDefault && status.label && status.label !== builtinDefault) return status.label;
    const key = `statuses.builtin.${status.name}`;
    const translated = this.transloco.translate(key);
    // Transloco echoes the key back when it's missing (custom statuses).
    return translated && translated !== key ? translated : (status.label ?? status.name ?? '');
  }

  /** Hex color string for a status value. Falls back to #6b7280. */
  color(value: number | undefined): string {
    if (value == null) return '#6b7280';
    const found = this.ordered().find((s) => s.value === value);
    return found?.color ?? '#6b7280';
  }
}
