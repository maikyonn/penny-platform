# Mock Campaign Chat Server

Lightweight FastAPI application that returns canned assistant responses for testing the campaign chat experience.

## Run Locally

```bash
cd mock-server
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 9000
```

Visit `http://localhost:9000/docs` for interactive Swagger documentation.

## API Overview

- `GET /health` – simple health check and current conversation length.
- `GET /conversation` – returns the in-memory conversation history accumulated during this server run. The first assistant prompt is injected automatically.
- `POST /message` – accepts `{"message": "..."}` and walks through a fixed briefing flow (asking for website, target profiles, follower range, location, etc.). After the “All set” step it automatically adds a typing indicator and final “campaign brief saved” card to the conversation.
