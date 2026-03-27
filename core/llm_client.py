"""
Shared LLM provider client logic for BardPrime.

Centralizes provider configuration checks, chat-completion calls, and
connectivity diagnostics so chat and lyrics behave consistently.
"""

from __future__ import annotations

import json
from dataclasses import dataclass

import requests

from core.config import LLMConfig


class LLMClientError(RuntimeError):
    """Raised when the selected LLM provider cannot be used."""


@dataclass
class LLMTestResult:
    success: bool
    provider: str
    model: str
    message: str = ""
    error: str = ""


@dataclass
class OllamaModelInfo:
    name: str
    size: int = 0
    family: str = ""
    parameter_size: str = ""


def provider_label(provider: str) -> str:
    return {
        "anthropic": "Anthropic",
        "openai": "OpenAI",
        "ollama": "Ollama",
        "ollama_cloud": "Ollama Cloud",
    }.get(provider, provider or "LLM")


def resolve_model(cfg: LLMConfig) -> str:
    if cfg.provider == "anthropic":
        return cfg.model or "claude-sonnet-4-6-20260217"
    if cfg.provider == "openai":
        return cfg.model or "gpt-5.4-mini"
    return cfg.ollama_model or "llama3"


def is_configured(cfg: LLMConfig) -> bool:
    if cfg.provider == "ollama":
        return bool((cfg.ollama_host or "").strip() and resolve_model(cfg).strip())
    if cfg.provider == "ollama_cloud":
        return bool((cfg.ollama_api_key or "").strip() and resolve_model(cfg).strip())
    return bool((cfg.api_key or "").strip() and resolve_model(cfg).strip())


def configuration_error(cfg: LLMConfig) -> str:
    if cfg.provider == "ollama":
        if not (cfg.ollama_host or "").strip():
            return "Ollama host is missing."
        if not resolve_model(cfg).strip():
            return "Ollama model is missing."
        return ""

    if cfg.provider == "ollama_cloud":
        if not (cfg.ollama_api_key or "").strip():
            return "Ollama Cloud API key is missing."
        if not resolve_model(cfg).strip():
            return "Ollama Cloud model is missing."
        return ""

    if not (cfg.api_key or "").strip():
        return f"{provider_label(cfg.provider)} API key is missing."
    if not resolve_model(cfg).strip():
        return f"{provider_label(cfg.provider)} model is missing."
    return ""


def call_chat_completion(
    cfg: LLMConfig,
    messages: list[dict],
    *,
    system: str = "",
    temperature: float | None = None,
    max_tokens: int | None = None,
    timeout: int = 60,
) -> str:
    config_issue = configuration_error(cfg)
    if config_issue:
        raise LLMClientError(config_issue)

    if cfg.provider == "anthropic":
        return _call_anthropic(cfg, messages, system, temperature, max_tokens, timeout)
    if cfg.provider in ("ollama", "ollama_cloud"):
        return _call_ollama(cfg, messages, system, temperature, timeout)
    return _call_openai_compat(cfg, messages, system, temperature, max_tokens, timeout)


def test_connection(cfg: LLMConfig) -> LLMTestResult:
    provider = provider_label(cfg.provider)
    model = resolve_model(cfg)
    try:
        content = call_chat_completion(
            cfg,
            [{"role": "user", "content": "Reply with exactly: BardPrime connection ok"}],
            system="You are a connection test endpoint. Reply with exactly: BardPrime connection ok",
            temperature=0.0,
            max_tokens=32,
            timeout=20,
        ).strip()
        return LLMTestResult(
            success=True,
            provider=provider,
            model=model,
            message=content or "BardPrime connection ok",
        )
    except LLMClientError as exc:
        return LLMTestResult(
            success=False,
            provider=provider,
            model=model,
            error=str(exc),
        )


def list_ollama_models(host: str) -> list[OllamaModelInfo]:
    resp = requests.get(f"{host.rstrip('/')}/api/tags", timeout=10)
    _raise_for_status("Ollama", resp)
    data = resp.json()
    models = []
    for item in data.get("models", []):
        details = item.get("details") or {}
        models.append(
            OllamaModelInfo(
                name=item.get("name") or item.get("model") or "",
                size=item.get("size") or 0,
                family=details.get("family") or "",
                parameter_size=details.get("parameter_size") or "",
            )
        )
    return [m for m in models if m.name]


def _call_openai_compat(
    cfg: LLMConfig,
    messages: list[dict],
    system: str,
    temperature: float | None,
    max_tokens: int | None,
    timeout: int,
) -> str:
    base = cfg.base_url or "https://api.openai.com/v1"
    model = resolve_model(cfg)
    request_messages = _with_system(messages, system)

    try:
        resp = requests.post(
            f"{base}/chat/completions",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {cfg.api_key}",
            },
            json={
                "model": model,
                "messages": request_messages,
                "temperature": cfg.temperature if temperature is None else temperature,
                "max_tokens": cfg.max_tokens if max_tokens is None else max_tokens,
            },
            timeout=timeout,
        )
        _raise_for_status(provider_label(cfg.provider), resp)
        content = resp.json()["choices"][0]["message"]["content"]
        if not content:
            raise LLMClientError(f"{provider_label(cfg.provider)} returned an empty response.")
        return content
    except requests.RequestException as exc:
        raise LLMClientError(_describe_request_error(cfg, exc)) from exc
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        raise LLMClientError(
            f"{provider_label(cfg.provider)} returned an unexpected response format."
        ) from exc


