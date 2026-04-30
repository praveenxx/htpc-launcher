mod discovery;

use std::{
    collections::HashSet,
    path::PathBuf,
    process::{Command, Stdio},
    sync::Mutex,
};

use serde::{Deserialize, Serialize};
use tauri::State;

fn is_false(b: &bool) -> bool {
    !b
}

// True when the process is running inside a Flatpak sandbox.
// Child processes must go through flatpak-spawn --host to reach the real system.
fn is_sandboxed() -> bool {
    std::env::var("FLATPAK_ID").is_ok()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppEntry {
    pub id: String,
    pub name: String,
    pub exec: String,
    #[serde(default)]
    pub args: Vec<String>,
    pub category: String,
    pub icon_color: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub source: String,
    /// Omitted from TOML when false so the config stays readable.
    #[serde(default, skip_serializing_if = "is_false")]
    pub hidden: bool,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct AppConfig {
    apps: Vec<AppEntry>,
}

pub struct AppState {
    pub apps: Mutex<Vec<AppEntry>>,
}

fn config_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());
    PathBuf::from(home)
        .join(".config")
        .join("htpc-launcher")
        .join("apps.toml")
}

fn default_config() -> AppConfig {
    AppConfig {
        apps: vec![
            AppEntry {
                id: "firefox".into(),
                name: "Firefox".into(),
                exec: "firefox".into(),
                args: vec![],
                category: "utilities".into(),
                icon_color: "#e25c00".into(),
                source: String::new(),
                hidden: false,
            },
            AppEntry {
                id: "steam".into(),
                name: "Steam".into(),
                exec: "steam".into(),
                args: vec![],
                category: "games".into(),
                icon_color: "#1b2838".into(),
                source: String::new(),
                hidden: false,
            },
            AppEntry {
                id: "vlc".into(),
                name: "VLC".into(),
                exec: "vlc".into(),
                args: vec![],
                category: "media".into(),
                icon_color: "#f07000".into(),
                source: String::new(),
                hidden: false,
            },
            AppEntry {
                id: "kodi".into(),
                name: "Kodi".into(),
                exec: "kodi".into(),
                args: vec![],
                category: "media".into(),
                icon_color: "#17b2e8".into(),
                source: String::new(),
                hidden: false,
            },
            AppEntry {
                id: "retroarch".into(),
                name: "RetroArch".into(),
                exec: "retroarch".into(),
                args: vec![],
                category: "games".into(),
                icon_color: "#2c2c2c".into(),
                source: String::new(),
                hidden: false,
            },
        ],
    }
}

fn load_or_create_config() -> AppConfig {
    let path = config_path();
    if let Ok(content) = std::fs::read_to_string(&path) {
        return toml::from_str(&content).unwrap_or_else(|_| default_config());
    }
    let cfg = default_config();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(serialized) = toml::to_string(&cfg) {
        let _ = std::fs::write(&path, serialized);
    }
    cfg
}

// ─── Commands ────────────────────────────────────────────────────────────────

/// Returns only the TOML-pinned apps (including hidden ones) for the settings screen.
#[tauri::command]
fn get_apps(state: State<AppState>) -> Vec<AppEntry> {
    state.apps.lock().unwrap().clone()
}

/// Persist a new pinned-app list to TOML and update in-memory state.
#[tauri::command]
fn save_apps(state: State<AppState>, apps: Vec<AppEntry>) -> Result<(), String> {
    let path = config_path();
    let cfg = AppConfig { apps: apps.clone() };
    let serialized = toml::to_string(&cfg).map_err(|e| format!("Serialize error: {e}"))?;
    std::fs::write(&path, serialized).map_err(|e| format!("Write error: {e}"))?;
    *state.apps.lock().unwrap() = apps;
    Ok(())
}

/// Merge visible TOML-pinned apps with system-discovered apps.
/// Hidden TOML apps are excluded from the result but still block their id
/// from reappearing via auto-discovery.
#[tauri::command]
fn discover_apps(state: State<AppState>) -> Vec<AppEntry> {
    let all_manual = state.apps.lock().unwrap().clone();

    // All TOML ids block duplicates from discovery, even if hidden.
    let manual_ids: HashSet<String> = all_manual.iter().map(|a| a.id.clone()).collect();

    // Only visible TOML apps are shown in the grid.
    let visible_manual: Vec<AppEntry> = all_manual.into_iter().filter(|a| !a.hidden).collect();

    let discovered = discovery::discover_all();

    let mut result = visible_manual;
    for app in discovered {
        if !manual_ids.contains(&app.id) {
            result.push(app);
        }
    }
    result
}

#[tauri::command]
fn launch_app(id: String, exec: String, args: Vec<String>) -> Result<(), String> {
    let (bin, bin_args): (String, Vec<String>) = if is_sandboxed() {
        // flatpak-spawn --host is blocked by Bazzite's sandbox policy.
        // Route through the OpenURI portal instead: xdg-open in GNOME Platform
        // runtimes is portal-aware and forwards to org.freedesktop.portal.OpenURI
        // on the host, which is always permitted without extra manifest flags.
        let uri = if let Some(appid) = id.strip_prefix("steam:") {
            format!("steam://rungameid/{appid}")
        } else {
            format!("application://{id}.desktop")
        };
        ("xdg-open".to_string(), vec![uri])
    } else {
        (exec.clone(), args)
    };

    let mut cmd = Command::new(&bin);
    cmd.args(&bin_args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        cmd.process_group(0);
    }

    cmd.spawn()
        .map_err(|e| format!("Failed to launch '{exec}': {e}"))?;
    Ok(())
}

// ─── Entry point ─────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let config = load_or_create_config();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            apps: Mutex::new(config.apps),
        })
        .invoke_handler(tauri::generate_handler![
            get_apps,
            save_apps,
            discover_apps,
            launch_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
