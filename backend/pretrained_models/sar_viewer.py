#sar_viewer.py
import rasterio
import numpy as np
import matplotlib.pyplot as plt
from rasterio.enums import Resampling
from sklearn.cluster import KMeans
import matplotlib.patches as mpatches

# ====== 1. Load SAR Polarization Bands ======
vv_path = r"C:\data\S1C_IW_GRDH_1SDV_20250930T173212_20250930T173237_004357_008A34_2FE9.SAFE\S1C_IW_GRDH_1SDV_20250930T173212_20250930T173237_004357_008A34_2FE9.SAFE\measurement\s1c-iw-grd-vv-20250930t173212-20250930t173237-004357-008a34-001.tiff"  # change this to your VV file path
vh_path = r"C:\data\S1C_IW_GRDH_1SDV_20250930T173212_20250930T173237_004357_008A34_2FE9.SAFE\S1C_IW_GRDH_1SDV_20250930T173212_20250930T173237_004357_008A34_2FE9.SAFE\measurement\s1c-iw-grd-vh-20250930t173212-20250930t173237-004357-008a34-002.tiff"  # change this to your VH file path




# ====== 2. Downsample Factor ======
scale = 0.2  # reduce to 20% of original size

# === Read and resize VV ===
with rasterio.open(vv_path) as vv_src:
    vv = vv_src.read(
        1,
        out_shape=(
            int(vv_src.height * scale),
            int(vv_src.width * scale)
        ),
        resampling=Resampling.bilinear
    ).astype(np.float32)

# === Read and resize VH ===
with rasterio.open(vh_path) as vh_src:
    vh = vh_src.read(
        1,
        out_shape=(
            int(vh_src.height * scale),
            int(vh_src.width * scale)
        ),
        resampling=Resampling.bilinear
    ).astype(np.float32)

# ====== 3. Convert to dB ======
vv_db = 10 * np.log10(np.clip(vv, 1, None))
vh_db = 10 * np.log10(np.clip(vh, 1, None))

print(f"VV range after scaling: {vv_db.min():.2f} to {vv_db.max():.2f} dB")
print(f"VH range after scaling: {vh_db.min():.2f} to {vh_db.max():.2f} dB")

# ====== 4. Prepare features for clustering ======
ratio = vv_db - vh_db
mean_backscatter = (vv_db + vh_db) / 2

features = np.stack([ratio.ravel(), mean_backscatter.ravel()], axis=1)

# ====== 5. K-Means Clustering (3 classes) ======
kmeans = KMeans(n_clusters=3, random_state=42, n_init=10)
labels = kmeans.fit_predict(features)
labels = labels.reshape(vv_db.shape)

# ====== 6. Identify which cluster is Urban, Vegetation, Water ======
cluster_means = []
for i in range(3):
    mask = labels == i
    cluster_means.append([
        ratio[mask].mean(),
        mean_backscatter[mask].mean()
    ])
cluster_means = np.array(cluster_means)

urban_idx = np.argmax(cluster_means[:, 0])   # highest VV-VH
water_idx = np.argmin(cluster_means[:, 1])   # lowest backscatter
vegetation_idx = list({0, 1, 2} - {urban_idx, water_idx})[0]

# ====== 7. Create RGB composite ======
rgb = np.zeros((*vv_db.shape, 3), dtype=np.float32)
rgb[labels == urban_idx] = [1, 0, 0]       # Red = Urban
rgb[labels == vegetation_idx] = [0, 1, 0]  # Green = Vegetation
rgb[labels == water_idx] = [0, 0, 1]       # Blue = Water

# ====== 8. Display the result ======
plt.figure(figsize=(10, 8))
plt.imshow(rgb)
plt.title("SAR Land Classification (Urban–Vegetation–Water)")
plt.axis("off")

# Legend
red_patch = mpatches.Patch(color='red', label='Urban / Man-made')
green_patch = mpatches.Patch(color='green', label='Vegetation / Natural')
blue_patch = mpatches.Patch(color='blue', label='Water / Low backscatter')
plt.legend(handles=[red_patch, green_patch, blue_patch], loc='lower right')

plt.show(block=True)
