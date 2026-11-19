from fastapi import (
    FastAPI,
    Depends,
    UploadFile,
    File,
    Form,
    HTTPException
)
from psycopg import Connection
from urllib.parse import quote

from auxilary import connect_db, require_env
from upload_scan import upload_scan
from run_segmentation import run_segmentation
from extract_radiomics import extract_radiomics
from perform_similarity_search import perform_similarity_search

from schemas import SegmentationRequest, RadiomicsRequest, SimilaritySearchRequest
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="CBIR Radiomics Retrieval API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:4200",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:4200"
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"]
)

def get_connection():
    conn = connect_db()

    try:
        yield conn
    finally:
        conn.close()


def build_xnat_file_url(project: str, subject: str, experiment: str,
    scan: str, resource: str, filename: str
):
    base_url = require_env("XNAT_URL").rstrip("/")

    return (
        f"{base_url}/data/projects/{quote(project, safe='')}"
        f"/subjects/{quote(subject, safe='')}"
        f"/experiments/{quote(experiment, safe='')}"
        f"/scans/{quote(scan, safe='')}"
        f"/resources/{quote(resource, safe='')}"
        f"/files/{quote(filename, safe='')}"
    )


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.post("/upload_scan")
def upload_scan_endpoint(
    image_file: UploadFile = File(...),
    project: str = Form(...),
    subject: str = Form(...),
    experiment: str = Form(...),
    conn: Connection = Depends(get_connection)
):
    return upload_scan(
        conn=conn,
        image_file=image_file,
        project=project,
        subject=subject,
        experiment=experiment,
        proxy=None
    )


@app.post("/run_segmentation")
def run_segmentation_endpoint(
    request: SegmentationRequest,
    conn: Connection = Depends(get_connection)
):
    result = run_segmentation(
        project=request.project,
        subject=request.subject,
        experiment=request.experiment,
        scan=request.scan,
        input_file=request.input_file,
        image_id=request.image_id,
        conn=conn,
        segmentation_model_name=request.segmentation_model_name,
        segmentation_model_version=request.segmentation_model_version,
        model_configuration=request.model_configuration
    )

    if result.get("status") != "COMPLETED":
        raise HTTPException(
            status_code=502,
            detail="Segmentation job did not complete successfully"
        )

    return result


@app.post("/extract_radiomics")
def extract_radiomics_endpoint(
    request: RadiomicsRequest,
    conn: Connection = Depends(get_connection)
):
    scan_url = build_xnat_file_url(
        project=request.project,
        subject=request.subject,
        experiment=request.experiment,
        scan=request.scan,
        resource=request.scan_resource,
        filename=request.scan_file
    )

    segmentation_url = build_xnat_file_url(
        project=request.project,
        subject=request.subject,
        experiment=request.experiment,
        scan=request.scan,
        resource=request.segmentation_resource,
        filename=request.segmentation_file
    )

    radiomics_id, feature_vector = extract_radiomics(
        conn=conn,
        proxy=None,
        scan_url=scan_url,
        segmentation_url=segmentation_url,
        segmentation_id=request.segmentation_id
    )

    return {
        "radiomics_id": radiomics_id,
        "segmentation_id": request.segmentation_id,
        "dimensions": len(feature_vector),
        "feature_vector": [
            float(value) for value in feature_vector
        ]
    }


@app.post("/similarity_search")
def similarity_search_endpoint(
    request: SimilaritySearchRequest,
    conn: Connection = Depends(get_connection)
):
    results = perform_similarity_search(
        project=request.project,
        subject=request.subject,
        experiment=request.experiment,
        scan_id=request.scan_id,
        scan_file=request.scan_file,
        segmentation_file=request.segmentation_file,
        conn=conn,
        k=request.k
    )

    return {
        "count": len(results),
        "results": results
    }