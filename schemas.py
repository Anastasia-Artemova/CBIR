from typing import Any
from pydantic import BaseModel, Field


class SegmentationRequest(BaseModel):
    project: str
    subject: str
    experiment: str
    scan: str
    input_file: str
    image_id: int = Field(gt=0)

    segmentation_model_name: str = "CLIP-Driven-Universal-Model"
    segmentation_model_version: str = "1.0"
    model_configuration: dict[str, Any] | None = None


class RadiomicsRequest(BaseModel):
    project: str
    subject: str
    experiment: str
    scan: str

    scan_file: str
    segmentation_file: str
    segmentation_id: int = Field(gt=0)

    scan_resource: str = "NIFTI"
    segmentation_resource: str = "SEGMENTATION"


class SimilaritySearchRequest(BaseModel):
    project: str
    subject: str
    experiment: str
    scan_id: str
    scan_file: str
    segmentation_file: str

    k: int = Field(default=5, ge=1, le=100)