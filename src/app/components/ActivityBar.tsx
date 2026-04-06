import {
  FileCode, BugPlay, Cog, LucideLayers3, Grid2X2Plus, Hammer, Play,
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
}

const topItems = [
  { id: 'explorer', icon: FileCode, label: 'Explorer' },
  { id: 'simulation', icon: BugPlay, label: 'Simulation' },
  { id: 'synthesis', icon: Cog, label: 'Synthesis' },
  { id: 'physical', icon: LucideLayers3, label: 'Physical Design' },
  { id: 'factory', icon: Grid2X2Plus, label: 'Factory' },
];

const actionItems = [
  { id: 'compile', icon: Hammer, label: 'Compile' },
  { id: 'run', icon: Play, label: 'Run' },
] as const;

const activityBarButtonBaseClass = 'relative h-10 w-12 flex items-center justify-center rounded-none p-0 transition-colors hover:cursor-pointer group-data-[collapsible=icon]:h-10! group-data-[collapsible=icon]:w-12! group-data-[collapsible=icon]:p-0!';

export function ActivityBar({ activeView, onItemSelect }: ActivityBarProps) {
  return (
    <SidebarProvider
      open={false}
      style={{ '--sidebar-width': '3rem', '--sidebar-width-icon': '3rem' } as React.CSSProperties}
      className="min-h-0 w-auto"
    >
      <Sidebar collapsible="icon" className="static h-full w-12 border-r border-border bg-muted/40" side="left">
        <SidebarContent className="flex-1">
          <SidebarMenu className="gap-0">
            {topItems.map(({ id, icon: Icon, label }) => (
              <SidebarMenuItem key={id}>
                <SidebarMenuButton
                  isActive={activeView === id}
                  title={label}
                  aria-label={label}
                  data-testid={`activity-item-${id}`}
                  onClick={() => onItemSelect(id)}
                  size="lg"
                  className={`${activityBarButtonBaseClass} [&>svg]:size-5 ${
                    activeView === id
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

        <SidebarSeparator className="mx-0" />

        <SidebarFooter className="px-0 py-0">
          <SidebarMenu className="gap-0">
            {actionItems.map(({ id, icon: Icon, label }) => (
              <SidebarMenuItem key={id}>
                <SidebarMenuButton
                  title={label}
                  aria-label={label}
                  data-testid={`activity-action-${id}`}
                  className={`${activityBarButtonBaseClass} text-emerald-500 hover:bg-sidebar-accent hover:text-emerald-400 [&>svg]:size-[18px]`}
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