from fastapi import APIRouter

from models.schemas import VoiceCommandRequest, VoiceCommandResponse
from services import ai_parser

router = APIRouter()


@router.post("/voice-command", response_model=VoiceCommandResponse)
async def voice_command(payload: VoiceCommandRequest):
    """
    Called by frontend/js/ai_voice.js every time the Web Speech API finishes
    recognizing a phrase. The transcript is plain text; this endpoint parses
    intent and returns both a spoken reply and structured data the UI can
    use to update filters/tables/charts.
    """
    result = await ai_parser.handle_voice_command(payload.transcript)
    return result
