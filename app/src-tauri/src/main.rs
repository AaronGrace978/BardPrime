// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod python_bridge;
mod secrets;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::Emitter;
use tauri::Manager;
use tauri::State;
use uuid::Uuid;

pub struct AppState {
    pub jobs: Mutex<HashMap<String, Arc<AtomicBool>>>,
    pub current_sink: Arc<Mutex<Option<rodio::Sink>>>,
}

// ── Compose (full pipeline) ──────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ComposeRequest {
    pub topic: String,
    pub emotion: String,
    pub genre: String,
    pub user_name: Option<String>,
    pub extra_instructions: Option<String>,
    pub instrumental: Option<bool>,
    pub duration_sec: Option<f32>,
    pub verse_count: Option<u32>,
    pub include_bridge: Option<bool>,
    pub custom_lyrics: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ComposeProgressEvent {
    pub job_id: String,
    pub step: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ComposeCompleteEvent {
    pub job_id: String,
    pub success: bool,
    pub song_id: String,
    pub title: String,
    pub lyrics: String,
    pub music_prompt: String,
    pub audio_b64: String,
    pub file_path: String,
    pub duration_sec: f32,
    pub engine: String,
    pub genre: String,
    pub emotion: String,
    pub mood_tags: Vec<String>,
    pub error: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ComposeErrorEvent {
    pub job_id: String,
    pub error: String,
}

#[tauri::command]
async fn start_compose(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    req: ComposeRequest,
) -> Result<String, String> {
    let job_id = Uuid::new_v4().to_string();
    let cancel_flag = Arc::new(AtomicBool::new(false));
    {
        let mut jobs = state.jobs.lock().map_err(|e| e.to_string())?;
        jobs.insert(job_id.clone(), Arc::clone(&cancel_flag));
    }

    let app_handle = app.clone();
    let job_id_clone = job_id.clone();
    let cancel = Arc::clone(&cancel_flag);

    tauri::async_runtime::spawn(async move {
        let emit_progress = |step: &str| {
            let _ = app_handle.emit(
                "compose_progress",
                ComposeProgressEvent {
                    job_id: job_id_clone.clone(),
                    step: step.to_string(),
                },
            );
        };

        emit_progress("Starting composition...");

        let payload = serde_json::json!({
            "action": "compose",
            "topic": req.topic,
            "emotion": req.emotion,
            "genre": req.genre,
            "user_name": req.user_name.unwrap_or_default(),
            "extra_instructions": req.extra_instructions.unwrap_or_default(),
            "instrumental": req.instrumental.unwrap_or(false),
            "duration_sec": req.duration_sec.unwrap_or(60.0),
            "verse_count": req.verse_count.unwrap_or(2),
            "include_bridge": req.include_bridge.unwrap_or(true),
            "custom_lyrics": req.custom_lyrics.unwrap_or_default(),
        });

        match python_bridge::call_python_cancellable(&payload, cancel).await {
            Ok(result) => {
                let mood_tags: Vec<String> = result["mood_tags"]
                    .as_array()
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|v| v.as_str().map(|s| s.to_string()))
                            .collect()
                    })
                    .unwrap_or_default();

                let _ = app_handle.emit(
                    "compose_complete",
                    ComposeCompleteEvent {
                        job_id: job_id_clone.clone(),
                        success: result["success"].as_bool().unwrap_or(false),
                        song_id: result["song_id"]
                            .as_str()
                            .unwrap_or("")
                            .to_string(),
                        title: result["title"].as_str().unwrap_or("").to_string(),
                        lyrics: result["lyrics"].as_str().unwrap_or("").to_string(),
                        music_prompt: result["music_prompt"]
                            .as_str()
                            .unwrap_or("")
                            .to_string(),
                        audio_b64: result["audio_b64"]
                            .as_str()
                            .unwrap_or("")
                            .to_string(),
                        file_path: result["file_path"]
                            .as_str()
                            .unwrap_or("")
                            .to_string(),
                        duration_sec: result["duration_sec"].as_f64().unwrap_or(0.0)
                            as f32,
                        engine: result["engine"].as_str().unwrap_or("").to_string(),
                        genre: result["genre"].as_str().unwrap_or("").to_string(),
                        emotion: result["emotion"].as_str().unwrap_or("").to_string(),
                        mood_tags,
                        error: result["error"].as_str().unwrap_or("").to_string(),
                    },
                );
            }
            Err(e) => {
                let _ = app_handle.emit(
                    "compose_error",
                    ComposeErrorEvent {
                        job_id: job_id_clone.clone(),
                        error: e,
                    },
                );
            }
        }

        // Cleanup
        if let Some(state) = app_handle.try_state::<AppState>() {
            if let Ok(mut jobs) = state.jobs.lock() {
                let _: Option<Arc<AtomicBool>> = jobs.remove(&job_id_clone);
            }
        }
    });

    Ok(job_id)
}

#[tauri::command]
async fn cancel_compose(state: State<'_, AppState>, job_id: String) -> Result<bool, String> {
    let jobs = state.jobs.lock().map_err(|e| e.to_string())?;
    if let Some(flag) = jobs.get(&job_id) {
        flag.store(true, Ordering::SeqCst);
        Ok(true)
    } else {
        Ok(false)
    }
}

