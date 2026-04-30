# Pristine Agent Rules

This file contains execution rules for agents working in this repository. Keep it short, current, and actionable. Product direction, target architecture, long-term C++ plans, UI guidelines, and performance goals live in [docs/project-direction.md](docs/project-direction.md).

## Current Repository

Pristine is currently an Electron, Vite, React, TypeScript, and Mastra workspace.

- Main app: Electron 33, Vite 8, React 19, TypeScript, Tailwind CSS v4, Monaco Editor, Radix/shadcn-style primitives, lucide-react, assistant-ui, and Zustand.
- Embedded agent server: Mastra, TypeScript, workspace tools, pending file changes, pending shell commands, and local workspace safety helpers.
- Tests: Vitest for unit tests and Playwright for end-to-end and performance tests.
- Native/core roadmap work is documented separately. Do not assume a C++ source tree exists unless the repository contains one.

## Working Rules

- Inspect the relevant code before proposing or making changes.
- Keep edits scoped to the requested behavior and aligned with existing local patterns.
- Explain the intended approach before substantial implementation work.
- Clarify ambiguous, high-risk, or broad requests before changing code.
- Prefer small, independently verifiable changes over large rewrites.
- Respect the active tool model. When using the embedded Pristine agent, propose pending file changes and pending shell commands for review. When operating in a normal workspace with write access, edit files directly only when the user requested implementation.
- Use subagents or workers only when the environment supports them and the task can be split into clear, independently verifiable responsibilities.
- Optional workflow commands such as loop, batch, or simplify may be used only when they exist in the active environment. They are not required repository rules.

## Code Rules

- Code, comments, commit messages, and PR text must be written in English.
- Do not include development-process notes in code comments.
- Avoid AI tool names in code comments, commit messages, authorship metadata, and PR text.
- Avoid progress labels such as `FIXED`, `Step`, `Week`, `Section`, `Phase`, or `AC-x` in code comments, commit messages, and PR text.
- Prefer TypeScript interfaces for component props and shared contracts.
- Use PascalCase for components and TypeScript types, camelCase for variables, functions, and state, `handle*` for event handlers, and `on*` for callback props.
- Use functional React components and hooks, following the patterns already present in nearby files.
- Use lucide-react for icons when an appropriate icon exists.
- Use Tailwind utilities and shared style files. Do not add component-local CSS files unless the surrounding implementation already requires that pattern.

## Architecture Boundaries

- Keep UI rendering and interaction concerns in React components.
- Keep Electron windowing, preload, and IPC concerns in the Electron layer.
- Validate all IPC input and keep channel contracts explicit.
- Do not use synchronous IPC for long-running work.
- Run third-party tools in isolated child processes when they can block, crash, or execute user-controlled input.
- Keep file operations constrained to the selected workspace or project root through the existing path-safety helpers.
- Do not add mandatory network dependencies to core editing, workspace, simulation, or local analysis flows.

## Verification

Run the narrowest useful verification for the change. Prefer the existing commands:

- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:e2e`
- `pnpm --filter @pristine/agent-server typecheck`
- `pnpm --filter @pristine/agent-server test`

For bug fixes, reproduce the issue first when practical, then verify the fix. Report any verification that could not be run.
