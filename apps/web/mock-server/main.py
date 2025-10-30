"""Mock chat server returning predefined campaign brief responses."""
from __future__ import annotations

from typing import List, Optional, Dict
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


class MessageRequest(BaseModel):
    """Incoming message payload."""

    message: str = Field(..., min_length=1, description="End-user message text.")


class ConversationTurn(BaseModel):
    """Simple conversation log entry."""

    role: str
    content: str
    kind: str = "bubble"  # bubble | typing | card


class MessageResponse(BaseModel):
    """Assistant reply payload."""

    reply: str
    kind: str = "bubble"
    step: int
    done: bool = False
    conversation: List[ConversationTurn]


app = FastAPI(
    title="Mock Campaign Chat Server",
    description="Returns canned responses for testing the campaign chat UI.",
    version="0.2.0",
)


ASSISTANT_STEPS: List[Dict[str, str]] = [
    {
        "content": "What’s your website or landing page for this campaign?",
        "kind": "bubble",
        "name": "ask_website",
    },
    {
        "content": (
            "Thanks! 🔥\nNext, what kind of influencer profiles do you want to target?\n"
            "You can mention keywords, interests, or niches (e.g., foodies, skincare, fitness, tech)."
        ),
        "kind": "bubble",
        "name": "ask_target_profile",
    },
    {
        "content": (
            "Got it. ☕\nNow let’s talk followers. What’s your ideal follower range for the influencers?\n"
            "(e.g., 1k–10k, 10k–50k, etc.)"
        ),
        "kind": "bubble",
        "name": "ask_followers",
    },
    {
        "content": (
            "Perfect 🍉\nDo you want to target influencers in a specific location or region?"
        ),
        "kind": "bubble",
        "name": "ask_location",
    },
    {
        "content": "All set! I’m now generating a list of influencers that match your campaign...",
        "kind": "bubble",
        "name": "generating",
    },
    {
        "content": "…",
        "kind": "typing",
        "name": "typing_indicator",
    },
    {
        "content": (
            "Your campaign brief has been saved!\nYou’ll see matching influencers on your dashboard shortly."
        ),
        "kind": "card",
        "name": "brief_saved",
    },
]

conversation_log: List[ConversationTurn] = []


def _assistant_turn_for_step(step_index: int) -> ConversationTurn:
    step = ASSISTANT_STEPS[min(step_index, len(ASSISTANT_STEPS) - 1)]
    return ConversationTurn(role="assistant", content=step["content"], kind=step["kind"])


def _assistant_step_config(step_index: int) -> Dict[str, str]:
    return ASSISTANT_STEPS[min(step_index, len(ASSISTANT_STEPS) - 1)]


def _count_assistant_turns() -> int:
    return sum(1 for turn in conversation_log if turn.role == "assistant")


def _ensure_seed_turn() -> None:
    if _count_assistant_turns() == 0:
        conversation_log.append(_assistant_turn_for_step(0))


@app.get("/health")
async def health_check():
    """Health status endpoint."""
    _ensure_seed_turn()
    return {
        "status": "ok",
        "conversation_length": len(conversation_log),
        "assistant_count": _count_assistant_turns(),
    }


@app.get("/conversation", response_model=List[ConversationTurn])
async def get_conversation():
    """Return in-memory conversation history."""
    _ensure_seed_turn()
    return conversation_log


@app.post("/message", response_model=MessageResponse)
async def handle_message(payload: MessageRequest):
    """Handle a chat message and return the next predefined reply."""
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message must not be empty.")

    _ensure_seed_turn()

    conversation_log.append(
        ConversationTurn(role="user", content=payload.message, kind="bubble")
    )

    assistant_count = _count_assistant_turns()
    if assistant_count < len(ASSISTANT_STEPS):
        step_index = assistant_count
        new_turn = _assistant_turn_for_step(step_index)
        conversation_log.append(new_turn)

        if step_index == 4:  # after "All set" add typing + final card
            for extra_idx in (5, 6):
                if _count_assistant_turns() <= extra_idx:
                    conversation_log.append(_assistant_turn_for_step(extra_idx))
    else:
        step_index = len(ASSISTANT_STEPS) - 1
        new_turn = _assistant_turn_for_step(step_index)

    step_cfg = _assistant_step_config(step_index)
    done = _count_assistant_turns() >= len(ASSISTANT_STEPS)

    return MessageResponse(
        reply=step_cfg["content"],
        kind=step_cfg["kind"],
        step=step_index,
        done=done,
        conversation=conversation_log,
    )
