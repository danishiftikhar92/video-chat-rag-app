import { NavLink } from 'react-router-dom';
import { MessageSquare, PanelLeftClose, PanelLeftOpen, Settings, Upload, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/stores/ui-store';

const links = [
  { to: '/videos', label: 'Videos', icon: Video },
  { to: '/videos/new', label: 'Upload', icon: Upload },
  { to: '/chat', label: 'Chat', icon: MessageSquare },
  { to: '/settings', label: 'Settings', icon: Settings }
];

interface SidebarProps {
  collapsed: boolean;
  onNavigate?: () => void;
  showCollapseToggle?: boolean;
}

export function Sidebar({ collapsed, onNavigate, showCollapseToggle = true }: SidebarProps) {
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200',
          collapsed ? 'w-[72px]' : 'w-60'
        )}
      >
        <div
          className={cn(
            'flex h-16 items-center gap-2 border-b border-sidebar-border px-4',
            collapsed && 'justify-center px-0'
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Video className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Video RAG</p>
              <p className="truncate text-xs text-muted-foreground">Transcript intelligence</p>
            </div>
          )}
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3">
          {links.map(({ to, label, icon: Icon }) => {
            const link = (
              <NavLink
                key={to}
                to={to}
                end={to === '/videos'}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    'hover:bg-sidebar-accent',
                    collapsed && 'justify-center px-0',
                    isActive
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'text-muted-foreground hover:text-foreground'
                  )
                }
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
              </NavLink>
            );

            if (collapsed) {
              return (
                <Tooltip key={to}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{label}</TooltipContent>
                </Tooltip>
              );
            }
            return link;
          })}
        </nav>

        {showCollapseToggle && (
          <div className="border-t border-sidebar-border p-3">
            <Button
              variant="ghost"
              size={collapsed ? 'icon' : 'default'}
              onClick={toggleSidebar}
              className={cn('w-full text-muted-foreground', collapsed && 'w-full')}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-5 w-5" />
              ) : (
                <>
                  <PanelLeftClose className="h-5 w-5" />
                  <span>Collapse</span>
                </>
              )}
            </Button>
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
}
