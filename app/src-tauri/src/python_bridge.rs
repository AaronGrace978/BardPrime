//! BardPrime Python Bridge
//!
//! Calls the Python BardPrime core via subprocess with JSON payloads.
//! Includes caching, timeout handling, and fallback Python discovery.

use serde_json::Value;
use std::collections::HashMap;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tokio::sync::oneshot;
use tokio::time::timeout;

struct CachedResult {
    value: Value,
    expires_at: Instant,
}

struct PythonPool {
    cache: HashMap<String, CachedResult>,
    bardprime_path: String,
    python_path: String,
}

lazy_static::lazy_static! {
    static ref PYTHON_POOL: Arc<Mutex<Option<PythonPool>>> = Arc::new(Mutex::new(None));
}

fn find_python() -> Result<String, String> {
    if let Ok(custom) = std::env::var("BARDPRIME_PYTHON") {
        let result = Command::new(&custom).args(["--version"]).output();
        if let Ok(output) = result {
            if output.status.success() {
                log::info!("Found Python via BARDPRIME_PYTHON: {}", custom);
                return Ok(custom);
            }
        }
        log::warn!("BARDPRIME_PYTHON={} is set but not a valid Python", custom);
    }

    let candidates = if cfg!(target_os = "windows") {
        vec!["python", "python3", "py"]
    } else {
        vec!["python3", "python"]
    };

    for path in candidates {
        let result = Command::new(path).args(["--version"]).output();
        if let Ok(output) = result {
            if output.status.success() {
                log::info!("Found Python at: {}", path);
                return Ok(path.to_string());
            }
        }
    }

    Err("Could not find Python. Set BARDPRIME_PYTHON or ensure python is on PATH.".to_string())
}

fn get_bardprime_path() -> Result<String, String> {
    // exe is in: BardPrime/app/src-tauri/target/{debug|release}/bardprime.exe
    // We need: BardPrime/
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Failed to get exe path: {}", e))?;

    let bardprime_path = exe_path
        .parent() // target/debug or target/release
        .and_then(|p| p.parent()) // target
        .and_then(|p| p.parent()) // src-tauri
        .and_then(|p| p.parent()) // app
        .and_then(|p| p.parent()) // BardPrime (root)
        .ok_or("Could not find BardPrime root directory")?
        .to_path_buf();

    // Verify bardprime.py exists
    let entry = bardprime_path.join("bardprime.py");
    if !entry.exists() {
        return Err(format!(
            "bardprime.py not found at {}",
            entry.display()
        ));
    }

    Ok(bardprime_path.display().to_string())
}

fn init_pool() -> Result<(), String> {
    let mut pool = PYTHON_POOL.lock().map_err(|e| e.to_string())?;

    if pool.is_some() {
        return Ok(());
    }

    let python_path = find_python()?;
    let bardprime_path = get_bardprime_path()?;

    log::info!("Initializing BardPrime Python bridge");
    log::info!("  Python: {}", python_path);
    log::info!("  BardPrime: {}", bardprime_path);

    *pool = Some(PythonPool {
        cache: HashMap::new(),
        bardprime_path,
        python_path,
    });

    Ok(())
}

fn cache_key(action: &str, args: &Value) -> String {
    format!("{}:{}", action, args.to_string())
}

fn should_cache(action: &str) -> Option<Duration> {
    match action {
        "get_emotions" | "get_genres" => Some(Duration::from_secs(3600)),
        "journal_stats" | "library_stats" => Some(Duration::from_secs(30)),
        _ => None,
    }
}

