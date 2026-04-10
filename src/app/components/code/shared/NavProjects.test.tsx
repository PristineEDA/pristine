import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Frame, Map, PieChart } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { SidebarProvider } from '../../ui/sidebar';
import { NavProjects } from './NavProjects';

const projects = [
  {
    name: 'Design Engineering',
    url: '#design',
    icon: Frame,
  },
  {
    name: 'Sales & Marketing',
    url: '#sales',
    icon: PieChart,
  },
  {
    name: 'Travel',
    url: '#travel',
    icon: Map,
  },
];

function renderNavProjects(nextProjects = projects) {
  return render(
    <SidebarProvider defaultOpen keyboardShortcut={false}>
      <NavProjects projects={nextProjects} />
    </SidebarProvider>,
  );
}

describe('NavProjects', () => {
  it('renders the projects section with project links', () => {
    renderNavProjects();

    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /design engineering/i })).toHaveAttribute('href', '#design');
    expect(screen.getByRole('link', { name: /sales & marketing/i })).toHaveAttribute('href', '#sales');
    expect(screen.getByRole('link', { name: /travel/i })).toHaveAttribute('href', '#travel');
  });

  it('opens the project action menu with the expected options', async () => {
    const user = userEvent.setup();

    renderNavProjects();

    const moreButtons = screen.getAllByRole('button', { name: 'More' });
    const firstMoreButton = moreButtons[0];

    if (!firstMoreButton) {
      throw new Error('Expected at least one project action trigger');
    }

    await user.click(firstMoreButton);

    expect(await screen.findByRole('menuitem', { name: /view project/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /share project/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /delete project/i })).toBeInTheDocument();
  });

  it('renders no project links when the list is empty', () => {
    renderNavProjects([]);

    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});