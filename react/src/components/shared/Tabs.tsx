// Thin convenience wrapper around the shadcn Tabs primitives: pass `tabs` for the header
// strip, use the real `<TabsContent value="...">` from `@/components/ui/tabs` as children
// for each tab's body. Radix's Tabs context correctly propagates through any nesting depth,
// so — unlike Angular's `mat-tab-group` (whose own content-child detection can't see a
// `<mat-tab>` merely projected in through a wrapper, see the Angular `TabsComponent` doc
// comment) — there's no need for an escape-hatch mechanism here.
import type { ReactNode } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { TabItem } from './types';

export function AppTabs({
  tabs,
  value,
  onValueChange,
  children,
  className,
}: {
  tabs: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Tabs value={value} onValueChange={onValueChange} className={className}>
      <TabsList
        className="grid w-full"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((t) => (
          <TabsTrigger key={t.value} value={t.value}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  );
}
