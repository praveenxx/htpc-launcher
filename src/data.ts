export interface Category {
  id: string;
  label: string;
}

// Matches the Rust AppEntry struct serialized by Tauri
export interface AppEntry {
  id: string;
  name: string;
  exec: string;
  args: string[];
  category: string;
  icon_color: string;
  source: string; // "desktop" | "flatpak" | "steam" | "" (manual)
}

export const CATEGORIES: Category[] = [
  { id: "all", label: "All Apps" },
  { id: "games", label: "Games" },
  { id: "media", label: "Media" },
  { id: "utilities", label: "Utilities" },
  { id: "settings", label: "Settings" },
];
