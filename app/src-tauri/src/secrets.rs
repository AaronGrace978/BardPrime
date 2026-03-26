//! Secure secret storage for API keys using the OS keychain.
#![allow(dead_code)]

const SERVICE: &str = "bardprime";

pub fn get_elevenlabs_api_key() -> Option<String> {
    keyring::Entry::new(SERVICE, "elevenlabs_api_key")
        .ok()
        .and_then(|e| e.get_password().ok())
}

pub fn set_elevenlabs_api_key(key: &str) -> Result<(), String> {
    keyring::Entry::new(SERVICE, "elevenlabs_api_key")
        .map_err(|e| e.to_string())?
        .set_password(key)
        .map_err(|e| format!("Failed to store ElevenLabs key: {}", e))
}

pub fn clear_elevenlabs_api_key() -> Result<(), String> {
    keyring::Entry::new(SERVICE, "elevenlabs_api_key")
        .map_err(|e| e.to_string())?
        .delete_credential()
        .map_err(|e| format!("Failed to clear ElevenLabs key: {}", e))
}

pub fn get_llm_api_key() -> Option<String> {
    keyring::Entry::new(SERVICE, "llm_api_key")
        .ok()
        .and_then(|e| e.get_password().ok())
}

pub fn set_llm_api_key(key: &str) -> Result<(), String> {
    keyring::Entry::new(SERVICE, "llm_api_key")
        .map_err(|e| e.to_string())?
        .set_password(key)
        .map_err(|e| format!("Failed to store LLM key: {}", e))
}

pub fn clear_llm_api_key() -> Result<(), String> {
    keyring::Entry::new(SERVICE, "llm_api_key")
        .map_err(|e| e.to_string())?
        .delete_credential()
        .map_err(|e| format!("Failed to clear LLM key: {}", e))
}

pub fn get_llm_config() -> Option<String> {
    keyring::Entry::new(SERVICE, "llm_config")
        .ok()
        .and_then(|e| e.get_password().ok())
}

pub fn set_llm_config(config_json: &str) -> Result<(), String> {
    keyring::Entry::new(SERVICE, "llm_config")
        .map_err(|e| e.to_string())?
        .set_password(config_json)
        .map_err(|e| format!("Failed to store LLM config: {}", e))
}

pub fn get_music_model() -> Option<String> {
    keyring::Entry::new(SERVICE, "elevenlabs_music_model")
        .ok()
        .and_then(|e| e.get_password().ok())
}

pub fn set_music_model(model: &str) -> Result<(), String> {
    keyring::Entry::new(SERVICE, "elevenlabs_music_model")
        .map_err(|e| e.to_string())?
        .set_password(model)
        .map_err(|e| format!("Failed to store music model: {}", e))
}

pub fn clear_music_model() -> Result<(), String> {
    keyring::Entry::new(SERVICE, "elevenlabs_music_model")
        .map_err(|e| e.to_string())?
        .delete_credential()
        .map_err(|e| format!("Failed to clear music model: {}", e))
}

pub fn masked_key(key: &str) -> String {
    if key.len() <= 8 {
        return "****".to_string();
    }
    format!("{}...{}", &key[..4], &key[key.len() - 4..])
}
