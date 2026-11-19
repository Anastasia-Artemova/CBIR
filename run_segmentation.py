import requests
import logging
import time
from auxilary import require_env
from psycopg.types.json import Jsonb

LOG = logging.getLogger("segmentation")

runpod_auth_key = require_env("RUNPOD_AUTH_KEY")
runpod_url = require_env("RUNPOD_URL")

def wait_for_runpod_job(session, endpoint_url, job_id,
    headers, timeout=900, poll_interval=5):

    status_url = (
        f"{endpoint_url.rstrip('/')}/status/{job_id}"
    )

    deadline = time.monotonic() + timeout

    while time.monotonic() < deadline:

        response = session.get(
            status_url,
            headers=headers,
            timeout=30
        )

        response.raise_for_status()

        result = response.json()
        status = result.get("status")

        print(f"RunPod job {job_id}: {status}")

        if status == "COMPLETED":
            return result

        if status in ("FAILED", "CANCELLED", "TIMED_OUT"):
            raise RuntimeError(
                f"RunPod job {status}: {result}"
            )

        if status not in ("IN_QUEUE", "IN_PROGRESS"):
            raise RuntimeError(
                f"Unexpected RunPod status: {result}"
            )

        time.sleep(poll_interval)

    raise TimeoutError(
        f"Timed out waiting for RunPod job {job_id}"
    )

def get_prediction_filename(input_file: str):
    if input_file.endswith(".nii.gz"):
        return input_file.removesuffix(".nii.gz")

    if input_file.endswith(".nii"):
        return input_file.removesuffix(".nii")

    raise ValueError("Unsupported input file format")


def store_segmentation_in_db(conn, image_id, model_id, resource,
                             filename, tumor_label, component_idx):
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO segmentation (
                medical_image_id, segmentation_model_id,
                mask_xnat_resource_label, mask_xnat_file_name,
                tumor_label, component_index, metadata
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (image_id, model_id, resource, filename, tumor_label,
              component_idx, Jsonb({})))
        return cur.fetchone()[0]


def store_segmentation_model_to_db(conn, model_name, model_version, configuration):
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO segmentation_model (name, version, configuration)
            VALUES (%s, %s, %s)
            ON CONFLICT (name, version) DO UPDATE SET name = EXCLUDED.name
            RETURNING id
        """, (model_name, model_version, Jsonb(configuration)))
        return cur.fetchone()[0]


def run_segmentation(
    project, subject, experiment,
    scan, input_file, image_id, conn,
    segmentation_model_name="CLIP-Driven-Universal-Model",
    segmentation_model_version="1.0",
    model_configuration=None
):
    input_file_name = get_prediction_filename(input_file)

    prediction_file = f"{input_file_name}_Liver Tumor.nii.gz"

    output_resource = "SEGMENTATION"

    output_file = (
        f"segmentation-{input_file_name.split('-')[-1]}.nii.gz"
    )

    payload = {
        "input": {
            "project": project,
            "subject": subject,
            "experiment": experiment,
            "scan": str(scan),
            "input_resource": "NIFTI",
            "input_file": input_file,
            "prediction_file": prediction_file,
            "output_resource": output_resource,
            "output_file": output_file
        }
    }

    headers = {
        "Authorization": f"Bearer {runpod_auth_key}",
        "Content-Type": "application/json"
    }

    with requests.Session() as session:
        response = session.post(
            runpod_url,
            json=payload,
            headers=headers,
            timeout=(30, 600)
        )

        response.raise_for_status()
        result = response.json()

        job_id = result["id"]
        status = result["status"]

        if status in ("IN_QUEUE", "IN_PROGRESS"):

            endpoint_url = runpod_url.rstrip("/").removesuffix("/runsync")

            result = wait_for_runpod_job(
                session=session,
                endpoint_url=endpoint_url,
                job_id=job_id,
                headers=headers
            )

    status = result.get("status")

    if status != "COMPLETED":
        return {
            "status": status,
            "job_id": result.get("id"),
            "segmentation_id": None
        }

    with conn.transaction():
        model_id = store_segmentation_model_to_db(
            conn, segmentation_model_name,
            segmentation_model_version, model_configuration or {}
        )
        segmentation_id = store_segmentation_in_db(
            conn, image_id, model_id, output_resource,
            output_file, tumor_label=1, component_idx=1
        )

    LOG.info(
        "Stored segmentation %s for image %s using model %s",
        segmentation_id, image_id, model_id
    )

    return {
        "status": "COMPLETED",
        "job_id": result.get("id"),
        "image_id": image_id,
        "model_id": model_id,
        "segmentation_id": segmentation_id,
        "resource": output_resource,
        "filename": output_file,
        "runpod_result": result
    }