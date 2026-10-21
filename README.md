**Project title:** Platform for indexing and searching medical images based on structured data and radiomic features

## 1. Problem Formulation

The objective of this project is to design, implement, and experimentally evaluate a web platform that imports and displays DICOM studies, indexes structured examination data and tumor radiomic features, and retrieves similar cases through metadata filtering, radiomic and tumor embedding similarity search, and hybrid queries.


## 2. Project Scope

1. **DICOM Upload & Management:** Upload, archive, and browse anonymized DICOM studies through XNAT, preserving image references and associated metadata.
2. **Tumor Segmentation & Radiomic Feature Extraction:** Use the (CLIP-Driven Universal) Model to segmentate tumor, MedicalNet to generate learn tumor embedding vector, and PyRadiomics to extract features from the corresponding image regions.
3. **Indexing & Similarity Search:** Store metadata and normalized radiomic feature vectors in PostgreSQL with pgvector to retrieve similar tumor cases, with optional metadata filtering.
4. **Results Visualization & Comparison:** Display ranked matching images with metadata and similarity information, allowing users to compare retrieved cases with the query case.
