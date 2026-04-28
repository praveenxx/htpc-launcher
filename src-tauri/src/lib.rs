mod discovery;

use std::{
    collections::HashSet,
    path::PathBuf,
    process::{Command, Stdio},
    sync::Mutex,
};

use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppEntry {
    pub id: String,
    pub name: String,
    pub exec: String,
    #[serde(default)]
    pub args: Vec<String>,
    pub category: String,
    pub icon_color: String,
    /// "desktop" | "flatpak" | "steam" | "" (manual/TOML).
    /// Omitted from TOML when empty so the config file stays clean.
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub source: String,
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
            },
            AppEntry {
                id: "steam".into(),
                name: "Steam".into(),
                exec: "steam".into(),
                args: vec![],
                category: "games".into(),
                icon_color: "#1b2838".into(),
                source: String::new(),
            },
            AppEntry {
                id: "vlc".into(),
                name: "VLC".into(),
                exec: "vlc".into(),
                args: vec![],
                category: "media".into(),
                icon_color: "#f07000".into(),
                source: String::new(),
            },
            AppEntry {
                id: "kodi".into(),
                name: "Kodi".into(),
                exec: "kodi".into(),
                args: vec![],
                category: "media".into(),
                icon_color: "#17b2e8".into(),
                source: String::new(),
            },
            AppEntry {
                id: "retroarch".into(),
                name: "RetroArch".into(),
                exec: "retroarch".into(),
                args: vec![],
                category: "games".into(),
                icon_color: "#2c2c2c".into(),
                source: String::new(),
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

#[tauri::command]
fn get_apps(state: State<AppState>) -> Vec<AppEntry> {
    state.apps.lock().unwrap().clone()
}

/// Merge TOML-pinned apps with system-discovered apps and return the full list.
/// Manual (TOML) entries take precedence and always appear first.
#[tauri::command]
fn discover_apps(state: State<AppState>) -> Vec<AppEntry> {
    let manual = state.apps.lock().unwrap().clone();
    let manual_ids: HashSet<String> = manual.iter().map(|a| a.id.clone()).collect();

    let discovered = discovery::discover_all();

    let mut result = manual;
    for app in discovered {
        if !manual_ids.contains(&app.id) {
            result.push(app);
        }
    }
    result
}

#[tauri::command]
fn launch_app(exec: String, args: Vec<String>) -> Result<(), String> {
    let mut cmd = Command::new(&exec);
    cmd.args(&args)
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
        .invoke_handler(tauri::generate_handler![get_apps, discover_apps, launch_app])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
