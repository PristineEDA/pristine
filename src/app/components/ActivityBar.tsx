import {
  Files, Bug, Hammer, Play,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarSeparator,
} from './ui/sidebar';

interface ActivityBarProps {
  activeView: string;
  onItemSelect: (view: string) => void;
  isLeftSidebarHidden?: boolean;
}

const topItems = [
  { id: 'explorer', icon: Files, label: 'Explorer' },
  { id: 'debug', icon: Bug, label: 'Run & Debug' },
];

const actionItems = [
  { id: 'compile', icon: Hammer, label: 'Compile' },
  { id: 'run', icon: Play, label: 'Run' },
  { id: 'debug-action', icon: Bug, label: 'Debug' }
] as const;

export function ActivityBar({ activeView, onItemSelect, isLeftSidebarHidden = false }: ActivityBarProps) {
  return (
    <SidebarProvider
      open={false}
      style={{ '--sidebar-width': '3rem', '--sidebar-width-icon': '3rem' } as React.CSSProperties}
      className="min-h-0 w-auto"
    >
      <Sidebar collapsible="icon" className="static h-full w-12 border-r border-border bg-muted/40" side="left">
        <SidebarContent className="flex-1">
          <SidebarMenu>
            {topItems.map(({ id, icon: Icon, label }) => (
              <SidebarMenuItem key={id}>
                <SidebarMenuButton
                  isActive={activeView === id && !isLeftSidebarHidden}
                  title={label}
                  aria-label={label}
                  data-testid={`activity-item-${id}`}
                  onClick={() => onItemSelect(id)}
                  size="lg"
                  className={`relative w-12 h-12 flex items-center justify-center rounded-none transition-colors [&>svg]:size-5 ${
                    activeView === id && !isLeftSidebarHidden
                      ? 'text-foreground border-l-2 border-primary bg-transparent hover:bg-sidebar-accent'
                      : 'text-muted-foreground hover:text-foreground border-l-2 border-transparent hover:bg-sidebar-accent'
                  }`}
                >
                  <Icon size={20} strokeWidth={1.5} />
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>

        <SidebarSeparator className="mx-2" />

        <SidebarFooter className="px-1.5 py-2">
          <SidebarMenu className="gap-1.5">
            {actionItems.map(({ id, icon: Icon, label }) => (
              <SidebarMenuItem key={id}>
                <SidebarMenuButton
                  title={label}
                  aria-label={label}
                  data-testid={`activity-action-${id}`}
                  className="h-9 w-9 mx-auto text-emerald-500 hover:text-emerald-400 hover:bg-sidebar-accent [&>svg]:size-[18px]"
                >
                  <Icon size={18} strokeWidth={1.7} />
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
    </SidebarProvider>
  );
}