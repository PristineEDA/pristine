import {
  render as renderWithTestingLibrary,
  type RenderOptions,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';

export * from '@testing-library/react';
export { userEvent };

export function render(ui: ReactElement, options?: RenderOptions) {
  return renderWithTestingLibrary(ui, options);
}

export function setupUser() {
  return userEvent.setup();
}
