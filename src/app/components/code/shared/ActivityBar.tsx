import {
  FileCode, BugPlay, Cog, LucideLayers3, Grid2X2Plus, Hammer, Play,
  AudioWaveform,
  // BookOpen,
  Command,
  Frame,
  GalleryVerticalEnd,
  PieChart,
  // Settings2,
  Map,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
  SidebarHeader,
} from '../../ui/sidebar';
import { NavTeamSwitcher } from './NavTeamSwitcher';
import { NavMain } from './NavMain';
import { NavProjects } from './NavProjects';
import type { CodeView } from '../../../codeViewPanels';


interface ActivityBarProps {
  activeView: string;
  onItemSelect: (view: string) => void;
}

const actionItems = [
  { id: 'compile', icon: Hammer, label: 'Compile' },
  { id: 'run', icon: Play, label: 'Run' },
] as const;

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  teams: [
    {
      name: "Acme Inc",
      logo: GalleryVerticalEnd,
      plan: "Enterprise",
    },
    {
      name: "Acme Corp.",
      logo: AudioWaveform,
      plan: "Startup",
    },
    {
      name: "Evil Corp.",
      logo: Command,
      plan: "Free",
    },
  ],
  navMain: [
    {
      id: 'explorer' as CodeView,
      title: "Editor",
      url: "#",
      icon: FileCode,
      isActive: true,
    },
    {
      id: 'simulation' as CodeView,
      title: "Simulation",
      url: "#",
      icon: BugPlay,
    },
    {
      id: 'synthesis' as CodeView,
      title: "Synthesis",
      url: "#",
      icon: Cog,
    },
    {
      id: 'physical' as CodeView,
      title: "Physical",
      url: "#",
      icon: LucideLayers3,
      items: [
        {
          title: "Floorplan",
          url: "#",
        },
        {
          title: "Place",
          url: "#",
        },
        {
          title: "CTS",
          url: "#",
        },
        {
          title: "Route",
          url: "#",
        },
        {
          title: "DRC",
          url: "#",
        },
      ],
    },
    {
      id: 'factory' as CodeView,
      title: "Factory",
      url: "#",
      icon: Grid2X2Plus,
    },
  ],
  projects: [
    {
      name: "Design Engineering",
      url: "#",
      icon: Frame,
    },
    {
      name: "Sales & Marketing",
      url: "#",
      icon: PieChart,
    },
    {
      name: "Travel",
      url: "#",
      icon: Map,
    },
  ],
}

const activityBarButtonBaseClass = 'relative min-h-10 rounded-md transition-colors hover:cursor-pointer group-data-[collapsible=icon]:h-10! group-data-[collapsible=icon]:w-full! group-data-[collapsible=icon]:justify-center! group-data-[collapsible=icon]:gap-0! group-data-[collapsible=icon]:px-0!';

export function ActivityBar({ activeView, onItemSelect }: ActivityBarProps) {
  const { state } = useSidebar();
  const isExpanded = state === 'expanded';
  const actionButtonClassName = `${activityBarButtonBaseClass} text-emerald-500 hover:bg-muted hover:text-emerald-400 ${isExpanded ? 'h-10 w-full justify-start' : 'h-10 w-full justify-center px-0'
    }`;

  return (
    <Sidebar
      collapsible="icon"
      className="top-8 h-[calc(100svh-3.5rem)]"
      data-testid="activity-bar"
      side="left"
    >
      <SidebarHeader>
        <NavTeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} activeView={activeView} onItemSelect={onItemSelect} />
        <NavProjects projects={data.projects} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          {actionItems.map(({ id, icon: Icon, label }) => (
            <SidebarMenuItem key={id}>
              <SidebarMenuButton
                tooltip={label}
                aria-label={label}
                data-testid={`activity-action-${id}`}
                className={`${actionButtonClassName} [&>svg]:size-[18px]`}
              >
                <Icon size={18} strokeWidth={1.7} />
                {isExpanded ? <span className="text-sm font-medium">{label}</span> : null}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}