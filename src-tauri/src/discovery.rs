use std::{
    collections::HashMap,
    fs,
    path::PathBuf,
    process::Command,
};

use crate::AppEntry;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/// Deterministic dark-muted background color derived from an app id (DJB2 → HSL).
fn color_from_id(id: &str) -> String {
    let h = id.bytes().fold(5381u32, |acc, b| {
        acc.wrapping_shl(5).wrapping_add(acc).wrapping_add(b as u32)
    });
    let hue = h % 360;
    let sat = 45 + (h >> 9) % 21; // 45–65 %
    let lit = 25 + (h >> 16) % 13; // 25–37 %
    format!("hsl({hue}, {sat}%, {lit}%)")
}

/// Coarse XDG Categories → our 4-bucket taxonomy.
fn xdg_to_category(cats: &str) -> &'static str {
    for c in cats.split(';') {
        match c.trim() {
            "Game" | "Games" => return "games",
            "AudioVideo" | "Audio" | "Video" | "TV" | "Player" => return "media",
            _ => {}
        }
    }
    "utilities"
}

/// Strip `%x` field-codes from an Exec= value and split into (program, args).
fn split_exec(raw: &str) -> Option<(String, Vec<String>)> {
    let tokens: Vec<&str> = raw
        .split_whitespace()
        .filter(|t| {
            let s = t.trim_matches('"');
            !(s.starts_with('%') && s.len() == 2)
        })
        .collect();
    let program = tokens.first()?.trim_matches('"').to_string();
    if program.is_empty() {
        return None;
    }
    let args = tokens[1..]
        .iter()
        .map(|s| s.trim_matches('"').to_string())
        .filter(|s| !s.is_empty())
        .collect();
    Some((program, args))
}

// ─────────────────────────────────────────────────────────────────────────────
// .desktop file scanning
// ─────────────────────────────────────────────────────────────────────────────

struct DesktopFields {
    name: String,
    exec: String,
    categories: String,
}

fn parse_desktop(content: &str) -> Option<DesktopFields> {
    let mut in_entry = false;
    let mut name: Option<String> = None;
    let mut exec: Option<String> = None;
    let mut categories = String::new();
    let mut no_display = false;
    let mut hidden = false;
    let mut dtype = String::new();

    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if line == "[Desktop Entry]" {
            in_entry = true;
            continue;
        }
        if line.starts_with('[') {
            if in_entry {
                break; // past the [Desktop Entry] section
            }
            continue;
        }
        if !in_entry {
            continue;
        }
        if let Some((k, v)) = line.split_once('=') {
            // Only accept the unlocalized Name= key (not Name[en]= etc.)
            match k.trim() {
                "Name" if name.is_none() => name = Some(v.to_string()),
                "Exec" if exec.is_none() => exec = Some(v.to_string()),
                "Categories" => categories = v.to_string(),
                "NoDisplay" => no_display = v.trim().eq_ignore_ascii_case("true"),
                "Hidden" => hidden = v.trim().eq_ignore_ascii_case("true"),
                "Type" => dtype = v.trim().to_string(),
                _ => {}
            }
        }
    }

    if no_display || hidden || dtype != "Application" {
        return None;
    }
    Some(DesktopFields {
        name: name?,
        exec: exec?,
        categories,
    })
}

/// Scan standard .desktop directories.  Directories are processed in order so
/// user-local files (processed last) override system ones for the same stem.
pub fn discover_desktop() -> Vec<AppEntry> {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/root".into());
    let dirs: Vec<PathBuf> = vec![
        PathBuf::from("/usr/share/applications"),
        PathBuf::from("/var/lib/flatpak/exports/share/applications"),
        PathBuf::from(&home).join(".local/share/flatpak/exports/share/applications"),
        PathBuf::from(&home).join(".local/share/applications"),
    ];

    // HashMap keyed by desktop stem; later dirs overwrite earlier for same stem.
    let mut map: HashMap<String, AppEntry> = HashMap::new();

    for dir in &dirs {
        let Ok(read_dir) = fs::read_dir(dir) else {
            continue;
        };
        for entry in read_dir.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("desktop") {
                continue;
            }
            let Ok(content) = fs::read_to_string(&path) else {
                continue;
            };
            let Some(fields) = parse_desktop(&content) else {
                continue;
            };
            let Some((exec_bin, exec_args)) = split_exec(&fields.exec) else {
                continue;
            };
            let stem = match path.file_stem().and_then(|s| s.to_str()) {
                Some(s) if !s.is_empty() => s.to_string(),
                _ => continue,
            };
            let category = xdg_to_category(&fields.categories);
            map.insert(
                stem.clone(),
                AppEntry {
                    id: stem.clone(),
                    name: fields.name,
                    exec: exec_bin,
                    args: exec_args,
                    category: category.to_string(),
                    icon_color: color_from_id(&stem),
                    source: "desktop".to_string(),
                    hidden: false,
                },
            );
        }
    }

    map.into_values().collect()
}