// ── Lyrics only ──────────────────────────────────────────────────────

#[tauri::command]
async fn generate_lyrics(
    topic: String,
    emotion: String,
    genre: String,
    user_name: Option<String>,
    extra_instructions: Option<String>,
    journal_context: Option<String>,
) -> Result<serde_json::Value, String> {
    let payload = serde_json::json!({
        "action": "generate_lyrics",
        "topic": topic,
        "emotion": emotion,
        "genre": genre,
        "user_name": user_name.unwrap_or_default(),
        "extra_instructions": extra_instructions.unwrap_or_default(),
        "journal_context": journal_context.unwrap_or_default(),
    });
    python_bridge::call_python(&payload).await
}

// ── Procedural compose (no API needed) ──────────────────────────────

#[tauri::command]
async fn start_compose_procedural(
    emotion: String,
    duration_sec: Option<f32>,
) -> Result<serde_json::Value, String> {
    let payload = serde_json::json!({
        "action": "compose_procedural",
        "emotion": emotion,
        "duration_sec": duration_sec.unwrap_or(30.0),
    });
    python_bridge::call_python(&payload).await
}

// ── Journal ──────────────────────────────────────────────────────────

#[tauri::command]
async fn journal_add(
    text: String,
    tags: Vec<String>,
    emotion: String,
    people: Vec<String>,
    places: Vec<String>,
) -> Result<serde_json::Value, String> {
    let payload = serde_json::json!({
        "action": "journal_add",
        "text": text,
        "tags": tags,
        "emotion": emotion,
        "people": people,
        "places": places,
    });
    python_bridge::call_python(&payload).await
}

#[tauri::command]
async fn journal_list(limit: Option<u32>) -> Result<serde_json::Value, String> {
    let payload = serde_json::json!({
        "action": "journal_list",
        "limit": limit.unwrap_or(50),
    });
    python_bridge::call_python(&payload).await
}

#[tauri::command]
async fn journal_delete(entry_id: String) -> Result<serde_json::Value, String> {
    let payload = serde_json::json!({
        "action": "journal_delete",
        "entry_id": entry_id,
    });
    python_bridge::call_python(&payload).await
}

#[tauri::command]
async fn journal_stats() -> Result<serde_json::Value, String> {
    python_bridge::call_python(&serde_json::json!({"action": "journal_stats"})).await
}

// ── Library ──────────────────────────────────────────────────────────

#[tauri::command]
async fn library_list(limit: Option<u32>) -> Result<serde_json::Value, String> {
    let payload = serde_json::json!({
        "action": "library_list",
        "limit": limit.unwrap_or(100),
    });
    python_bridge::call_python(&payload).await
}

#[tauri::command]
async fn library_search(query: String) -> Result<serde_json::Value, String> {
    let payload = serde_json::json!({
        "action": "library_search",
        "query": query,
    });
    python_bridge::call_python(&payload).await
}

#[tauri::command]
async fn library_delete(song_id: String) -> Result<serde_json::Value, String> {
    let payload = serde_json::json!({
        "action": "library_delete",
        "song_id": song_id,
    });
    python_bridge::call_python(&payload).await
}

#[tauri::command]
async fn library_favorite(song_id: String) -> Result<serde_json::Value, String> {
    let payload = serde_json::json!({
        "action": "library_favorite",
        "song_id": song_id,
    });
    python_bridge::call_python(&payload).await
}

#[tauri::command]
async fn library_stats() -> Result<serde_json::Value, String> {
    python_bridge::call_python(&serde_json::json!({"action": "library_stats"})).await
}

// ── Chat ─────────────────────────────────────────────────────────────

#[tauri::command]
async fn chat(message: String) -> Result<serde_json::Value, String> {
    let payload = serde_json::json!({
        "action": "chat",
        "message": message,
    });
    python_bridge::call_python(&payload).await
}

// ── Metadata ─────────────────────────────────────────────────────────

#[tauri::command]
async fn get_emotions() -> Result<serde_json::Value, String> {
    python_bridge::call_python(&serde_json::json!({"action": "get_emotions"})).await
}

#[tauri::command]
async fn get_genres() -> Result<serde_json::Value, String> {
    python_bridge::call_python(&serde_json::json!({"action": "get_genres"})).await
}

// ── Secrets ──────────────────────────────────────────────────────────

#[tauri::command]
async fn set_elevenlabs_key(api_key: String) -> Result<bool, String> {
    secrets::set_elevenlabs_api_key(api_key.trim())?;
    python_bridge::clear_cache();
    Ok(true)
}

#[tauri::command]
async fn set_llm_key(api_key: String) -> Result<bool, String> {
    secrets::set_llm_api_key(api_key.trim())?;
    python_bridge::clear_cache();
    Ok(true)
}

#[tauri::command]
async fn has_elevenlabs_key() -> Result<bool, String> {
    Ok(secrets::get_elevenlabs_api_key()
        .map(|k| !k.trim().is_empty())
        .unwrap_or(false))
}

