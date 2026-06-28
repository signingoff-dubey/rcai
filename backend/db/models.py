from pydantic import BaseModel
from typing import Optional


class Project(BaseModel):
    id: int
    name: str
    created_at: str


class File(BaseModel):
    id: int
    project_id: int
    name: str
    path: str
    file_type: str
    size: int
    analysed: int
    created_at: str


class Analysis(BaseModel):
    id: int
    file_id: int
    status: str
    root_cause: Optional[str] = None
    severity: Optional[str] = None
    cvss_score: Optional[float] = None
    cvss_vector: Optional[str] = None
    cve_id: Optional[str] = None
    confidence: Optional[float] = None
    summary: Optional[str] = None
    details: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None


class PipelineStage(BaseModel):
    id: int
    analysis_id: int
    stage_number: int
    stage_name: str
    status: str
    input_data: Optional[str] = None
    output_data: Optional[str] = None
    explanation: Optional[str] = None
    created_at: str
