// Thin convenience wrapper around the shadcn Tabs primitives: pass `tabs` for the header
// strip, use the real `<TabsContent value="...">` from `@/components/ui/tabs` as children
// for each tab's body. Radix's Tabs context correctly propagates through any nesting depth,
// so — unlike Angular's `mat-tab-group` (whose own content-child detection can't see a
// `<mat-tab>` merely projected in through a wrapper, see the Angular `TabsComponent` doc
// comment) — there's no need for an escape-hatch mechanism here.
import type { ReactNode } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
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
      <TabsList>
        {tabs.map((t) => (
          <TabsTrigger key={t.value} value={t.value}>
            {t.label}
            {t.badge && (
              <Badge variant="warning" className="ms-1.5 h-4 gap-0 px-1.5 text-[10px] leading-4">
                {t.badge}
              </Badge>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  );
}
