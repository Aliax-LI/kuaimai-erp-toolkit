import { useState, type ComponentType, type ReactNode } from 'react';

import {
  PagePanelAsideHeader,
  PagePanelBody,
  PagePanelFooter,
  PagePanelHeader,
  PageSurface,
} from '@/components/layout/page-canvas/PageCanvas';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export interface SettingsSectionItem {
  id: string;
  label: string;
  description: string;
  icon: ComponentType;
  header: { title: string; description?: string; action?: ReactNode };
  body: ReactNode;
  footer?: ReactNode;
}

interface SettingsLayoutProps {
  sections: SettingsSectionItem[];
  defaultSectionId?: string;
}

export function SettingsLayout({ sections, defaultSectionId }: SettingsLayoutProps) {
  const [activeId, setActiveId] = useState(defaultSectionId ?? sections[0]?.id ?? '');
  const active = sections.find((section) => section.id === activeId) ?? sections[0];

  if (!active) {
    return null;
  }

  return (
    <PageSurface className="lg:flex-row">
      <aside className="flex shrink-0 flex-col border-b bg-background lg:w-64 lg:border-r lg:border-b-0">
        <PagePanelAsideHeader>
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            设置分类
          </span>
        </PagePanelAsideHeader>
        <nav className="flex flex-col gap-1 p-3">
          {sections.map((section) => {
            const isActive = section.id === active.id;
            return (
              <Button
                key={section.id}
                type="button"
                variant={isActive ? 'secondary' : 'ghost'}
                className={cn(
                  'h-auto min-h-11 w-full justify-start px-3 py-2',
                  isActive && 'bg-accent',
                )}
                onClick={() => setActiveId(section.id)}
              >
                <section.icon />
                <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
                  <span className="truncate text-sm font-medium">{section.label}</span>
                  <span className="truncate text-xs font-normal text-muted-foreground">
                    {section.description}
                  </span>
                </span>
              </Button>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
        <PagePanelHeader
          title={active.header.title}
          description={active.header.description}
          action={active.header.action}
        />
        <ScrollArea className="min-h-0 flex-1">
          <PagePanelBody>{active.body}</PagePanelBody>
        </ScrollArea>
        {active.footer && <PagePanelFooter>{active.footer}</PagePanelFooter>}
      </div>
    </PageSurface>
  );
}
