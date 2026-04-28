export interface Category {
  id: string;
  label: string;
}

// Matches the Rust AppEntry struct serialized by Tauri.
// `hidden` is omitted from JSON when false, so it is optional here.
export interface AppEntry {
  id: string;
  name: string;
  exec: string;
  args: string[];
  category: string;
  icon_color: string;
  source: string; // "desktop" | "flatpak" | "steam" | "" (manual)
  hidden?: boolean;
}

export const CATEGORIES: Category[] = [
  { id: "all", label: "All Apps" },
  { id: "games", label: "Games" },
  { id: "media", label: "Media" },
  { id: "utilities", label: "Utilities" },
  { id: "settings", label: "Settings" },
];

// Categories that can be assigned to an app in the settings screen.
export const ASSIGNABLE_CATEGORIES = ["games", "media", "utilities"] as const;
export type AssignableCategory = (typeof ASSIGNABLE_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<string, string> = {
  games: "Games",
  media: "Media",
  utilities: "Utilities",
};