def _call_anthropic(
    cfg: LLMConfig,
    messages: list[dict],
    system: str,
    temperature: float | None,
    max_tokens: int | None,
    timeout: int,
) -> str:
    model = resolve_model(cfg)
    request_messages = [
        {"role": msg["role"] if msg["role"] in ("user", "assistant") else "user", "content": msg["content"]}
        for msg in messages
        if msg.get("role") != "system"
    ]

    try:
        resp = requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "Content-Type": "application/json",
                "x-api-key": cfg.api_key,
                "anthropic-version": "2023-06-01",
            },
            json={
                "model": model,
                "max_tokens": cfg.max_tokens if max_tokens is None else max_tokens,
                "system": system,
                "messages": request_messages,
                "temperature": cfg.temperature if temperature is None else temperature,
            },
            timeout=timeout,
        )
        _raise_for_status(provider_label(cfg.provider), resp)
        content = resp.json()["content"][0]["text"]
        if not content:
            raise LLMClientError("Anthropic returned an empty response.")
        return content
    except requests.RequestException as exc:
        raise LLMClientError(_describe_request_error(cfg, exc)) from exc
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        raise LLMClientError("Anthropic returned an unexpected response format.") from exc


def _call_ollama(
    cfg: LLMConfig,
    messages: list[dict],
    system: str,
    temperature: float | None,
    timeout: int,
) -> str:
    host = "https://ollama.com" if cfg.provider == "ollama_cloud" else (cfg.ollama_host or "http://localhost:11434")
    model = resolve_model(cfg)
    headers = {}
    if cfg.provider == "ollama_cloud":
        headers["Authorization"] = f"Bearer {cfg.ollama_api_key}"

    try:
        content = _post_ollama_chat(
            host=host,
            headers=headers,
            model=model,
            messages=_with_system(messages, system),
            temperature=cfg.temperature if temperature is None else temperature,
            timeout=timeout,
            provider=provider_label(cfg.provider),
        )
        if not content:
            raise LLMClientError(f"{provider_label(cfg.provider)} returned an empty response.")
        return content
    except LLMClientError as exc:
        if cfg.provider == "ollama" and "not found" in str(exc).lower():
            try:
                installed = list_ollama_models(host)
            except Exception:
                raise exc

            if not installed:
                raise LLMClientError(
                    "Ollama is running, but no local models are installed. Pull a model first, for example `ollama pull llama3.2`."
                ) from exc

            fallback_model = installed[0].name
            try:
                content = _post_ollama_chat(
                    host=host,
                    headers=headers,
                    model=fallback_model,
                    messages=_with_system(messages, system),
                    temperature=cfg.temperature if temperature is None else temperature,
                    timeout=timeout,
                    provider=provider_label(cfg.provider),
                )
                if content:
                    return content
            except LLMClientError:
                pass

            available_names = ", ".join(model_info.name for model_info in installed[:5])
            raise LLMClientError(
                f"Ollama model '{model}' was not found. Installed models: {available_names}. Open Settings and choose one of those models."
            ) from exc
    except requests.RequestException as exc:
        raise LLMClientError(_describe_request_error(cfg, exc)) from exc
    except (KeyError, TypeError, ValueError) as exc:
        raise LLMClientError(
            f"{provider_label(cfg.provider)} returned an unexpected response format."
        ) from exc


def _with_system(messages: list[dict], system: str) -> list[dict]:
    if not system:
        return messages
    return [{"role": "system", "content": system}] + messages


def _post_ollama_chat(
    *,
    host: str,
    headers: dict,
    model: str,
    messages: list[dict],
    temperature: float,
    timeout: int,
    provider: str,
) -> str:
    resp = requests.post(
        f"{host}/api/chat",
        headers=headers,
        json={
            "model": model,
            "messages": messages,
            "stream": False,
            "options": {"temperature": temperature},
        },
        timeout=timeout,
    )
    _raise_for_status(provider, resp)
    return resp.json()["message"]["content"]


def _raise_for_status(provider: str, resp: requests.Response) -> None:
    if resp.ok:
        return

    body_preview = ""
    try:
        body_preview = json.dumps(resp.json())[:300]
    except ValueError:
        body_preview = resp.text[:300]

    raise LLMClientError(
        f"{provider} request failed with status {resp.status_code}. {body_preview}".strip()
    )


def _describe_request_error(cfg: LLMConfig, exc: requests.RequestException) -> str:
    provider = provider_label(cfg.provider)
    if isinstance(exc, requests.ConnectionError):
        if cfg.provider == "ollama":
            return (
                f"Couldn't reach Ollama at {(cfg.ollama_host or 'http://localhost:11434')}. "
                "Make sure Ollama is running and the host is correct."
            )
        return f"Couldn't reach {provider}. Check your internet connection and provider settings."
    if isinstance(exc, requests.Timeout):
        return f"{provider} timed out while generating a response."
    return f"{provider} request failed: {exc}"
