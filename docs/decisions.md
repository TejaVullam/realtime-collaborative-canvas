# Architecture Decision Records (ADR)

This document is prepared for recording important architecture and design decisions made throughout the 10-day development process.

## Format

Each record will follow this structure:
- **Status**: Proposed / Accepted / Superseded
- **Context**: Problem statement and background
- **Decision**: The selected design or architecture choice
- **Consequences**: Trade-offs, benefits, and drawbacks

---

## ADR-001: Day 0 Baseline Tooling and Stack Selection

- **Status**: Accepted
- **Context**: Need a fast, clean, and type-safe foundation for a multi-user collaborative canvas.
- **Decision**:
  - Frontend: React with TypeScript, Vite as build tool, Tailwind CSS for styling.
  - Backend: Node.js with TypeScript and Express.
  - Development tools: `tsx` for backend runtime, ESLint and Prettier for code formatting.
- **Consequences**: Provides minimal footprint on Day 0 without committing prematurely to state-sync or database abstractions.
