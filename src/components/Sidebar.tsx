import { useEffect, useRef } from "react";
import { Category } from "../data";

interface Props {
  categories: Category[];
  activeIndex: number;
  isFocused: boolean;
  discovering: boolean;
  onSelect: (index: number) => void;
}

export default function Sidebar({
  categories,
  activeIndex,
  isFocused,
  discovering,
  onSelect,
}: Props) {
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (isFocused) {
      btnRefs.current[activeIndex]?.focus({ preventScroll: true });
    }
  }, [isFocused, activeIndex]);

  return (
    <aside className="flex h-full w-72 flex-shrink-0 flex-col bg-[#111111]">
      {/* Branding */}
      <div className="select-none px-8 py-10">
        <span className="text-5xl font-black tracking-widest text-white">HTPC</span>
        <span className="ml-2 text-5xl font-black text-violet-500">▶</span>
      </div>

      <div className="mx-6 h-px bg-white/10" />

      {/* Categories */}
      <nav className="mt-4 flex flex-col gap-1 px-3">
        {categories.map((cat, i) => {
          const isActive = i === activeIndex;
          const isGamepadFocused = isFocused && isActive;
          return (
            <button
              key={cat.id}
              ref={(el) => {
                btnRefs.current[i] = el;
              }}
              onClick={() => onSelect(i)}
              tabIndex={isActive ? 0 : -1}
              className={[
                "relative flex items-center rounded-lg px-6 py-4 text-left text-2xl font-medium",
                "outline-none will-change-transform",
                "transition-all duration-150",
                isGamepadFocused
                  ? "gamepad-focused scale-[1.02] bg-violet-600/20 text-white"
                  : isActive
                  ? "bg-violet-600/20 text-white"
                  : "text-white/55 hover:bg-white/5 hover:text-white/90",
              ].join(" ")}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-violet-500" />
              )}
              {cat.label}
            </button>
          );
        })}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Refresh hint */}
      <div className="px-6 pb-8">
        <div className="mx-6 mb-5 h-px bg-white/10" style={{ marginLeft: 0, marginRight: 0 }} />
        <button
          onClick={onSelect.bind(null, activeIndex)} // no-op click; refresh is gamepad-only
          tabIndex={-1}
          className={[
            "flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left",
            "outline-none transition-opacity duration-300",
            discovering ? "opacity-100" : "opacity-40 hover:opacity-70",
          ].join(" ")}
        >
          <span
            className={[
              "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md",
              "border border-white/20 text-xl font-bold text-white/70",
              discovering ? "animate-pulse" : "",
            ].join(" ")}
          >
            △
          </span>
          <span className="text-xl text-white/60 select-none">
            {discovering ? "Discovering…" : "Refresh Apps"}
          </span>
        </button>
      </div>
    </aside>
  );
}
