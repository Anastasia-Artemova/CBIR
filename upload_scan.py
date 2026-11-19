from urllib.parse import quote
from auxilary import require_env
import requests
import logging
from psycopg.types.json import Jsonb

LOG = logging.getLogger("image_upload")

base_url = require_env("XNAT_URL").rstrip("/")
username = require_env("XNAT_USERNAME")
password = require_env("XNAT_PASSWORD")

def get_next_scan_id(project, subject, experiment, session):
    url = (
        f"{base_url}/data/projects/{quote(project, safe='')}"
        f"/subjects/{quote(subject, safe='')}"
        f"/experiments/{quote(experiment, safe='')}/scans"
    )

    response = session.get(
        url,
        params={"format": "json"},
        timeout=(30, 300)
    )
    response.raise_for_status()

    scans = response.json()["ResultSet"]["Result"]

    existing_ids = {
        int(scan["ID"])
        for scan in scans
        if str(scan["ID"]).isdigit()
    }

    return str(max(existing_ids, default=0) + 1)

def get_nifti_extension(filename):
    filename = filename.lower()

    if filename.endswith(".nii.gz"):
        return ".nii.gz"

    if filename.endswith(".nii"):
        return ".nii"

    raise ValueError("Only NIfTI files are supported")

def upload_scan(conn, image_file, project, subject, experiment, proxy=None):
    with requests.Session() as session:
        session.auth = (username, password)

        if proxy:
            session.proxies.update({
                "http": proxy,
                "https": proxy
            })

        extension = get_nifti_extension(image_file.filename)

        scan_id = get_next_scan_id(project, subject, experiment, session)

        scan_url = (
            f"{base_url}/data/projects/{quote(project, safe='')}"
            f"/subjects/{quote(subject, safe='')}"
            f"/experiments/{quote(experiment, safe='')}"
            f"/scans/{scan_id}"
        )

        response = session.put(
            scan_url,
            params={"xsiType": "xnat:ctScanData"},
            timeout=(30, 300)
        )
        response.raise_for_status()

        filename = f"volume-{scan_id}{extension}"

        file_url = (
            f"{scan_url}/resources/NIFTI/files/"
            f"{quote(filename, safe='')}"
        )

        image_file.file.seek(0)

        response = session.put(
            file_url,
            data=image_file.file,
            headers={"Content-Type": "application/octet-stream"},
            timeout=(30, 300)
        )
        response.raise_for_status()

        image_id = store_image_in_db(conn, project,
            subject, experiment, scan_id, filename, "NIFTI")

        LOG.info(
            "Uploaded %s to XNAT scan %s; database image ID: %d",
            filename, scan_id, image_id)

        return {
            "image_id": image_id,
            "scan_id": scan_id,
            "resource": "NIFTI",
            "filename": filename
        }

def store_image_in_db(conn, project, subject, experiment,
                      scan, filename, resource):
    with conn.transaction():
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO medical_image (
                    xnat_project_id, xnat_subject_id, xnat_experiment_id,
                    xnat_scan_id, xnat_resource_label, xnat_file_name,
                    modality, image_format, metadata
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (project, subject, experiment, str(scan), resource,
                  filename, "CT", "NIFTI", Jsonb({})))
            return cur.fetchone()[0]
