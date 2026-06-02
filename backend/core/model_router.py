"""
Project Sybil — Model Router
The core AI model routing layer. Calls Google Gemini and OpenRouter APIs
in parallel with fallback chains and citation compliance checking.
"""

import asyncio
import logging
import re
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Optional

from core.config import settings, ModelConfig
from core.prompt_builder import build_retry_prompt

logger = logging.getLogger("sybil.model_router")


@dataclass
class ModelResult:
    """Result from a single model call."""
    model_id: str = ""
    text: str = ""
    citations: list[int] = field(default_factory=list)
    compliance_rate: float = 0.0
    sentence_count: int = 0
    uncited_sentences: list[str] = field(default_factory=list)
    tokens_used: int = 0
    latency_ms: int = 0
    error: Optional[str] = None
    partial: bool = False


class ModelRouter:
    """Routes analysis requests to AI model providers with fallback support."""

    async def run_ensemble(
        self,
        system_prompt: str,
        config: Any,
        progress_callback: Callable,
    ) -> dict[str, ModelResult]:
        """Fire all models in parallel, collect results."""
        tasks = {}

        # Primary model
        tasks[config.primary_model_id] = self.call_with_fallback(
            "primary", config.primary_model_id, system_prompt, progress_callback
        )

        # Cross-validation models
        for model_id in config.cross_val_model_ids:
            tasks[model_id] = self.call_with_fallback(
                "cross_val", model_id, system_prompt, progress_callback
            )

        # Run all in parallel
        keys = list(tasks.keys())
        coros = list(tasks.values())
        raw_results = await asyncio.gather(*coros, return_exceptions=True)

        results = {}
        for key, result in zip(keys, raw_results):
            if isinstance(result, Exception):
                logger.error(f"Model {key} raised exception: {result}")
                results[key] = ModelResult(
                    model_id=key,
                    error=str(result),
                    partial=True,
                )
            else:
                results[key] = result

        return results

    async def run_single(
        self,
        system_prompt: str,
        config: Any,
        progress_callback: Callable,
    ) -> ModelResult:
        """Run primary model only."""
        return await self.call_with_fallback(
            "primary", config.primary_model_id, system_prompt, progress_callback
        )

    async def call_with_fallback(
        self,
        role: str,
        requested_model_id: str,
        prompt: str,
        progress_callback: Callable,
    ) -> ModelResult:
        """Try requested model, fall back through chain on failure."""
        chain = settings.get_fallback_chain(role, requested_model_id)
        last_error = None

        for model_id in chain:
            model_config = settings.get_model(model_id)
            if not model_config or not model_config.available:
                continue

            try:
                await progress_callback({
                    "event": "model_started",
                    "model": model_id,
                    "display_name": model_config.display_name,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })

                result = await self._call_model(
                    model_config, prompt, timeout=model_config.timeout_seconds
                )

                # Check citation compliance
                result.compliance_rate = self._check_citation_compliance(result.text)
                result.citations = self._extract_citations(result.text)
                result.sentence_count = len(self._split_into_sentences(result.text))
                result.uncited_sentences = self._get_uncited_sentences(result.text)

                # Retry if compliance is below threshold
                if result.compliance_rate < settings.citation_compliance_minimum:
                    logger.info(
                        f"{model_id} compliance {result.compliance_rate:.2%} "
                        f"< {settings.citation_compliance_minimum:.2%}, retrying..."
                    )
                    result = await self._retry_for_compliance(
                        model_config, result, prompt
                    )

                await progress_callback({
                    "event": "model_complete",
                    "model": model_id,
                    "display_name": model_config.display_name,
                    "citations_found": len(result.citations),
                    "compliance": result.compliance_rate,
                    "latency_ms": result.latency_ms,
                })

                return result

            except asyncio.TimeoutError:
                last_error = f"Timeout after {model_config.timeout_seconds}s"
                logger.warning(f"{model_id}: {last_error}")
                await progress_callback({
                    "event": "model_failed",
                    "model": model_id,
                    "reason": "timeout",
                    "fallback_attempted": True,
                })
                continue

            except Exception as e:
                last_error = str(e)
                logger.error(f"{model_id} failed: {last_error}", exc_info=True)
                await progress_callback({
                    "event": "model_failed",
                    "model": model_id,
                    "reason": last_error,
                    "fallback_attempted": True,
                })
                continue

        # All models in chain failed
        return ModelResult(
            model_id=requested_model_id,
            error=last_error or "All models in fallback chain failed",
            partial=True,
        )

    async def _call_model(
        self, model_config: ModelConfig, prompt: str, timeout: int
    ) -> ModelResult:
        """Dispatch to correct provider based on model config."""
        start_time = time.perf_counter()

        if model_config.provider == "google":
            result = await asyncio.wait_for(
                self._call_google(model_config, prompt), timeout=timeout
            )
        elif model_config.provider in ("openrouter", "openai", "ollama"):
            result = await asyncio.wait_for(
                self._call_openrouter(model_config, prompt), timeout=timeout
            )
        else:
            raise ValueError(f"Unknown provider: {model_config.provider}")

        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        result.latency_ms = elapsed_ms
        result.model_id = model_config.id

        if settings.log_api_calls:
            logger.info(
                f"API call to {model_config.display_name}: "
                f"{elapsed_ms}ms, ~{result.tokens_used} tokens"
            )

        return result

    async def _call_google(
        self, model_config: ModelConfig, prompt: str
    ) -> ModelResult:
        """Call Google Gemini API via google-generativeai SDK."""
        try:
            import google.generativeai as genai

            genai.configure(api_key=model_config.api_key)

            model = genai.GenerativeModel(
                model_name=model_config.id,
                generation_config=genai.types.GenerationConfig(
                    temperature=model_config.temperature,
                ),
            )

            response = await asyncio.to_thread(
                model.generate_content, prompt
            )

            text = response.text if response.text else ""
            tokens = len(text) // 4  # Estimate

            return ModelResult(
                model_id=model_config.id,
                text=text,
                tokens_used=tokens,
            )

        except Exception as e:
            logger.error(f"Google API error: {e}")
            raise

    async def _call_openrouter(
        self, model_config: ModelConfig, prompt: str
    ) -> ModelResult:
        """Call OpenRouter or Ollama API (OpenAI-compatible)."""
        try:
            from openai import AsyncOpenAI

            api_key = model_config.api_key or "ollama" if model_config.provider == "ollama" else model_config.api_key

            client = AsyncOpenAI(
                api_key=api_key,
                base_url=model_config.base_url or "https://openrouter.ai/api/v1",
            )

            response = await client.chat.completions.create(
                model=model_config.id,
                messages=[
                    {"role": "user", "content": prompt}
                ],
                temperature=model_config.temperature,
            )

            text = response.choices[0].message.content if response.choices else ""
            tokens = response.usage.total_tokens if response.usage else len(text) // 4

            return ModelResult(
                model_id=model_config.id,
                text=text or "",
                tokens_used=tokens,
            )

        except Exception as e:
            logger.error(f"OpenRouter API error: {e}")
            raise

    async def _retry_for_compliance(
        self,
        model_config: ModelConfig,
        original_result: ModelResult,
        original_prompt: str,
    ) -> ModelResult:
        """Re-send non-compliant paragraphs with stricter prompt."""
        uncited = self._get_uncited_sentences(original_result.text)
        if not uncited:
            return original_result

        retry_prompt = build_retry_prompt(uncited)

        for attempt in range(settings.max_citation_retries):
            try:
                retry_result = await self._call_model(
                    model_config, retry_prompt, timeout=60
                )
                new_compliance = self._check_citation_compliance(retry_result.text)

                if new_compliance > original_result.compliance_rate:
                    # Merge: replace uncited sentences with corrected ones
                    merged = self._merge_results(
                        original_result, retry_result, uncited
                    )
                    return merged

            except Exception as e:
                logger.warning(f"Retry attempt {attempt + 1} failed: {e}")
                continue

        return original_result

    def _check_citation_compliance(self, text: str) -> float:
        """Calculate the percentage of sentences with [LOG_ID: X] citations."""
        sentences = self._split_into_sentences(text)
        if not sentences:
            return 0.0

        cited = sum(
            1 for s in sentences
            if re.search(r'\[LOG_ID:\s*\d+\]', s)
        )
        return cited / len(sentences)

    def _extract_citations(self, text: str) -> list[int]:
        """Extract all LOG_ID numbers from model output."""
        return sorted(set(
            int(m) for m in re.findall(r'\[LOG_ID:\s*(\d+)\]', text)
        ))

    def _split_into_sentences(self, text: str) -> list[str]:
        """
        Split text into sentences for compliance checking.
        Filters out headers, empty lines, and bullets that aren't factual claims.
        """
        if not text:
            return []

        lines = text.split("\n")
        sentences = []

        for line in lines:
            line = line.strip()
            if not line:
                continue
            # Skip markdown headers
            if line.startswith("#"):
                continue
            # Skip horizontal rules
            if line.startswith("---") or line.startswith("==="):
                continue
            # Skip very short lines (labels, etc.)
            if len(line) < 20:
                continue

            # Split on sentence-ending punctuation
            parts = re.split(r'(?<=[.!?])\s+', line)
            for part in parts:
                part = part.strip()
                if len(part) >= 20:
                    sentences.append(part)

        return sentences

    def _get_uncited_sentences(self, text: str) -> list[str]:
        """Get sentences that lack citations."""
        sentences = self._split_into_sentences(text)
        return [
            s for s in sentences
            if not re.search(r'\[LOG_ID:\s*\d+\]', s)
            and not s.lower().startswith("insufficient evidence")
            and "[ANALYTICAL OBSERVATION" not in s
        ]

    def _merge_results(
        self,
        original: ModelResult,
        retry: ModelResult,
        uncited_originals: list[str],
    ) -> ModelResult:
        """Merge retry results back into original text."""
        merged_text = original.text

        # Try to replace uncited sentences with corrected versions
        retry_lines = [l.strip() for l in retry.text.split("\n") if l.strip()]

        for i, uncited in enumerate(uncited_originals):
            if i < len(retry_lines):
                corrected = retry_lines[i]
                if re.search(r'\[LOG_ID:\s*\d+\]', corrected):
                    merged_text = merged_text.replace(uncited, corrected, 1)

        return ModelResult(
            model_id=original.model_id,
            text=merged_text,
            citations=self._extract_citations(merged_text),
            compliance_rate=self._check_citation_compliance(merged_text),
            sentence_count=len(self._split_into_sentences(merged_text)),
            uncited_sentences=self._get_uncited_sentences(merged_text),
            tokens_used=original.tokens_used + retry.tokens_used,
            latency_ms=original.latency_ms + retry.latency_ms,
        )
