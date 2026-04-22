import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GalleryVerticalEnd, Package } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { SidebarProvider } from '../../ui/sidebar';
import { NavDesignSwitcher } from './NavDesignSwitcher';

const designs = [
  {
    name: 'retroSoC',
    logo: GalleryVerticalEnd,
    plan: 'SoC',
  },
  {
    name: 'demo',
    logo: Package,
    plan: 'module',
  },
  {
    name: 'gcd',
    logo: Package,
    plan: 'module',
  },
];

function renderNavDesignSwitcher(nextDesigns = designs) {
  return render(
    <SidebarProvider defaultOpen keyboardShortcut={false}>
      <NavDesignSwitcher designs={nextDesigns} />
    </SidebarProvider>,
  );
}

describe('NavDesignSwitcher', () => {
  it('renders the first design as the active selection', () => {
    renderNavDesignSwitcher();

    const logoBadge = screen.getByRole('button').firstElementChild;

    expect(screen.getByRole('button')).toHaveTextContent('retroSoC');
    expect(screen.getByRole('button')).toHaveTextContent('SoC');
    expect(logoBadge).toHaveClass('bg-sidebar-primary', 'dark:bg-sidebar-primary-foreground', 'dark:text-sidebar');
  });

  it('opens the designs menu and updates the active design after selection', async () => {
    const user = userEvent.setup();

    renderNavDesignSwitcher();

    await user.click(screen.getByRole('button'));

    expect(await screen.findByText('Designs')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /demo/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /gcd/i })).toBeInTheDocument();
    expect(screen.getByText('create more ...')).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: /demo/i }));

    expect(screen.getByRole('button')).toHaveTextContent('demo');
    expect(screen.getByRole('button')).toHaveTextContent('module');
  });

  it('returns null when no designs are available', () => {
    renderNavDesignSwitcher([]);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});