import rasterio
import numpy as np
import folium
import cv2
import os
import traceback
from rasterio.enums import Resampling

# ==== مسارات الملفات ====
vv_path = r"C:\data\S1C_IW_GRDH_1SDV_20250930T173212_20250930T173237_004357_008A34_2FE9.SAFE\S1C_IW_GRDH_1SDV_20250930T173212_20250930T173237_004357_008A34_2FE9.SAFE\measurement\s1c-iw-grd-vv-20250930t173212-20250930t173237-004357-008a34-001.tiff"
vh_path = r"C:\data\S1C_IW_GRDH_1SDV_20250930T173212_20250930T173237_004357_008A34_2FE9.SAFE\S1C_IW_GRDH_1SDV_20250930T173212_20250930T173237_004357_008A34_2FE9.SAFE\measurement\s1c-iw-grd-vh-20250930t173212-20250930t173237-004357-008a34-002.tiff"

try:
    # ==== قراءة الصور ====
    with rasterio.open(vv_path) as vv_img, rasterio.open(vh_path) as vh_img:
        vv = vv_img.read(1, out_dtype="float32", resampling=Resampling.bilinear)
        vh = vh_img.read(1, out_dtype="float32", resampling=Resampling.bilinear)
        bounds = vv_img.bounds
        width = vv_img.width
        height = vv_img.height

    # ==== تصغير الصورة ====
    scale = 0.1
    vv_small = cv2.resize(vv, (0, 0), fx=scale, fy=scale)
    vh_small = cv2.resize(vh, (0, 0), fx=scale, fy=scale)

    # ==== حساب حدود الصورة الجديدة ====
    lon_per_px = (bounds.right - bounds.left) / width
    lat_per_px = (bounds.top - bounds.bottom) / height
    new_width = int(width * scale)
    new_height = int(height * scale)
    new_bounds = rasterio.coords.BoundingBox(
        left=bounds.left,
        bottom=bounds.top - new_height * lat_per_px,
        right=bounds.left + new_width * lon_per_px,
        top=bounds.top
    )

    # ==== تحويل القيم إلى dB (لتحسين التباين) ====
    vv_db = 10 * np.log10(np.clip(vv_small, 1e-5, None))
    vh_db = 10 * np.log10(np.clip(vh_small, 1e-5, None))

    # ==== تطبيع القيم إلى 0–1 ====
    def normalize_band(band):
        b_min, b_max = np.nanpercentile(band, 2), np.nanpercentile(band, 98)
        band = np.clip(band, b_min, b_max)
        return (band - b_min) / (b_max - b_min)

    vv_norm = normalize_band(vv_db)
    vh_norm = normalize_band(vh_db)

    # ==== إنشاء صورة RGB اصطناعية (VV = أحمر، VH = أخضر، المتوسط = أزرق) ====
    blue = np.sqrt(vv_norm * vh_norm)
    rgb = np.dstack((vv_norm, vh_norm, blue))
    rgb = np.clip(rgb * 255, 0, 255).astype(np.uint8)

    # ==== تحسين التباين باستخدام CLAHE ====
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8,8))
    l2 = clahe.apply(l)
    lab = cv2.merge((l2, a, b))
    rgb_clahe = cv2.cvtColor(lab, cv2.COLOR_LAB2RGB)

    # ==== حفظ الصورة ====
    rgb_path = "sentinel_rgb_enhanced.png"
    cv2.imwrite(rgb_path, cv2.cvtColor(rgb_clahe, cv2.COLOR_RGB2BGR))

    # ==== إنشاء الخريطة ====
    lon_center = (new_bounds.left + new_bounds.right) / 2
    lat_center = (new_bounds.bottom + new_bounds.top) / 2

    m = folium.Map(location=[lat_center, lon_center], zoom_start=10, tiles="OpenStreetMap")

    folium.raster_layers.ImageOverlay(
        name="Sentinel-1 Enhanced",
        image=rgb_path,
        bounds=[[new_bounds.bottom, new_bounds.left], [new_bounds.top, new_bounds.right]],
        opacity=0.75
    ).add_to(m)

    folium.LayerControl().add_to(m)

    map_file = "sentinel_map_enhanced.html"
    m.save(map_file)
    os.startfile(map_file)

    print("✅ تم إنشاء الخريطة المحسّنة بنجاح:", map_file)

except Exception as e:
    print("⚠️ حصل خطأ أثناء التنفيذ:")
    traceback.print_exc()
