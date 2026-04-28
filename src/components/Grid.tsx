import { forwardRef, useEffect, useRef } from "react";
import { AppEntry } from "../data";

interface GridProps {
  categoryLabel: string;
  apps: AppEntry[];
  focusedIndex: number;
  isFocused: boolean;
  launchingId: string | null;
}

export default function Grid({
  categoryLabel,
  apps,
  focusedIndex,
  isFocused,
  launchingId,
}: GridProps) {
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (isFocused) {
      btnRefs.current[focusedIndex]?.focus({ preventScroll: false });
    }
  }, [isFocused, focusedIndex]);

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-baseline gap-4 px-10 py-8">
        <h1 className="select-none text-4xl font-bold tracking-wide text-white">
          {categoryLabel}
        </h1>
        <span className="select-none text-2xl text-white/40">{apps.length}</span>
      </div>

      {/* Empty state */}
      {apps.length === 0 && (
        <div className="flex flex-1 items-center justify-center">
          <p className="select-none text-3xl text-white/25">No apps in this category</p>
        </div>
      )}

      {/* Grid */}
      {apps.length > 0 && (
        <div className="overflow-y-auto px-10 pb-10 pt-2">
          <div className="grid grid-cols-4 gap-6 py-2">
            {apps.map((app, i) => (
              <AppCard
                key={app.id}
                ref={(el) => {
                  btnRefs.current[i] = el;
                }}
                app={app}
                tabIndex={i === focusedIndex ? 0 : -1}
                isGamepadFocused={isFocused && i === focusedIndex}
                isLaunching={app.id === launchingId}
              />
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

interface CardProps {
  app: AppEntry;
  tabIndex: number;
  isGamepadFocused: boolean;
  isLaunching: boolean;
}

const AppCard = forwardRef<HTMLButtonElement, CardProps>(function AppCard(
  { app, tabIndex, isGamepadFocused, isLaunching },
  ref,
) {
  return (
    <button
      ref={ref}
      tabIndex={tabIndex}
      className={[
        "group flex flex-col overflow-hidden rounded-2xl bg-[#1a1a1a] text-left",
        "outline-none will-change-transform",
        "transition-all duration-150 ease-out",
        isLaunching
          ? "scale-[0.96] opacity-60"
          : isGamepadFocused
          ? "gamepad-focused scale-[1.04]"
          : "hover:scale-[1.04]",
      ].join(" ")}
    >
      {/* Icon area */}
      <div
        className="relative flex aspect-video w-full items-center justify-center"
        style={{ backgroundColor: app.icon_color }}
      >
        <span className="select-none text-6xl font-black text-white/70">
          {app.name[0]}
        </span>

        {/* Source badge */}
        {app.source && app.source !== "" && (
          <span className="absolute bottom-2 right-2 rounded px-2 py-0.5 text-sm font-semibold uppercase tracking-wide bg-black/50 text-white/60 select-none">
            {app.source === "steam" ? "Steam" : app.source === "flatpak" ? "Flatpak" : app.source}
          </span>
        )}

        {isLaunching && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="select-none text-2xl font-semibold text-white/90">
              Launching…
            </span>
          </div>
        )}
      </div>

      {/* Name */}
      <div className="px-5 py-4">
        <span
          className={[
            "text-2xl font-semibold transition-colors duration-150",
            isGamepadFocused ? "text-white" : "text-white/80 group-hover:text-white",
          ].join(" ")}
        >
          {app.name}
        </span>
      </div>
    </button>
  );
});
