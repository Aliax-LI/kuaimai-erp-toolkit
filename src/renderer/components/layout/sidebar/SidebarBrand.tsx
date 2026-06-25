import { SidebarHeader, useSidebar } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { APP_NAME, APP_SUBTITLE, APP_VERSION, SHELL_HEADER_HEIGHT_CLASS } from '@shared/constants/app';
import { cn } from '@/lib/utils';

export function SidebarBrand() {
  const { state, isMobile } = useSidebar();
  const tooltipLabel = `${APP_NAME} · v${APP_VERSION}`;
  const showTooltip = state === 'collapsed' && !isMobile;

  return (
    <SidebarHeader
      className={cn(
        SHELL_HEADER_HEIGHT_CLASS,
        'flex flex-row items-center border-b border-sidebar-border px-3',
        'group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2',
      )}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'flex min-w-0 items-center gap-3',
              'group-data-[collapsible=icon]:gap-0',
            )}
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary shadow-sm ring-1 ring-sidebar-primary/20">
              <span className="text-xs font-bold tracking-wider text-sidebar-primary-foreground">
                KM
              </span>
            </div>
            <div className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate text-sm font-semibold tracking-tight">{APP_NAME}</span>
              <span className="truncate text-xs text-muted-foreground">{APP_SUBTITLE}</span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" align="center" hidden={!showTooltip}>
          {tooltipLabel}
        </TooltipContent>
      </Tooltip>
    </SidebarHeader>
  );
}
