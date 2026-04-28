import { useEffect, useRef } from "react";
import { AppEntry, CATEGORY_LABEL } from "../data";

interface Props {
  apps: AppEntry[];
  focusIndex: number;
  isMoving: boolean;
}

export default function Settings({ apps, focusIndex, isMoving }: Props) {
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    rowRefs.current[focusIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusIndex]);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm">
      <div className="flex h-[82vh] w-[960px] flex-col rounded-2xl bg-[#141414] shadow-2xl">

        {/* Header */}
        <div className="px-10 pt-10 pb-6 select-none">
          <h2 className="text-5xl font-bold text-white">Settings</h2>
          <p className="mt-2 text-2xl text-white/40">Manage your pinned apps</p>
        </div>

        <div className="mx-8 h-px bg-white/10" />

        {/* App list */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          {apps.length === 0 && (
            <p className="mt-8 text-center text-2xl text-white/25 select-none">
              No pinned apps — edit ~/.config/htpc-launcher/apps.toml to add some.
            </p>
          )}

          {apps.map((app, i) => {
            const isFocused = i === focusIndex;
            const isDragging = isFocused && isMoving;
            const catLabel = CATEGORY_LABEL[app.category] ?? app.category;

            return (
              <div
                key={app.id}
                ref={(el) => { rowRefs.current[i] = el; }}
                className={[
                  "flex items-center gap-5 rounded-xl px-5 py-5 select-none",
                  "transition-all duration-150 will-change-transform",
                  isDragging
                    ? "gamepad-focused scale-[1.015] bg-violet-600/25"
                    : isFocused
                    ? "bg-white/10"
                    : "bg-transparent",
                  app.hidden ? "opacity-40" : "",
                ].join(" ")}
              >
                {/* Drag handle */}
                <span
                  className={[
                    "w-7 text-center text-2xl transition-all duration-150",
                    isDragging ? "text-violet-400" : "text-white/20",
                  ].join(" ")}
                >
                  ↕
                </span>

                {/* App name */}
                <span
                  className={[
                    "flex-1 text-2xl font-semibold",
                    isFocused ? "text-white" : "text-white/65",
                  ].join(" ")}
                >
                  {app.name}
                </span>

                {/* Category selector */}
                <div
                  className={[
                    "flex items-center gap-2 rounded-lg px-4 py-2 text-xl font-medium",
                    isFocused && !isDragging
                      ? "bg-white/15 text-white"
                      : "bg-white/5 text-white/45",
                  ].join(" ")}
                >
                  {isFocused && !isDragging && (
                    <span className="text-violet-400 text-lg">◀</span>
                  )}
                  <span>{catLabel}</span>
                  {isFocused && !isDragging && (
                    <span className="text-violet-400 text-lg">▶</span>
                  )}
                </div>

                {/* Visibility dot */}
                <div
                  className={[
                    "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-2xl",
                    app.hidden
                      ? "bg-white/5 text-white/25"
                      : "bg-violet-600/30 text-violet-400",
                  ].join(" ")}
                >
                  {app.hidden ? "○" : "●"}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mx-8 h-px bg-white/10" />

        {/* Footer hints */}
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 px-10 py-5 select-none">
          <Hint glyph="↕" label="Navigate" />
          <Hint glyph="◀▶" label="Category" violet />
          <Hint glyph="△" label="Toggle visible" violet />
          <Hint glyph="A" label="Reorder" />
          <Hint glyph="B" label="Save & close" />
        </div>
      </div>
    </div>
  );
}

function Hint({ glyph, label, violet }: { glyph: string; label: string; violet?: boolean }) {
  return (
    <span className="text-xl text-white/40">
      <span className={violet ? "text-violet-400" : "text-white/70"}>{glyph}</span>
      {" "}{label}
    </span>
  );
}
