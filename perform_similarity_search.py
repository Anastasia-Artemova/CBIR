import logging
from psycopg.rows import dict_row

LOG = logging.getLogger("similarity_search")


def get_query_vector(project, subject, experiment, scan_id,
                     scan_file, segmentation_file, conn):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("""
            SELECT r.id AS radiomics_id, r.feature_vector::text AS feature_vector
            FROM medical_image AS mi
            JOIN segmentation AS s ON s.medical_image_id = mi.id
            JOIN radiomics AS r ON r.segmentation_id = s.id
            WHERE mi.xnat_project_id = %s AND mi.xnat_subject_id = %s
              AND mi.xnat_experiment_id = %s AND mi.xnat_scan_id = %s
              AND mi.xnat_file_name = %s AND s.mask_xnat_file_name = %s
            LIMIT 1
        """, (project, subject, experiment, str(scan_id), scan_file, segmentation_file))
        query = cur.fetchone()
    if query is None:
        raise ValueError("No radiomics vector found for the query image")
    return query


def perform_similarity_search(project, subject, experiment,
                              scan_id, scan_file, segmentation_file, conn, k=5):
    if not isinstance(k, int) or isinstance(k, bool) or k < 1:
        raise ValueError("k must be a positive integer")
    with conn.transaction():
        query = get_query_vector(project, subject, experiment, scan_id,
                                 scan_file, segmentation_file, conn)
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("""
                SELECT mi.id AS image_id, mi.xnat_project_id, mi.xnat_subject_id,
                       mi.xnat_experiment_id, mi.xnat_scan_id, mi.xnat_resource_label,
                       mi.xnat_file_name, s.id AS segmentation_id,
                       s.mask_xnat_resource_label, s.mask_xnat_file_name,
                       r.id AS radiomics_id, r.feature_vector <-> %s::vector AS distance
                FROM radiomics AS r
                JOIN segmentation AS s ON s.id = r.segmentation_id
                JOIN medical_image AS mi ON mi.id = s.medical_image_id
                WHERE r.id <> %s
                ORDER BY distance
                LIMIT %s
            """, (query["feature_vector"], query["radiomics_id"], k))
            results = cur.fetchall()
    LOG.info("Similarity search completed: %d results", len(results))
    return results
