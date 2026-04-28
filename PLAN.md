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
- [x] Verify build on macOS (user confirms)
- [x] Commit and tag v0.0.1

### Phase 1 — Layout Shell ✅

- [x] Sidebar component (left, ~280px, 5 hardcoded categories)
- [x] Grid component (right, 4 columns, 8 hardcoded placeholder cards)
- [x] TV-scale typography: ≥24px body, ≥32px headings
- [x] CSS hover/focus states only (no gamepad wiring yet)
- [ ] Verify on macOS, commit and tag v0.1.0

### Phase 2 — Gamepad Navigation ✅

- [x] `useGamepad` hook polling at 60fps via requestAnimationFrame
- [x] Roving tabindex pattern across sidebar + grid
- [x] D-pad + left stick: move focus
- [x] A = activate, B = back, Start = settings modal placeholder
- [x] GPU-accelerated focus ring animation (pulsing box-shadow)
- [ ] Verify on macOS + DualSense, commit and tag v0.2.0

### Phase 3 — Real App Launching ✅

- [x] Tauri command `launch_app(exec, args)` with fork-and-detach (`process_group(0)`)
- [x] TOML config at `~/.config/htpc-launcher/apps.toml` — defaults written on first run
- [x] `get_apps` command loads config into Tauri State, frontend fetches on mount
- [x] Pressing A on a card invokes `launch_app`; launcher stays alive
- [x] "Launching…" overlay on card + error toast for failed launches
- [ ] Verify on macOS + Bazzite VM, commit and tag v0.3.0

### Phase 4 — Auto-Discovery ✅

- [x] `.desktop` scanner — /usr/share/applications, /var/lib/flatpak/exports/…, ~/.local/share/…
- [x] Flatpak fallback via `flatpak list --app` for Flatpaks without .desktop files
- [x] Steam VDF parser — libraryfolders.vdf + appmanifest_*.acf, launches via `-applaunch`
- [x] TOML-pinned apps take precedence; discovered apps fill the rest
- [x] Source badge on cards (Flatpak / Steam)
- [x] Y / △ button → refresh; "Discovering…" indicator in sidebar + header
- [ ] Verify on Bazzite VM with real Flatpak + Steam library, commit and tag v0.4.0

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
