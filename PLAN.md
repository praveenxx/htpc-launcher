# HTPC-LAUNCHER — Project Plan

10-foot UI HTPC app launcher for Bazzite Linux. Gamepad-first. Roku-inspired layout.

## Stack

- Tauri 2 (Rust backend) · React + TypeScript · Tailwind CSS v3 · Vite · pnpm
- Flatpak as the primary distribution target

## Phases

### Phase 0 — Scaffolding ✅

- [x] Tauri 2 + React + TypeScript + Tailwind CSS v3 + Vite project initialized
- [x] pnpm, ESLint, Prettier configured
- [x] .gitignore in place
- [x] Fullscreen window: dark background (#0a0a0a), centered title text
- [x] tauri.conf.json: fullscreen, no decorations, 1920×1080
- [ ] Verify build on macOS (user confirms)
- [ ] Commit and tag v0.0.1

### Phase 1 — Layout Shell

- Sidebar component (left, ~280px, 5 hardcoded categories)
- Grid component (right, 4 columns, 8 hardcoded placeholder cards)
- TV-scale typography: ≥24px body, ≥32px headings
- CSS hover/focus states only (no gamepad wiring yet)

### Phase 2 — Gamepad Navigation

- `useGamepad` hook polling at 60fps via requestAnimationFrame
- Roving tabindex pattern across sidebar + grid
- D-pad + left stick: move focus
- A = activate, B = back, Start = settings modal placeholder
- GPU-accelerated focus ring animation

### Phase 3 — Real App Launching

- Tauri command `launch_app(exec, args)` with fork-and-detach
- TOML config with 5 hardcoded apps (Firefox, Steam, VLC, etc.)
- Pressing A on a card launches the app; launcher stays alive

### Phase 4 — Auto-Discovery

- Unified app list from: Flatpak (`flatpak list`), .desktop files, Steam VDF
- Each app: id, display_name, exec_command, icon_path, source_type
- "Refresh apps" action in UI

### Phase 5 — Config UI

- Settings screen via Start button, fully gamepad-navigable
- Reorder / hide apps, change category
- Persists to TOML

### Phase 6 — Bazzite Packaging

- Flatpak manifest (org.htpclauncher.App.yml)
- Build + install on Bazzite VM
- Final UX test on real Bazzite box + TV + DualSense
- README install docs

## Key Constraints

- Gamepad-first: Web Gamepad API, 60fps rAF polling
- TV animations: GPU transforms only (transform, opacity) — never width/height/top/left
- Config: ~/.config/htpc-launcher/ (TOML)
- No UI component libraries — Tailwind only
- Fork-and-detach app launch (setsid + double-fork on Linux)
