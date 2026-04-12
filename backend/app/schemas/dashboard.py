from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Dict, Any, Union
from datetime import datetime
from uuid import UUID

# --- Dashboard Plan Schemas (Agent Output) ---

class DashboardMetric(BaseModel):
    name: str = Field(description="Name of the metric, e.g., 'Total Revenue'")
    aggregation: Literal['sum', 'avg', 'count', 'min', 'max', 'percentage', 'none']
    sql_column: str = Field(description="The source column or expression, e.g., 'amount' or 'COUNT(*)'")
    model_config = {'extra': 'ignore'}

class GridPosition(BaseModel):
    x: int
    y: int
    w: int
    h: int
    model_config = {'extra': 'forbid'}

class DashboardVisualization(BaseModel):
    type: Literal['line', 'bar', 'area', 'donut', 'pie', 'number', 'table', 'metric', 'kpi', 'stat', 'gauge', 'sparkline', 'heatmap', 'radar', 'scatter', 'funnel', 'treemap', 'sankey', 'waterfall', 'bubble']
    metrics: List[str] = Field(description="List of metric names to visualize")
    breakdown: Optional[str] = Field(None, description="Dimension to break down by, e.g., 'region'")
    grid_position: Optional[GridPosition] = None
    model_config = {'extra': 'ignore'}

class DashboardPlan(BaseModel):
    title: str
    metrics: List[DashboardMetric]
    dimensions: List[str] = Field(default=[], description="List of available breakdown dimensions")
    time_range: str = Field(default="All time", description="Time range for the dashboard, e.g., 'Last 30 Days'")
    visualizations: List[DashboardVisualization]
    model_config = {'extra': 'ignore'}

# --- Widget & Dashboard Persistence Schemas ---



class WidgetConfig(BaseModel):
    id: str
    type: str  # line, bar, etc.
    title: str
    data: List[Dict[str, Any]] = [] # transformed data
    index: str # x-axis field
    categories: List[str] # y-axis fields
    colors: Optional[List[str]] = None
    valueFormatter: Optional[str] = None # currency, number, percentage
    gridPosition: GridPosition
    sql_query: Optional[str] = None

class DashboardConfig(BaseModel):
    widgets: List[WidgetConfig]

# --- API Request/Response Schemas ---

class DashboardOut(BaseModel):
    id: UUID
    title: str
    config: DashboardConfig
    created_at: datetime
    updated_at: datetime
    share_url: Optional[str] = None

    class Config:
        from_attributes = True


class WidgetExecutionStatus(BaseModel):
    widget_id: str
    status: Literal["ok", "error"]
    error: Optional[str] = None
    sql: Optional[str] = None


class DashboardGenerationOut(BaseModel):
    id: UUID
    title: str
    config: DashboardConfig
    created_at: datetime
    updated_at: datetime
    share_url: Optional[str] = None
    widget_status: List[WidgetExecutionStatus] = Field(default_factory=list)

    class Config:
        from_attributes = True

class PlanningRequest(BaseModel):
    query: str
    history: List[Dict[str, str]] = [] # [{"role": "user", "content": "..."}]
    connection_ids: Optional[List[str]] = None

class PlanningResponse(BaseModel):
    status: Literal["clarifying", "ready"]
    question: Optional[str] = None
    plan: Optional[DashboardPlan] = None
    model_config = {'extra': 'forbid'}

class GenerationRequest(BaseModel):
    plan: DashboardPlan
    connection_ids: Optional[List[str]] = None

class DashboardCreate(BaseModel):
    title: str
    config: DashboardConfig

class DashboardUpdate(BaseModel):
    title: Optional[str] = None
    config: Optional[DashboardConfig] = None
