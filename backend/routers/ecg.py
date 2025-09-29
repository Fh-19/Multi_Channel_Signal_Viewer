from fastapi import APIRouter, HTTPException, Query, WebSocket
from typing import List
import asyncio
from ..services import ecg_processing as dsp

router = APIRouter()

# -----------------------
# API Endpoint (Mode 1: cycles)
# -----------------------
@router.get("/ecg")
def get_ecg(
    record_number: str = Query(..., description="ECG record number, e.g., '98'"),
    leads: List[int] = Query([0, 1, 2], description="List of lead indices (0-11)"),
):
    try:
        signals, fs = dsp.load_ecg_record(record_number)
        r_peaks_dict = dsp.get_r_peaks_per_lead(signals, fs, leads=leads)
        cycles = dsp.extract_cycles(signals, r_peaks_dict, selected_leads=leads)

        return {
            "signals": signals[:, leads].tolist(),
            "fs": fs,
            "r_peaks": r_peaks_dict,
            "cycles": cycles,
        }
    except FileNotFoundError as fe:
        raise HTTPException(status_code=404, detail=str(fe))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# -----------------------
# WebSocket (Mode 2: continuous)
# -----------------------
@router.websocket("/ws/ecg/{record_number}")
async def stream_ecg(websocket: WebSocket, record_number: str):
    """
    Stream ECG samples in real time over WebSocket with R-peak markers.
    """
    await websocket.accept()
    try:
        signals, fs = dsp.load_ecg_record(record_number)
        r_peaks = dsp.get_r_peaks(signals, fs, lead=0)

        window_size = 50  # send samples in chunks
        for i in range(0, len(signals), window_size):
            chunk = signals[i:i+window_size, :3].tolist()  # send first 3 leads for now
            chunk_peaks = [p for p in r_peaks if i <= p < i + window_size]

            await websocket.send_json({
                "samples": chunk,
                "start_index": i,
                "fs": fs,
                "peaks": chunk_peaks
            })

            await asyncio.sleep(window_size / fs)
    finally:
        await websocket.close()
