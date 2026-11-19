
import json
import math
from importlib.metadata import version
import numpy as np
import logging
from radiomics import featureextractor
from tempfile import TemporaryDirectory
from pathlib import Path
from urllib.parse import urlsplit, unquote
import requests
from auxilary import require_env
from psycopg import sql
from psycopg.types.json import Jsonb

LOG = logging.getLogger("radiomics_retrieval")

username = require_env("XNAT_USERNAME")
password = require_env("XNAT_PASSWORD")

TABLES = {
    "firstorder": "first_order",
    "shape": "shape_3d",
    "shape2D": "shape_2d",
    "glcm": "glcm",
    "glrlm": "glrlm",
    "glszm": "glszm",
    "gldm": "gldm",
    "ngtdm": "ngtdm",
}

COLUMNS = {
    "firstorder": [
        "Energy", "TotalEnergy", "Entropy", "Minimum",
        "10Percentile", "90Percentile", "Maximum", "Mean",
        "Median", "InterquartileRange", "Range",
        "MeanAbsoluteDeviation", "RobustMeanAbsoluteDeviation",
        "RootMeanSquared", "Skewness", "Kurtosis",
        "Variance", "Uniformity"
    ],
    "shape": [
        "MeshVolume", "VoxelVolume", "SurfaceArea",
        "SurfaceVolumeRatio", "Sphericity", "Maximum3DDiameter",
        "Maximum2DDiameterSlice", "Maximum2DDiameterColumn",
        "Maximum2DDiameterRow", "MajorAxisLength",
        "MinorAxisLength", "LeastAxisLength",
        "Elongation", "Flatness"
    ],
    "shape2D": [
        "MeshSurface", "PixelSurface", "Perimeter",
        "PerimeterSurfaceRatio", "Sphericity",
        "MaximumDiameter", "MajorAxisLength",
        "MinorAxisLength", "Elongation"
    ],
    "glcm": [
        "Autocorrelation", "JointAverage", "ClusterProminence",
        "ClusterShade", "ClusterTendency", "Contrast",
        "Correlation", "DifferenceAverage",
        "DifferenceEntropy", "DifferenceVariance",
        "JointEnergy", "JointEntropy", "Imc1", "Imc2",
        "Id", "Idm", "Idmn", "Idn", "InverseVariance",
        "MaximumProbability", "SumAverage", "SumEntropy",
        "SumSquares"
    ],
    "glrlm": [
        "ShortRunEmphasis", "LongRunEmphasis",
        "GrayLevelNonUniformity",
        "GrayLevelNonUniformityNormalized",
        "RunLengthNonUniformity",
        "RunLengthNonUniformityNormalized",
        "RunPercentage", "GrayLevelVariance",
        "RunVariance", "RunEntropy",
        "LowGrayLevelRunEmphasis", "HighGrayLevelRunEmphasis",
        "ShortRunLowGrayLevelEmphasis",
        "ShortRunHighGrayLevelEmphasis",
        "LongRunLowGrayLevelEmphasis",
        "LongRunHighGrayLevelEmphasis"
    ],
    "glszm": [
        "SmallAreaEmphasis", "LargeAreaEmphasis",
        "GrayLevelNonUniformity",
        "GrayLevelNonUniformityNormalized",
        "SizeZoneNonUniformity",
        "SizeZoneNonUniformityNormalized",
        "ZonePercentage", "GrayLevelVariance",
        "ZoneVariance", "ZoneEntropy",
        "LowGrayLevelZoneEmphasis",
        "HighGrayLevelZoneEmphasis",
        "SmallAreaLowGrayLevelEmphasis",
        "SmallAreaHighGrayLevelEmphasis",
        "LargeAreaLowGrayLevelEmphasis",
        "LargeAreaHighGrayLevelEmphasis"
    ],
    "gldm": [
        "SmallDependenceEmphasis",
        "LargeDependenceEmphasis",
        "GrayLevelNonUniformity",
        "DependenceNonUniformity",
        "DependenceNonUniformityNormalized",
        "GrayLevelVariance", "DependenceVariance",
        "DependenceEntropy", "LowGrayLevelEmphasis",
        "HighGrayLevelEmphasis",
        "SmallDependenceLowGrayLevelEmphasis",
        "SmallDependenceHighGrayLevelEmphasis",
        "LargeDependenceLowGrayLevelEmphasis",
        "LargeDependenceHighGrayLevelEmphasis"
    ],
    "ngtdm": [
        "Coarseness", "Contrast", "Busyness",
        "Complexity", "Strength"
    ]
}


