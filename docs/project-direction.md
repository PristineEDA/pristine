# Pristine Project Direction

This document captures product direction, target architecture, long-term constraints, UI guidance, and performance goals for Pristine. These are not all immediate execution rules for agents; use `AGENT.md` for the current working rules.

## Product Vision

Pristine is intended to become a cross-platform simulation and debug IDE for ASIC digital design. The target product covers RTL editing, simulation debugging, and CI regression workflows. It should integrate with open-source EDA tools such as Verilator and Icarus Verilog, and with verification frameworks such as Cocotb and PyUVM.

The intended user experience is closer to a focused engineering IDE than a general-purpose text editor. The long-term reference point is a practical blend of Verdi-style debug workflows and VS Code-style navigation.

## Target Architecture

The long-term architecture is a five-layer system:

- Frontend UI layer: React, TypeScript, Monaco, Tailwind, Radix/shadcn-style primitives, WebGL or WebGPU for visual rendering, and lightweight state management.
- Electron host and IPC layer: cross-platform window management, process coordination, secure IPC, preload boundaries, and file-system permission control.
- Business logic layer: project management, task scheduling, state persistence, plugin management, native bindings, and third-party tool lifecycle management.
- High-performance core engine layer: waveform parsing and render preprocessing, X-state tracing, FSM analysis, schematic generation, protocol parsing, syntax analysis, and static checks.
- Third-party tool adapter layer: Verilator and Icarus Verilog integration, Cocotb and PyUVM integration, FST and VCD compatibility, and possible Slurm or LSF scheduling.

The C++ core engine is a target architecture direction. Until native source code and build infrastructure exist in this repository, contributors should treat it as a roadmap constraint rather than an immediate implementation surface.

## Native Core Direction

Long-running or compute-heavy design-analysis work should eventually move out of frontend JavaScript and into a native core or another explicitly approved high-performance backend.

Target native responsibilities include:

- Large waveform parsing and indexing.
- X-state tracing across large signal sets.
- FSM extraction and analysis.
- Schematic or graph generation from RTL.
- Protocol parsing.
- Syntax analysis and static checks when existing language servers are not sufficient.

Native modules should have no UI dependency and should be independently buildable, testable, and replaceable. Platform-specific APIs should be isolated behind platform adapters.

## IPC Model

The target IPC model has three categories:

- Synchronous calls are allowed only for lightweight queries expected to complete within 10 ms, such as reading configuration or signal metadata.
- Asynchronous calls should be used for long-running work such as waveform parsing, X-state tracing, simulation execution, and tool invocation.
- Streaming updates should be used for real-time data such as simulation logs, task progress, and incremental analysis events. The target latency is below 50 ms.

All IPC interfaces should validate input and avoid exposing raw file-system or shell access without explicit safety checks.

## Security Direction

Core local workflows should not require mandatory network access. Design data should remain local unless the user explicitly opts into a feature that sends data elsewhere.

File operations should remain constrained to the active workspace or project root. Third-party simulators and tools should run in isolated child processes, with clearly managed lifetime and failure behavior.

## UI Direction

Pristine should use a dark, dense, engineering-focused interface optimized for repeated technical workflows.

Target layout:

- A 48 px fixed activity bar on the left.
- Resizable and collapsible side panels.
- A split-capable main content region with tabs.
- A bottom panel for logs, terminals, problems, or task output.
- A compact status bar around 24 px high.

Target interaction rules:

- All clickable controls should have hover, active, disabled, and selected states where applicable.
- Multi-view selection and navigation state should remain synchronized.
- Toolbars should be compact, with 28 px icon buttons inside a roughly 40 px toolbar.
- Side panels should support practical width limits, with a target minimum of 200 px and maximum of 600 px.
- The main work area should remain usable around an 800 x 600 minimum viewport.

Use an 8 px spacing grid where practical. UI text should use a clean sans-serif font, and code areas should prefer JetBrains Mono or a comparable monospace font.

## Performance Goals

These are long-term product goals and need dedicated benchmarks before they can become release gates:

- Load a 10 GB FST waveform file in under 5 seconds.
- Respond to X-state tracing across million-scale signal sets in under 1 second.
- Maintain at least 60 fps for waveform zooming and panning.
- Reach at least 2x commercial-tool performance for trace driver and load workflows.
- Schedule 100 or more regression simulation cases without perceptible UI delay.

Before enforcing any of these goals, define the benchmark machine, operating system, input datasets, measurement method, warm-up behavior, and acceptable variance.

## Documentation And Process

Keep execution rules short and current in `AGENT.md`. Move product background, target-state architecture, and aspirational goals into this document or a more specific document under `docs/`.

When a workflow repeats often enough to become stable, consider turning it into a skill, script, or documented checklist. Prefer reusable process documentation over agent-specific commands that only work in one environment.
