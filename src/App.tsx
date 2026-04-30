import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import Sidebar from "./components/Sidebar";
import Grid from "./components/Grid";
import Settings from "./components/Settings";
import { ASSIGNABLE_CATEGORIES, CATEGORIES, type AppEntry } from "./data";
import { useGamepad } from "./hooks/useGamepad";
import type { GamepadAction } from "./hooks/useGamepad";
import "./App.css";

const GRID_COLS = 4;

interface FocusState {
  area: "sidebar" | "grid";
  sidebarIndex: number;
  gridIndex: number;
}

interface SettingsFocus {
  rowIndex: number;
  moving: boolean; // in drag-to-reorder mode
}

export default function App() {
  // ── Main grid state ────────────────────────────────────────────────────────
  const [apps, setApps] = useState<AppEntry[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [focus, setFocus] = useState<FocusState>({
    area: "sidebar",
    sidebarIndex: 0,
    gridIndex: 0,
  });

  // ── Settings state ─────────────────────────────────────────────────────────
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsApps, setSettingsApps] = useState<AppEntry[]>([]);
  const [settingsFocus, setSettingsFocus] = useState<SettingsFocus>({
    rowIndex: 0,
    moving: false,
  });

  // ── Feedback state ─────────────────────────────────────────────────────────
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);

  // ── Derived values ─────────────────────────────────────────────────────────
  const activeCategoryId = CATEGORIES[focus.sidebarIndex].id;
  const filteredApps =
    activeCategoryId === "all"
      ? apps
      : apps.filter((a) => a.category === activeCategoryId);

  // Clamp grid cursor to list bounds without forcing a state write.
  const safeGridIndex = Math.min(focus.gridIndex, Math.max(0, filteredApps.length - 1));

  // ── Refs (always current, zero stale-closure risk) ─────────────────────────
  const discoveringRef = useRef(false);
  discoveringRef.current = discovering;

  const settingsOpenRef = useRef(false);
  settingsOpenRef.current = settingsOpen;

  const settingsAppsRef = useRef<AppEntry[]>([]);
  settingsAppsRef.current = settingsApps;

  const settingsFocusRef = useRef<SettingsFocus>({ rowIndex: 0, moving: false });
  settingsFocusRef.current = settingsFocus;

  const focusRef = useRef(focus);
  focusRef.current = focus;

  const filteredAppsRef = useRef(filteredApps);
  filteredAppsRef.current = filteredApps;

  const maxGridIndexRef = useRef(0);
  maxGridIndexRef.current = Math.max(0, filteredApps.length - 1);

  // ── Discovery ──────────────────────────────────────────────────────────────
  const runDiscovery = useCallback(() => {
    if (discoveringRef.current) return;
    setDiscovering(true);
    const startedAt = Date.now();
    invoke<AppEntry[]>("discover_apps")
      .then(setApps)
      .catch(console.error)
      .finally(() => {
        const elapsed = Date.now() - startedAt;
        setTimeout(() => setDiscovering(false), Math.max(0, 500 - elapsed));
      });
  }, []);

  useEffect(() => { runDiscovery(); }, [runDiscovery]);

  // Auto-clear launch errors after 3 s.
  useEffect(() => {
    if (!launchError) return;
    const t = setTimeout(() => setLaunchError(null), 3000);
    return () => clearTimeout(t);
  }, [launchError]);

  // ── Gamepad handler ────────────────────────────────────────────────────────
  const handleAction = useCallback(
    (action: GamepadAction) => {

      // ── Settings open/close ──────────────────────────────────────────────
      if (action === "menu") {
        if (settingsOpenRef.current) {
          // Save & close
          const toSave = settingsAppsRef.current;
          setSettingsOpen(false);
          invoke("save_apps", { apps: toSave })
            .then(() => runDiscovery())
            .catch((e: unknown) => setLaunchError(String(e)));
        } else {
          // Load TOML apps then open
          invoke<AppEntry[]>("get_apps")
            .then((manual) => {
              setSettingsApps(manual);
              setSettingsFocus({ rowIndex: 0, moving: false });
              setSettingsOpen(true);
            })
            .catch(console.error);
        }
        return;
      }

      // ── Settings navigation ──────────────────────────────────────────────
      if (settingsOpenRef.current) {
        const { rowIndex, moving } = settingsFocusRef.current;
        const sApps = settingsAppsRef.current;

        if (moving) {
          // Drag-to-reorder mode: D-pad moves item, A or B exits.
          if (action === "up" && rowIndex > 0) {
            const next = [...sApps];
            [next[rowIndex - 1], next[rowIndex]] = [next[rowIndex], next[rowIndex - 1]];
            setSettingsApps(next);
            setSettingsFocus((f) => ({ ...f, rowIndex: rowIndex - 1 }));
          } else if (action === "down" && rowIndex < sApps.length - 1) {
            const next = [...sApps];
            [next[rowIndex + 1], next[rowIndex]] = [next[rowIndex], next[rowIndex + 1]];
            setSettingsApps(next);
            setSettingsFocus((f) => ({ ...f, rowIndex: rowIndex + 1 }));
          } else if (action === "confirm" || action === "back") {
            setSettingsFocus((f) => ({ ...f, moving: false }));
          }
          return;
        }

        // Browse mode
        switch (action) {
          case "up":
            setSettingsFocus((f) => ({ ...f, rowIndex: Math.max(0, rowIndex - 1) }));
            break;
          case "down":
            setSettingsFocus((f) => ({
              ...f,
              rowIndex: Math.min(sApps.length - 1, rowIndex + 1),
            }));
            break;
          case "left":
          case "right": {
            if (!sApps.length) break;
            const app = sApps[rowIndex];
            const idx = ASSIGNABLE_CATEGORIES.indexOf(
              app.category as (typeof ASSIGNABLE_CATEGORIES)[number],
            );
            const safeIdx = idx < 0 ? 0 : idx;
            const nextIdx =
              action === "right"
                ? (safeIdx + 1) % ASSIGNABLE_CATEGORIES.length
                : (safeIdx - 1 + ASSIGNABLE_CATEGORIES.length) % ASSIGNABLE_CATEGORIES.length;
            const next = [...sApps];
            next[rowIndex] = { ...app, category: ASSIGNABLE_CATEGORIES[nextIdx] };
            setSettingsApps(next);
            break;
          }
          case "confirm":
            // Enter drag-to-reorder mode
            setSettingsFocus((f) => ({ ...f, moving: true }));
            break;
          case "refresh":
            // △/Y = toggle hidden
            if (!sApps.length) break;
            const next = [...sApps];
            next[rowIndex] = { ...next[rowIndex], hidden: !next[rowIndex].hidden };
            setSettingsApps(next);
            break;
          case "back": {
            // Save & close (same as menu)
            const toSave = settingsAppsRef.current;
            setSettingsOpen(false);
            invoke("save_apps", { apps: toSave })
              .then(() => runDiscovery())
              .catch((e: unknown) => setLaunchError(String(e)));
            break;
          }
        }
        return;
      }

      // ── Main UI: refresh & launch ────────────────────────────────────────
      if (action === "refresh") {
        runDiscovery();
        return;
      }

      if (action === "confirm" && focusRef.current.area === "grid") {
        const visibleIndex = Math.min(
          focusRef.current.gridIndex,
          Math.max(0, filteredAppsRef.current.length - 1),
        );
        const app = filteredAppsRef.current[visibleIndex];
        if (app) {
          setLaunchingId(app.id);
          invoke("launch_app", { id: app.id, exec: app.exec, args: app.args })
            .catch((e: unknown) => setLaunchError(String(e)))
            .finally(() => setTimeout(() => setLaunchingId(null), 700));
        }
        return;
      }

      // ── Main UI: navigation ──────────────────────────────────────────────
      setFocus((prev) => {
        const { area, sidebarIndex, gridIndex } = prev;
        const maxGrid = maxGridIndexRef.current;

        if (area === "sidebar") {
          switch (action) {
            case "up":
              return { ...prev, sidebarIndex: Math.max(0, sidebarIndex - 1), gridIndex: 0 };
            case "down":
              return {
                ...prev,
                sidebarIndex: Math.min(CATEGORIES.length - 1, sidebarIndex + 1),
                gridIndex: 0,
              };
            case "right":
            case "confirm":
              return maxGrid >= 0 ? { ...prev, area: "grid" } : prev;
            default:
              return prev;
          }
        } else {
          switch (action) {
            case "up": {
              const next = gridIndex - GRID_COLS;
              return next >= 0 ? { ...prev, gridIndex: next } : prev;
            }
            case "down": {
              const next = gridIndex + GRID_COLS;
              return next <= maxGrid ? { ...prev, gridIndex: next } : prev;
            }
            case "left":
              if (gridIndex % GRID_COLS === 0) return { ...prev, area: "sidebar" };
              return { ...prev, gridIndex: gridIndex - 1 };
            case "right": {
              const isLastInRow = gridIndex % GRID_COLS === GRID_COLS - 1;
              if (isLastInRow || gridIndex >= maxGrid) return prev;
              return { ...prev, gridIndex: gridIndex + 1 };
            }
            case "back":
              return { ...prev, area: "sidebar" };
            default:
              return prev;
          }
        }
      });
    },
    [runDiscovery],
  );

  useGamepad(handleAction);

  const handleSidebarSelect = (index: number) =>
    setFocus((prev) => ({ ...prev, sidebarIndex: index, area: "sidebar", gridIndex: 0 }));

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-[#0a0a0a] text-white">
      <Sidebar
        categories={CATEGORIES}
        activeIndex={focus.sidebarIndex}
        isFocused={focus.area === "sidebar"}
        discovering={discovering}
        onSelect={handleSidebarSelect}
      />
      <div className="w-px flex-shrink-0 bg-white/10" />
      <Grid
        categoryLabel={CATEGORIES[focus.sidebarIndex].label}
        apps={filteredApps}
        focusedIndex={safeGridIndex}
        isFocused={focus.area === "grid"}
        launchingId={launchingId}
      />

      {settingsOpen && (
        <Settings
          apps={settingsApps}
          focusIndex={settingsFocus.rowIndex}
          isMoving={settingsFocus.moving}
        />
      )}

      {launchError && (
        <div className="absolute bottom-8 left-1/2 z-40 -translate-x-1/2 rounded-xl bg-red-900/90 px-8 py-4 backdrop-blur-sm">
          <p className="whitespace-nowrap text-2xl text-white">{launchError}</p>
        </div>
      )}
    </div>
  );
}