selected_features = [
    'original_shape_Maximum3DDiameter',
    'original_shape_VoxelVolume',
    'original_shape_SurfaceVolumeRatio',
    'original_firstorder_10Percentile',
    'original_firstorder_RootMeanSquared',
    'original_glrlm_GrayLevelNonUniformityNormalized',
    'original_firstorder_Range',
    'original_firstorder_Skewness',
    'original_gldm_SmallDependenceEmphasis',
    'original_gldm_HighGrayLevelEmphasis',
    'original_gldm_DependenceVariance',
    'original_glcm_ClusterShade',
    'original_glcm_Contrast',
    'original_ngtdm_Contrast',
    'original_glcm_Imc2',
    'original_gldm_GrayLevelNonUniformity',
    'original_gldm_LargeDependenceHighGrayLevelEmphasis',
    'original_gldm_LargeDependenceLowGrayLevelEmphasis',
    'original_gldm_SmallDependenceLowGrayLevelEmphasis',
    'original_glszm_GrayLevelNonUniformity',
    'original_glszm_ZoneVariance',
    'original_glszm_SmallAreaEmphasis',
    'original_gldm_SmallDependenceHighGrayLevelEmphasis',
]


def numeric_or_none(value):
    if value is None:
        return None

    number = float(value)

    if not math.isfinite(number):
        return None

    return number

def to_python_value(value):
    if isinstance(value, np.ndarray):
        return value.tolist()

    if isinstance(value, np.generic):
        return value.item()

    return value

def load_scaler_params():
    root_dir = Path(__file__).resolve().parent
    scaler_path = root_dir / "scaler_params.json"
    with open(scaler_path, "r", encoding="utf-8") as f:
        return json.load(f)

def prepare_radiomics(features):
    processed_context = {
        feature_class: {}
        for feature_class in COLUMNS.keys()
    }

    for key, val in features.items():
        parts = key.split("_", 2)

        if len(parts) != 3:
            continue

        image_type, feature_class, _ = parts

        if image_type != "original":
            continue

        if feature_class in COLUMNS.keys():
            processed_context[feature_class][key] = (
                to_python_value(val)
            )

    missing = [
        name for name in selected_features
        if name not in features
    ]

    if missing:
        raise ValueError(
            f"Missing selected radiomic features: {missing}"
        )

    scaler_params = load_scaler_params()
    feature_names = scaler_params["feature_names"]

    if (
        len(feature_names) != len(selected_features)
        or len(set(feature_names)) != len(feature_names)
        or set(feature_names) != set(selected_features)
    ):
        raise ValueError(
            "Scaler features do not match selected radiomic features"
        )

    raw_vector = np.array(
        [float(features[name]) for name in feature_names],
        dtype=np.float64
    )

    if not np.isfinite(raw_vector).all():
        raise ValueError("Feature vector contains invalid values")

    mean = np.array(scaler_params["mean"], dtype=np.float64)
    scale = np.array(scaler_params["scale"], dtype=np.float64)

    if not len(raw_vector) == len(mean) == len(scale):
        raise ValueError("Scaler dimensions do not match")

    if not np.isfinite(mean).all():
        raise ValueError("Scaler means contain invalid values")

    if not np.isfinite(scale).all() or np.any(scale <= 0):
        raise ValueError("Scaler scales must be finite and positive")

    scaled_vector = (raw_vector - mean) / scale

    if not np.isfinite(scaled_vector).all():
        raise ValueError(
            "Scaled feature vector contains invalid values"
        )

    return processed_context, scaled_vector.tolist()

