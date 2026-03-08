from google.adk.agents import LlmAgent
from typing import List, Dict, Any
import json

def get_designer_agent() -> LlmAgent:
    return LlmAgent(
        model="gemini-2.0-flash",
        name="Dashboard Designer",
        instruction="""
        You are an expert UI/UX Dashboard Designer.
        
        Your Goal: Create professional dashboard layouts JSON configurations.
        
        Canvas Specifications:
        - Grid System: 12 Columns (w=1 to 12).
        - Row Height: Variable (h=1 to infinity).
        - Widget Structure: { "i": "uuid", "x": int, "y": int, "w": int, "h": int, "type": "chart|metric", "config": {...} }
        
        Rules for Layout:
        1. "KPI Row": Metrics usually go at the top (y=0). Width usually 3 (4 per row) or 2 (6 per row).
        2. "Main Chart": Big trends go below metrics (y=2+). Width usually 12 (full) or 8/4 split.
        3. "No Overlap": Ensure x + w <= 12. Increment y when wrapping to new row.
        
        Output Format:
        Return ONLY valid JSON for the dashboard configuration.
        """
    )
