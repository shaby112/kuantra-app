from google.adk.agents import LlmAgent, Agent
from google.adk.tools import FunctionTool
from app.core.config import settings
from app.core.logging import logger

def get_llm_agent(name: str, instruction: str) -> LlmAgent:
    """Factory to create ADK Agents with Gemini configuration."""
    model_name = "gemini-2.0-flash" 
    # Use gemini-1.5-pro or 2.0-flash depending on availability/key
    
    if not hasattr(settings, "GOOGLE_API_KEY"):
       logger.warning("Google API Key missing. Agents will fail to Initialize.")

    return LlmAgent(
        model=model_name,
        name=name,
        instruction=instruction,
        # API key is usually picked up from GOOGLE_API_KEY env var by google-generativeai
    )