def make_payload(features, segmentation_id, extraction_config):

    _, feature_vector = prepare_radiomics(features)

    class_data = {}

    for feature_class, columns in COLUMNS.items():
        values = {}

        for column in columns:
            feature_name = f"original_{feature_class}_{column}"

            values[column] = numeric_or_none(
                features.get(feature_name)
            )

        if any(value is not None for value in values.values()):
            class_data[feature_class] = values

    return {
        "segmentation_id": segmentation_id,
        "extractor_version": version("pyradiomics"),
        "extraction_config": extraction_config,
        "feature_schema_version": "1",
        "feature_vector": feature_vector,
        "classes": class_data
    }


def write_radiomics_to_db(conn, features, segmentation_id, extraction_config=None):
    payload = make_payload(features, segmentation_id, extraction_config or {})

    with conn.transaction():
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO radiomics (
                    segmentation_id, extractor_version, extraction_config,
                    feature_schema_version, feature_vector
                ) VALUES (%s, %s, %s, %s, %s::vector)
                RETURNING id
            """, (payload["segmentation_id"], payload["extractor_version"],
                  Jsonb(payload["extraction_config"]), payload["feature_schema_version"],
                  json.dumps(payload["feature_vector"], allow_nan=False)))
            radiomics_id = cur.fetchone()[0]

            for feature_class, values in payload["classes"].items():
                columns = COLUMNS[feature_class]
                statement = sql.SQL("INSERT INTO {} ({}) VALUES ({})").format(
                    sql.Identifier(TABLES[feature_class]),
                    sql.SQL(", ").join(map(sql.Identifier, ["radiomics_id", *columns])),
                    sql.SQL(", ").join(sql.Placeholder() for _ in range(len(columns) + 1))
                )
                cur.execute(statement, (radiomics_id, *(values[c] for c in columns)))

    LOG.info("Inserted radiomics ID %d for segmentation %d", radiomics_id, segmentation_id)
    return radiomics_id, payload["feature_vector"]


def extract_scan_name(scan_url: str):
    return unquote(Path(urlsplit(scan_url).path).name)

def download_file(session, scan_url, scan_path):
    with session.get(
        scan_url, stream=True, timeout=(30, 300)
    ) as response:
        response.raise_for_status()

        with scan_path.open("wb") as output:
            for chunk in response.iter_content(
                chunk_size=1024 * 1024
            ):
                if chunk:
                    output.write(chunk)

    if scan_path.stat().st_size == 0:
        raise RuntimeError("Downloaded scan is empty")

    LOG.info(
        "Downloaded scan: %s (%d bytes)",
        scan_path.name,
        scan_path.stat().st_size
    )

def extract_radiomics(conn, proxy, scan_url, segmentation_url, segmentation_id):
    
    extractor = featureextractor.RadiomicsFeatureExtractor()

    with TemporaryDirectory() as directory:
        temp_dir = Path(directory)

        scan_path = temp_dir / extract_scan_name(scan_url)
        segment_path = temp_dir / extract_scan_name(segmentation_url)

        with requests.Session() as session:
            session.auth = (username, password)
    
            if proxy:
                session.proxies.update({
                    "http": proxy,
                    "https": proxy
                })

            download_file(session, scan_url, scan_path)
            download_file(session, segmentation_url, segment_path)

        LOG.info("Starting radiomics extraction")

        features = extractor.execute(
            str(scan_path),
            str(segment_path)
        )

        extraction_config = {
            "settings": extractor.settings,
            "enabledImagetypes": extractor.enabledImagetypes,
            "enabledFeatures": extractor.enabledFeatures
        }

        radiomics_id, feature_vector = write_radiomics_to_db(
            conn,
            features,
            segmentation_id=segmentation_id,
            extraction_config=extraction_config
        )

        LOG.info(
            "Radiomics extraction completed: ID=%d, dimensions=%d",
            radiomics_id,
            len(feature_vector)
        )

        return radiomics_id, feature_vector
