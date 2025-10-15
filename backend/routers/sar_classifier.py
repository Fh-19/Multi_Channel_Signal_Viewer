from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.responses import FileResponse
import numpy as np
import rasterio
from rasterio.enums import Resampling
import matplotlib.pyplot as plt
from sklearn.cluster import KMeans
import tempfile, os

router = APIRouter(tags=["SAR"])

@router.post("/classify")
async def classify_sar(vv_file: UploadFile = File(...), vh_file: UploadFile = File(...)):
    try:
        # === Save uploaded files temporarily ===
        with tempfile.NamedTemporaryFile(delete=False, suffix=".tiff") as vv_tmp:
            vv_tmp.write(await vv_file.read())
            vv_path = vv_tmp.name

        with tempfile.NamedTemporaryFile(delete=False, suffix=".tiff") as vh_tmp:
            vh_tmp.write(await vh_file.read())
            vh_path = vh_tmp.name

        # === Load and downsample ===
        scale = 0.2
        with rasterio.open(vv_path) as vv_src:
            vv = vv_src.read(
                1,
                out_shape=(int(vv_src.height * scale), int(vv_src.width * scale)),
                resampling=Resampling.bilinear
            ).astype(np.float32)

        with rasterio.open(vh_path) as vh_src:
            vh = vh_src.read(
                1,
                out_shape=(int(vh_src.height * scale), int(vh_src.width * scale)),
                resampling=Resampling.bilinear
            ).astype(np.float32)

        # === Compute dB values ===
        vv_db = 10 * np.log10(np.clip(vv, 1, None))
        vh_db = 10 * np.log10(np.clip(vh, 1, None))
        ratio = vv_db - vh_db
        mean_backscatter = (vv_db + vh_db) / 2

        # === KMeans clustering ===
        features = np.stack([ratio.ravel(), mean_backscatter.ravel()], axis=1)
        kmeans = KMeans(n_clusters=3, random_state=42, n_init=10)
        labels = kmeans.fit_predict(features).reshape(vv_db.shape)

        cluster_means = []
        for i in range(3):
            mask = labels == i
            cluster_means.append([ratio[mask].mean(), mean_backscatter[mask].mean()])
        cluster_means = np.array(cluster_means)

        urban_idx = np.argmax(cluster_means[:, 0])
        water_idx = np.argmin(cluster_means[:, 1])
        vegetation_idx = list({0, 1, 2} - {urban_idx, water_idx})[0]

        # === Build RGB composite ===
        rgb = np.zeros((*vv_db.shape, 3), dtype=np.float32)
        rgb[labels == urban_idx] = [1, 0, 0]
        rgb[labels == vegetation_idx] = [0, 1, 0]
        rgb[labels == water_idx] = [0, 0, 1]

        # === Save image ===
        output_path = tempfile.mktemp(suffix=".png")
        plt.imsave(output_path, rgb)

        # === Return image file ===
        return FileResponse(output_path, media_type="image/png")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
