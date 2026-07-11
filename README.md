# Sybil Mini v2.0.0

**Anti-Hallucination Multi-LLM Forensic Narrative Engine for SOC Analysts**

A full-stack web application that uses multiple AI models simultaneously (ensemble mode) to analyze structured log timelines from confirmed cyber incidents and produce forensically-cited incident narratives where every claim is backed by specific evidence.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   FRONTEND                       │
│  React 18 + TypeScript + Tailwind CSS + Vite     │
│                                                   │
│  ConfigPanel → ProgressFeed → ResultsView         │
│                           → ConsensusDashboard    │
└──────────────────┬──────────────────────────────┘
                   │ REST API + WebSocket
┌──────────────────┴──────────────────────────────┐
│                   BACKEND                        │
│  Python FastAPI + Uvicorn                         │
│                                                   │
│  DataLoader → TimelineBuilder → PromptBuilder     │
│  ModelRouter (parallel AI calls with fallback)    │
│  ConsensusEngine (BERTScore + Citation Matrix)    │
└──────────────────────────────────────────────────┘
```

<video src="https://github.com/user/Incident-Narration-system-for-SOC/sources/video_for_README/USP_PROJECT_VIDEO_2.mp4" controls width="100%">
  Your browser does not support the video tag.
</video>

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- API keys: [Google AI Studio](https://aistudio.google.com/) (free) + [OpenRouter](https://openrouter.ai/) (free)

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Run Automated Tests
A full `unittest` suite has been implemented to verify that the core parsing, AI pruning, and consensus matrix logic executes flawlessly without requiring real API keys.
```bash
cd backend
python -m unittest tests/test_pipeline.py -v
```

### 4. Configure API Keys
Copy the template and add your real keys: placeholder values:
GEMINI_API_KEY=your_key
OPENROUTER_API_KEY=your_key

python main.py
```

Server starts at http://localhost:8000

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

App opens at http://localhost:5173

## How It Works

1. **Select** an incident scenario (Mordor JSONL dataset)
2. **Choose** models — Single mode (one model) or Ensemble (multiple models in parallel)
3. **Analyze** — the system:
   - Loads and filters the log dataset
   - Injects LOG_IDs for citation tracking
   - Builds a anti-hallucination prompt with the timeline
   - Calls all selected models simultaneously via `asyncio.gather()`
   - Checks citation compliance and retries non-compliant responses
   - Runs consensus analysis (citation matrix + BERTScore)
4. **Review** results with clickable citations, divergence highlighting, and confidence metrics

## Key Features

- **Multi-LLM Ensemble**: Run up to 4 models simultaneously for cross-validation
- **Anti-Hallucination Prompting**: Every claim must cite a specific LOG_ID from evidence
- **Phantom Detection**: Citations to non-existent LOG_IDs are flagged as hallucinations
- **BERTScore Consensus**: Semantic similarity comparison between model outputs
- **Citation Matrix**: Visual agreement map — CONFIRMED / UNVERIFIED / PHANTOM
- **Fallback Chains**: Automatic model substitution on timeout or API errors
- **Real-time Progress**: WebSocket-powered live status during analysis
- **Export**: JSON export of full results with all metrics

## AI Models (All Free Tier)

| Model | Provider | Context | Role |
|-------|----------|---------|------|
| Gemini 2.5 Flash | Google AI Studio | 1M tokens | Primary |
| DeepSeek R1 | OpenRouter | 128K tokens | Cross-validation |
| Llama 4 Maverick | OpenRouter | 128K tokens | Cross-validation |
| DeepSeek V4 Flash | OpenRouter | 1M tokens | Fallback |
| Gemini 2.0 Flash | Google AI Studio | 1M tokens | Fallback |

## Tech Stack

- **Backend**: Python 3.11+, FastAPI, Uvicorn, google-generativeai, openai, bert-score
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS 3, Recharts
- **Data**: OTRF Mordor Project (Sysmon Windows Event Logs)

## Project Structure

```
backend/
├── main.py              # FastAPI entry point
├── api/routes.py        # REST API endpoints
├── api/websocket.py     # WebSocket progress streaming
├── core/config.py       # Configuration manager
├── core/data_loader.py  # JSONL dataset loading & filtering
├── core/timeline_builder.py  # LOG_ID injection & formatting
├── core/prompt_builder.py    # Anti-hallucination prompt
├── core/model_router.py      # Parallel AI model calls
├── core/consensus_engine.py  # BERTScore + citation analysis
├── models/              # Pydantic request/response models
└── data/scenarios/      # Mordor JSONL datasets

frontend/
├── src/App.tsx          # Root component
├── src/components/
│   ├── ConfigPanel/     # Pre-analysis configuration
│   ├── ProgressFeed/    # Live WebSocket progress
│   ├── ResultsView/     # Narrative panels + citations
│   └── ConsensusDashboard/  # Metrics visualizations
├── src/hooks/           # State management + WebSocket
├── src/services/        # API client
└── src/types/           # TypeScript definitions
```

## License

University Final Year Project — Cybersecurity / DFIR Domain