#[tauri::command]
async fn has_llm_key() -> Result<bool, String> {
    Ok(secrets::get_llm_api_key()
        .map(|k| !k.trim().is_empty())
        .unwrap_or(false))
}

#[tauri::command]
async fn set_llm_config(config_json: String) -> Result<bool, String> {
    secrets::set_llm_config(&config_json)?;
    python_bridge::clear_cache();
    Ok(true)
}

#[tauri::command]
async fn get_llm_config() -> Result<String, String> {
    Ok(secrets::get_llm_config().unwrap_or_default())
}

#[tauri::command]
async fn set_music_model(model: String) -> Result<bool, String> {
    secrets::set_music_model(model.trim())?;
    python_bridge::clear_cache();
    Ok(true)
}

#[tauri::command]
async fn get_music_model() -> Result<String, String> {
    Ok(secrets::get_music_model().unwrap_or_default())
}

// ── Playback ─────────────────────────────────────────────────────────

#[tauri::command]
async fn play_audio_file(
    state: State<'_, AppState>,
    file_path: String,
) -> Result<bool, String> {
    use std::fs::File;
    use std::io::BufReader;

    let path = std::path::Path::new(&file_path);
    if !path.exists() {
        return Err(format!("Audio file not found: {}", file_path));
    }

    {
        let mut guard = state.current_sink.lock().map_err(|e| e.to_string())?;
        if let Some(sink) = guard.take() {
            sink.stop();
        }
    }

    let sink_state = Arc::clone(&state.current_sink);

    std::thread::spawn(move || {
        match rodio::OutputStream::try_default() {
            Ok((_stream, handle)) => {
                if let Ok(sink) = rodio::Sink::try_new(&handle) {
                    if let Ok(file) = File::open(&file_path) {
                        let reader = BufReader::new(file);
                        if let Ok(source) = rodio::Decoder::new(reader) {
                            sink.append(source);

                            if let Ok(mut guard) = sink_state.lock() {
                                *guard = Some(sink);
                            }

                            loop {
                                std::thread::sleep(std::time::Duration::from_millis(100));
                                let done = sink_state
                                    .lock()
                                    .map(|g| g.as_ref().map_or(true, |s| s.empty()))
                                    .unwrap_or(true);
                                if done {
                                    break;
                                }
                            }

                            if let Ok(mut guard) = sink_state.lock() {
                                if guard.as_ref().map_or(false, |s| s.empty()) {
                                    *guard = None;
                                }
                            }
                        }
                    }
                }
            }
            Err(e) => log::error!("Audio output error: {}", e),
        }
    });

    Ok(true)
}

#[tauri::command]
async fn stop_audio(state: State<'_, AppState>) -> Result<bool, String> {
    let mut guard = state.current_sink.lock().map_err(|e| e.to_string())?;
    if let Some(sink) = guard.take() {
        sink.stop();
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
async fn pause_audio(state: State<'_, AppState>) -> Result<bool, String> {
    let guard = state.current_sink.lock().map_err(|e| e.to_string())?;
    if let Some(ref sink) = *guard {
        sink.pause();
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
async fn resume_audio(state: State<'_, AppState>) -> Result<bool, String> {
    let guard = state.current_sink.lock().map_err(|e| e.to_string())?;
    if let Some(ref sink) = *guard {
        sink.play();
        Ok(true)
    } else {
        Ok(false)
    }
}

// ── Export ───────────────────────────────────────────────────────────

#[tauri::command]
async fn export_song(source: String, destination: String) -> Result<bool, String> {
    let src = std::path::Path::new(&source);
    if !src.exists() {
        return Err(format!("Source file not found: {}", source));
    }
    std::fs::copy(src, &destination)
        .map_err(|e| format!("Failed to export: {}", e))?;
    Ok(true)
}

// ── Ping ─────────────────────────────────────────────────────────────

#[tauri::command]
async fn ping() -> Result<serde_json::Value, String> {
    python_bridge::call_python(&serde_json::json!({"action": "ping"})).await
}

// ── Main ─────────────────────────────────────────────────────────────

fn main() {
    env_logger::init();

    let app_state = AppState {
        jobs: Mutex::new(HashMap::new()),
        current_sink: Arc::new(Mutex::new(None)),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            // Composition
            start_compose,
            cancel_compose,
            generate_lyrics,
            start_compose_procedural,
            // Journal
            journal_add,
            journal_list,
            journal_delete,
            journal_stats,
            // Library
            library_list,
            library_search,
            library_delete,
            library_favorite,
            library_stats,
            // Chat
            chat,
            // Metadata
            get_emotions,
            get_genres,
            // Secrets
            set_elevenlabs_key,
            set_llm_key,
            has_elevenlabs_key,
            has_llm_key,
            set_llm_config,
            get_llm_config,
            set_music_model,
            get_music_model,
            // Playback
            play_audio_file,
            stop_audio,
            pause_audio,
            resume_audio,
            // Export
            export_song,
            // Health
            ping,
        ])
        .run(tauri::generate_context!())
        .expect("error while running BardPrime");
}