// ─────────────────────────────────────────────────────────────────────────────
// Flatpak fallback
// ─────────────────────────────────────────────────────────────────────────────

/// Run `flatpak list --app` and return entries whose app-id was NOT already
/// captured by a .desktop file.
pub fn discover_flatpak_extra(known_ids: &std::collections::HashSet<String>) -> Vec<AppEntry> {
    // Inside a Flatpak sandbox `flatpak` only sees the sandbox; use flatpak-spawn
    // to query the host instead.
    let sandboxed = std::env::var("FLATPAK_ID").is_ok();
    let out = if sandboxed {
        Command::new("flatpak-spawn")
            .args(["--host", "flatpak", "list", "--app", "--columns=name,application"])
            .output()
    } else {
        Command::new("flatpak")
            .args(["list", "--app", "--columns=name,application"])
            .output()
    };
    let Ok(out) = out else {
        return vec![];
    };

    String::from_utf8_lossy(&out.stdout)
        .lines()
        .filter_map(|line| {
            let mut cols = line.splitn(2, '\t');
            let name = cols.next()?.trim().to_string();
            let app_id = cols.next()?.trim().to_string();
            if name.is_empty() || app_id.is_empty() || known_ids.contains(&app_id) {
                return None;
            }
            Some(AppEntry {
                id: app_id.clone(),
                name,
                exec: "flatpak".to_string(),
                args: vec!["run".to_string(), app_id.clone()],
                category: "utilities".to_string(),
                icon_color: color_from_id(&app_id),
                source: "flatpak".to_string(),
                hidden: false,
            })
        })
        .collect()
}

// ─────────────────────────────────────────────────────────────────────────────
// Steam
// ─────────────────────────────────────────────────────────────────────────────

/// Extract a single `"key"  "value"` pair from a flat VDF/ACF text.
fn vdf_value(content: &str, key: &str) -> Option<String> {
    let needle = format!("\"{key}\"");
    for line in content.lines() {
        let line = line.trim();
        if let Some(rest) = line.strip_prefix(&needle) {
            let rest = rest.trim();
            if let Some(inner) = rest.strip_prefix('"') {
                if let Some(end) = inner.find('"') {
                    return Some(inner[..end].to_string());
                }
            }
        }
    }
    None
}

fn steam_library_roots() -> Vec<PathBuf> {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/root".into());
    let default_root = PathBuf::from(&home).join(".local/share/Steam");
    let mut roots = vec![default_root.clone()];

    let vdf = default_root.join("steamapps/libraryfolders.vdf");
    let Ok(content) = fs::read_to_string(&vdf) else {
        return roots;
    };
    for line in content.lines() {
        let line = line.trim();
        if let Some(rest) = line.strip_prefix("\"path\"") {
            let rest = rest.trim();
            if let Some(inner) = rest.strip_prefix('"') {
                if let Some(end) = inner.find('"') {
                    let p = PathBuf::from(&inner[..end]);
                    if !roots.contains(&p) {
                        roots.push(p);
                    }
                }
            }
        }
    }
    roots
}

pub fn discover_steam() -> Vec<AppEntry> {
    let mut map: HashMap<String, AppEntry> = HashMap::new();

    for root in steam_library_roots() {
        let Ok(dir) = fs::read_dir(root.join("steamapps")) else {
            continue;
        };
        for entry in dir.flatten() {
            let path = entry.path();
            let fname = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if !fname.starts_with("appmanifest_") || !fname.ends_with(".acf") {
                continue;
            }
            let Ok(content) = fs::read_to_string(&path) else {
                continue;
            };
            let Some(appid) = vdf_value(&content, "appid") else {
                continue;
            };
            let Some(app_name) = vdf_value(&content, "name") else {
                continue;
            };
            let id = format!("steam:{appid}");
            map.entry(id.clone()).or_insert_with(|| AppEntry {
                id: id.clone(),
                name: app_name,
                exec: "steam".to_string(),
                args: vec!["-applaunch".to_string(), appid],
                category: "games".to_string(),
                icon_color: color_from_id(&id),
                source: "steam".to_string(),
                hidden: false,
            });
        }
    }

    map.into_values().collect()
}

// ─────────────────────────────────────────────────────────────────────────────
// Unified entry point
// ─────────────────────────────────────────────────────────────────────────────

pub fn discover_all() -> Vec<AppEntry> {
    let desktop = discover_desktop();

    let desktop_ids: std::collections::HashSet<String> =
        desktop.iter().map(|a| a.id.clone()).collect();

    let flatpak_extra = discover_flatpak_extra(&desktop_ids);
    let steam = discover_steam();

    let mut all: Vec<AppEntry> = desktop;
    all.extend(flatpak_extra);
    all.extend(steam);

    // games → media → utilities, then alphabetical within each bucket
    let rank = |c: &str| match c {
        "games" => 0u8,
        "media" => 1,
        _ => 2,
    };
    all.sort_by(|a, b| {
        rank(&a.category)
            .cmp(&rank(&b.category))
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    all
}
