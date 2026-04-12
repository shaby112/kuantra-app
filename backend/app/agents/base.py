from google.adk.agents import LlmAgent, Agent
from google.adk.tools import FunctionTool
from app.core.config import settings
from app.core.logging import logger

def get_llm_agent(name: str, instruction: str) -> LlmAgent:
    """Factory to create ADK Agents with Gemini configuration."""
    model_name = settings.LLM_MODEL or "gemini-2.0-flash"

    if not settings.GOOGLE_API_KEY:
        logger.warning("Google API Key missing. ADK agents will fail to initialize.")

    return LlmAgent(
        model=model_name,
        name=name,
        instruction=instruction,
    )
