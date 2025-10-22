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

    # ==== تصغير الصورة لتقليل الذاكرة ====
    scale = 0.1  # جربي تغيريها مثلاً لـ 0.05 لو الصورة لسه تقيلة
    vv_small = cv2.resize(vv, (0, 0), fx=scale, fy=scale)
    vh_small = cv2.resize(vh, (0, 0), fx=scale, fy=scale)

    # ==== تطبيع القيم ====
    vv_norm = (vv_small - np.nanmin(vv_small)) / (np.nanmax(vv_small) - np.nanmin(vv_small))
    vh_norm = (vh_small - np.nanmin(vh_small)) / (np.nanmax(vh_small) - np.nanmin(vh_small))

    # ==== إنشاء صورة RGB ====
    rgb = np.dstack((vv_norm, vh_norm, np.zeros_like(vv_norm)))
    rgb = np.clip(rgb * 255, 0, 255).astype(np.uint8)

    # ==== حفظ الصورة المؤقتة ====
    temp_png = "sentinel_rgb.png"
    cv2.imwrite(temp_png, cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR))

    # ==== إنشاء الخريطة ====
    lon_center = (bounds.left + bounds.right) / 2
    lat_center = (bounds.top + bounds.bottom) / 2
    m = folium.Map(location=[lat_center, lon_center], zoom_start=8, tiles="OpenStreetMap")

    # ==== إضافة الصورة إلى الخريطة ====
    folium.raster_layers.ImageOverlay(
        name="Sentinel-1 VV+VH",
        image=temp_png,
        bounds=[[bounds.bottom, bounds.left], [bounds.top, bounds.right]],
        opacity=0.8
    ).add_to(m)

    folium.LayerControl().add_to(m)

    # ==== حفظ وفتح الخريطة ====
    map_file = "sentinel_map.html"
    m.save(map_file)
    os.startfile(map_file)

    print("✅ correct", map_file)

except Exception as e:
    print("⚠️ error happen")
    traceback.print_exc()
