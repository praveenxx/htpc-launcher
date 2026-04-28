import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import Sidebar from "./components/Sidebar";
import Grid from "./components/Grid";
import { CATEGORIES, type AppEntry } from "./data";
import { useGamepad } from "./hooks/useGamepad";
import type { GamepadAction } from "./hooks/useGamepad";
import "./App.css";

const GRID_COLS = 4;

interface FocusState {
  area: "sidebar" | "grid";
  sidebarIndex: number;
  gridIndex: number;
}

export default function App() {
  const [apps, setApps] = useState<AppEntry[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [focus, setFocus] = useState<FocusState>({
    area: "sidebar",
    sidebarIndex: 0,
    gridIndex: 0,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const runDiscovery = useCallback(() => {
    if (discoveringRef.current) return;
    setDiscovering(true);
    const startedAt = Date.now();
    invoke<AppEntry[]>("discover_apps")
      .then((result) => {
        setApps(result);
        // Don't touch focus here — grid position is preserved.
        // safeGridIndex (below) handles clamping if the new list is shorter.
      })
      .catch(console.error)
      .finally(() => {
        // Keep the "Discovering…" indicator visible for at least 500 ms so
        // the user can see that a refresh happened.
        const elapsed = Date.now() - startedAt;
        setTimeout(() => setDiscovering(false), Math.max(0, 500 - elapsed));
      });
  }, []);

  // Run discovery on mount
  useEffect(() => {
    runDiscovery();
  }, [runDiscovery]);

  // Auto-clear launch error after 3 s
  useEffect(() => {
    if (!launchError) return;
    const t = setTimeout(() => setLaunchError(null), 3000);
    return () => clearTimeout(t);
  }, [launchError]);

  const activeCategoryId = CATEGORIES[focus.sidebarIndex].id;
  const filteredApps =
    activeCategoryId === "all"
      ? apps
      : apps.filter((a) => a.category === activeCategoryId);

  // If discovery returns a shorter list, clamp the displayed index without
  // mutating focus state (which would cause a jarring jump mid-navigation).
  const safeGridIndex = Math.min(focus.gridIndex, Math.max(0, filteredApps.length - 1));

  // Refs so the gamepad handler sees current values without stale closures
  const focusRef = useRef(focus);
  focusRef.current = focus;

  const filteredAppsRef = useRef(filteredApps);
  filteredAppsRef.current = filteredApps;

  const maxGridIndexRef = useRef(0);
  maxGridIndexRef.current = Math.max(0, filteredApps.length - 1);

  const settingsOpenRef = useRef(false);
  settingsOpenRef.current = settingsOpen;

  const discoveringRef = useRef(false);
  discoveringRef.current = discovering;

  const handleAction = useCallback(
    (action: GamepadAction) => {
      if (action === "menu") {
        setSettingsOpen((prev) => !prev);
        return;
      }

      if (action === "refresh") {
        runDiscovery();
        return;
      }

      if (settingsOpenRef.current) {
        if (action === "back") setSettingsOpen(false);
        return;
      }

      // App launch from grid — use the clamped index to match what's on screen
      if (action === "confirm" && focusRef.current.area === "grid") {
        const visibleIndex = Math.min(
          focusRef.current.gridIndex,
          Math.max(0, filteredAppsRef.current.length - 1),
        );
        const app = filteredAppsRef.current[visibleIndex];
        if (app) {
          setLaunchingId(app.id);
          invoke("launch_app", { exec: app.exec, args: app.args })
            .catch((e: unknown) => setLaunchError(String(e)))
            .finally(() => setTimeout(() => setLaunchingId(null), 700));
        }
        return;
      }

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
            case "left": {
              if (gridIndex % GRID_COLS === 0) return { ...prev, area: "sidebar" };
              return { ...prev, gridIndex: gridIndex - 1 };
            }
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

  const handleSidebarSelect = (index: number) => {
    setFocus((prev) => ({ ...prev, sidebarIndex: index, area: "sidebar", gridIndex: 0 }));
  };

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
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm">
          <div className="rounded-2xl bg-[#1c1c1e] px-16 py-12 text-center">
            <h2 className="mb-4 text-5xl font-bold text-white">Settings</h2>
            <p className="text-3xl text-white/50">Coming in Phase 5</p>
            <p className="mt-8 text-2xl text-white/30">Press B or Start to close</p>
          </div>
        </div>
      )}

      {launchError && (
        <div className="absolute bottom-8 left-1/2 z-40 -translate-x-1/2 rounded-xl bg-red-900/90 px-8 py-4 backdrop-blur-sm">
          <p className="whitespace-nowrap text-2xl text-white">{launchError}</p>
        </div>
      )}
    </div>
  );
}
