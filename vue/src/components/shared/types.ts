import type { Component } from 'vue';

/** One entry of a shared row-actions dropdown menu (see RowActionsMenu.vue). */
export interface RowActionItem {
  label: string;
  /** A lucide-vue-next icon component rendered before the label. */
  icon?: Component;
  severity?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
  disabled?: boolean;
  /** Hint shown when the item is disabled (title-attribute fallback). */
  tooltip?: string;
  onClick: () => void;
}

/** One entry in a `<Tabs>` header strip. */
export interface TabItem {
  value: string;
  label: string;
}