pub async fn call_python(payload: &Value) -> Result<Value, String> {
    init_pool()?;

    let action = payload
        .get("action")
        .and_then(|a| a.as_str())
        .unwrap_or("unknown");
    let key = cache_key(action, payload);

    // Check cache
    {
        let pool = PYTHON_POOL.lock().map_err(|e| e.to_string())?;
        if let Some(ref p) = *pool {
            if let Some(cached) = p.cache.get(&key) {
                if cached.expires_at > Instant::now() {
                    log::debug!("Cache hit for {}", action);
                    return Ok(cached.value.clone());
                }
            }
        }
    }

    let timeout_secs = match action {
        "compose" => 300,       // 5 min for full composition
        "generate_lyrics" => 60,
        "compose_procedural" => 30,
        _ => 60,
    };

    let result = timeout(
        Duration::from_secs(timeout_secs),
        execute_python_call(payload),
    )
    .await
    .map_err(|_| format!("Python call timed out for action '{}'", action))?;

    // Cache if applicable
    if let (Ok(ref value), Some(ttl)) = (&result, should_cache(action)) {
        let mut pool = PYTHON_POOL.lock().map_err(|e| e.to_string())?;
        if let Some(ref mut p) = *pool {
            p.cache.insert(
                key,
                CachedResult {
                    value: value.clone(),
                    expires_at: Instant::now() + ttl,
                },
            );
        }
    }

    result
}

fn build_python_command(
    python_path: &str,
    bardprime_path: &str,
    payload_str: &str,
) -> Command {
    let script_path = std::path::Path::new(bardprime_path)
        .join("bardprime.py")
        .display()
        .to_string();

    let mut cmd = Command::new(python_path);
    cmd.args([&script_path, "--payload", payload_str])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .env("PYTHONPATH", bardprime_path);

    if let Some(key) = crate::secrets::get_elevenlabs_api_key() {
        if !key.trim().is_empty() {
            cmd.env("ELEVENLABS_API_KEY", key);
        }
    }
    if let Some(key) = crate::secrets::get_llm_api_key() {
        if !key.trim().is_empty() {
            cmd.env("LLM_API_KEY", &key);
        }
    }
    if let Some(config_json) = crate::secrets::get_llm_config() {
        if let Ok(cfg) = serde_json::from_str::<serde_json::Value>(&config_json) {
            if let Some(p) = cfg["provider"].as_str() {
                cmd.env("LLM_PROVIDER", p);
            }
            if let Some(u) = cfg["base_url"].as_str() {
                if !u.is_empty() {
                    cmd.env("LLM_BASE_URL", u);
                }
            }
            if let Some(m) = cfg["model"].as_str() {
                if !m.is_empty() {
                    cmd.env("LLM_MODEL", m);
                }
            }
            if let Some(h) = cfg["ollama_host"].as_str() {
                if !h.is_empty() {
                    cmd.env("OLLAMA_HOST", h);
                }
            }
            if let Some(m) = cfg["ollama_model"].as_str() {
                if !m.is_empty() {
                    cmd.env("OLLAMA_MODEL", m);
                }
            }
            if let Some(k) = cfg["ollama_api_key"].as_str() {
                if !k.is_empty() {
                    cmd.env("OLLAMA_API_KEY", k);
                }
            }
        }
    }
    if let Some(model) = crate::secrets::get_music_model() {
        if !model.trim().is_empty() {
            cmd.env("ELEVENLABS_MUSIC_MODEL", model);
        }
    }

    cmd
}

fn parse_python_output(output: std::process::Output) -> Result<Value, String> {
    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let trimmed = stdout.trim();

        let result: Value = match serde_json::from_str(trimmed) {
            Ok(v) => v,
            Err(first_err) => {
                let start = trimmed.find('{');
                let end = trimmed.rfind('}');
                if let (Some(s), Some(e)) = (start, end) {
                    if e > s {
                        serde_json::from_str(&trimmed[s..=e]).map_err(|e| {
                            format!("Failed to parse Python output: {} - Output: {}", e, stdout)
                        })?
                    } else {
                        return Err(format!("Parse error: {} - Output: {}", first_err, stdout));
                    }
                } else {
                    return Err(format!("Parse error: {} - Output: {}", first_err, stdout));
                }
            }
        };

        if let Some(error) = result.get("error").and_then(|e| e.as_str()) {
            let tb = result
                .get("traceback")
                .and_then(|t| t.as_str())
                .unwrap_or("");
            log::error!("Python error: {}\n{}", error, tb);
            return Err(format!("Python error: {}", error));
        }

        Ok(result)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        log::error!("Python execution failed: {}", stderr);
        Err(format!("Python execution failed: {}", stderr))
    }
}

async fn execute_python_call(payload: &Value) -> Result<Value, String> {
    let (python_path, bardprime_path) = {
        let pool = PYTHON_POOL.lock().map_err(|e| e.to_string())?;
        let p = pool.as_ref().ok_or("Pool not initialized")?;
        (p.python_path.clone(), p.bardprime_path.clone())
    };

    let payload_str = payload.to_string();
    let (tx, rx) = oneshot::channel();

    std::thread::spawn(move || {
        let output = build_python_command(&python_path, &bardprime_path, &payload_str).output();
        let _ = tx.send(output);
    });

    let output = rx
        .await
        .map_err(|_| "Python thread was cancelled")?
        .map_err(|e| format!("Failed to execute Python: {}", e))?;

    parse_python_output(output)
}

pub async fn call_python_cancellable(
    payload: &Value,
    cancel: Arc<AtomicBool>,
) -> Result<Value, String> {
    init_pool()?;

    let action = payload
        .get("action")
        .and_then(|a| a.as_str())
        .unwrap_or("unknown");
    let key = cache_key(action, payload);

    {
        let pool = PYTHON_POOL.lock().map_err(|e| e.to_string())?;
        if let Some(ref p) = *pool {
            if let Some(cached) = p.cache.get(&key) {
                if cached.expires_at > Instant::now() {
                    return Ok(cached.value.clone());
                }
            }
        }
    }

    let timeout_secs = match action {
        "compose" => 300,
        "generate_lyrics" => 60,
        "compose_procedural" => 30,
        _ => 60,
    };

    let result = timeout(
        Duration::from_secs(timeout_secs),
        execute_python_call_cancellable(payload, cancel),
    )
    .await
    .map_err(|_| format!("Python call timed out for action '{}'", action))?;

    if let (Ok(ref value), Some(ttl)) = (&result, should_cache(action)) {
        let mut pool = PYTHON_POOL.lock().map_err(|e| e.to_string())?;
        if let Some(ref mut p) = *pool {
            p.cache.insert(
                key,
                CachedResult {
                    value: value.clone(),
                    expires_at: Instant::now() + ttl,
                },
            );
        }
    }

    result
}

async fn execute_python_call_cancellable(
    payload: &Value,
    cancel: Arc<AtomicBool>,
) -> Result<Value, String> {
    let (python_path, bardprime_path) = {
        let pool = PYTHON_POOL.lock().map_err(|e| e.to_string())?;
        let p = pool.as_ref().ok_or("Pool not initialized")?;
        (p.python_path.clone(), p.bardprime_path.clone())
    };

    let payload_str = payload.to_string();
    let (tx, rx) = oneshot::channel();

    std::thread::spawn(move || {
        let mut cmd = build_python_command(&python_path, &bardprime_path, &payload_str);

        match cmd.spawn() {
            Ok(mut child) => {
                loop {
                    if cancel.load(Ordering::SeqCst) {
                        let _ = child.kill();
                        let _ = child.wait();
                        let _ = tx.send(Err(std::io::Error::new(
                            std::io::ErrorKind::Interrupted,
                            "Composition cancelled",
                        )));
                        return;
                    }
                    match child.try_wait() {
                        Ok(Some(_)) => break,
                        Ok(None) => {
                            std::thread::sleep(std::time::Duration::from_millis(100));
                        }
                        Err(e) => {
                            let _ = tx.send(Err(e));
                            return;
                        }
                    }
                }
                let _ = tx.send(child.wait_with_output());
            }
            Err(e) => {
                let _ = tx.send(Err(e));
            }
        }
    });

    let output = rx
        .await
        .map_err(|_| "Python thread was cancelled")?
        .map_err(|e| format!("Failed to execute Python: {}", e))?;

    parse_python_output(output)
}

pub fn clear_cache() {
    if let Ok(mut pool) = PYTHON_POOL.lock() {
        if let Some(ref mut p) = *pool {
            p.cache.clear();
            log::info!("BardPrime cache cleared");
        }
    }
}
