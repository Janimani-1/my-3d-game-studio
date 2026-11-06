"""
My 3D Game Studio — optional image-to-3D backend (FastAPI).

Runs a real open-source model on YOUR machine or a Colab GPU session. Nothing is faked:
if the model cannot load, /health reports the error and jobs are refused.

Adapters
  triposr  — TripoSR (Stability AI & Tripo AI), code + weights MIT. ~6-8 GB VRAM. Default.
  (trellis — planned: Microsoft TRELLIS, MIT, needs ~16-24 GB VRAM.)
  Hunyuan3D is intentionally NOT included: its license excludes the EU/UK/South Korea.

Environment variables
  ADAPTER=triposr            which adapter to load
  API_TOKEN=...              optional; if set, requests need "Authorization: Bearer <token>"
  ALLOWED_ORIGIN_REGEX=...   CORS origins (default: GitHub Pages + localhost)
  MAX_UPLOAD_MB=15
  DEVICE=cuda|cpu            default: cuda if available

Run:  uvicorn main:app --host 0.0.0.0 --port 8000
"""
from __future__ import annotations

import io
import os
import queue
import threading
import time
import traceback
import uuid
from dataclasses import dataclass, field

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

VERSION = "0.2.0"
ADAPTER_NAME = os.environ.get("ADAPTER", "triposr")
API_TOKEN = os.environ.get("API_TOKEN", "")
MAX_UPLOAD = int(os.environ.get("MAX_UPLOAD_MB", "15")) * 1024 * 1024
ORIGIN_REGEX = os.environ.get("ALLOWED_ORIGIN_REGEX", r"https://[a-z0-9-]+\.github\.io|http://localhost(:\d+)?|http://127\.0\.0\.1(:\d+)?")


# ----------------------------------------------------------------------------- adapters
class Adapter:
    name = "base"
    device = "cpu"

    def load(self) -> None:  # pragma: no cover - interface
        raise NotImplementedError

    def run(self, image, remove_bg: bool, resolution: int, progress) -> bytes:  # pragma: no cover
        raise NotImplementedError


class TripoSRAdapter(Adapter):
    """https://github.com/VAST-AI-Research/TripoSR — weights: huggingface.co/stabilityai/TripoSR (MIT)."""

    name = "triposr"

    def load(self) -> None:
        import torch  # noqa: WPS433
        from tsr.system import TSR  # provided by the TripoSR repository on PYTHONPATH
        import rembg

        self.torch = torch
        self.device = os.environ.get("DEVICE") or ("cuda:0" if torch.cuda.is_available() else "cpu")
        self.model = TSR.from_pretrained("stabilityai/TripoSR", config_name="config.yaml", weight_name="model.ckpt")
        self.model.renderer.set_chunk_size(8192)
        self.model.to(self.device)
        self.rembg_session = rembg.new_session()

    def run(self, image, remove_bg: bool, resolution: int, progress) -> bytes:
        import numpy as np
        from PIL import Image
        from tsr.utils import remove_background, resize_foreground

        progress(0.1)
        if remove_bg:
            image = remove_background(image, self.rembg_session)
            image = resize_foreground(image, 0.85)
            arr = np.array(image).astype(np.float32) / 255.0
            arr = arr[:, :, :3] * arr[:, :, 3:4] + (1 - arr[:, :, 3:4]) * 0.5
            image = Image.fromarray((arr * 255.0).astype(np.uint8))
        else:
            image = image.convert("RGB")
        progress(0.3)
        with self.torch.no_grad():
            scene_codes = self.model([image], device=self.device)
        progress(0.7)
        meshes = self.model.extract_mesh(scene_codes, True, resolution=resolution)
        progress(0.9)
        return meshes[0].export(file_type="glb")


ADAPTERS = {"triposr": TripoSRAdapter}


# ----------------------------------------------------------------------------- job queue
@dataclass
class Job:
    id: str
    image: bytes
    remove_bg: bool
    resolution: int
    status: str = "queued"
    progress: float = 0.0
    error: str | None = None
    result: bytes | None = None
    created: float = field(default_factory=time.time)


JOBS: dict[str, Job] = {}
WORK: "queue.Queue[str]" = queue.Queue()
STATE = {"adapter": None, "error": None}


def worker() -> None:
    from PIL import Image

    while True:
        jid = WORK.get()
        job = JOBS.get(jid)
        if not job:
            continue
        job.status = "running"
        try:
            img = Image.open(io.BytesIO(job.image))
            img.load()

            def progress(p: float) -> None:
                job.progress = float(p)

            job.result = STATE["adapter"].run(img, job.remove_bg, job.resolution, progress)
            job.progress = 1.0
            job.status = "done"
        except Exception as e:  # report real errors to the app
            traceback.print_exc()
            job.status = "failed"
            job.error = f"{type(e).__name__}: {e}"[:500]
        finally:
            job.image = b""
        # keep at most 20 finished jobs in memory
        done = sorted((j for j in JOBS.values() if j.status in ("done", "failed")), key=lambda j: j.created)
        for old in done[:-20]:
            JOBS.pop(old.id, None)


def load_adapter() -> None:
    try:
        cls = ADAPTERS[ADAPTER_NAME]
        a = cls()
        a.load()
        STATE["adapter"] = a
        threading.Thread(target=worker, daemon=True).start()
        print(f"[backend] adapter '{a.name}' ready on {a.device}")
    except Exception as e:
        STATE["error"] = f"{type(e).__name__}: {e}"
        traceback.print_exc()


# ----------------------------------------------------------------------------- API
app = FastAPI(title="My 3D Game Studio backend", version=VERSION)
app.add_middleware(CORSMiddleware, allow_origin_regex=ORIGIN_REGEX, allow_methods=["GET", "POST"], allow_headers=["Authorization", "Content-Type"])


def auth(authorization: str | None = Header(default=None)) -> None:
    if API_TOKEN and authorization != f"Bearer {API_TOKEN}":
        raise HTTPException(401, "invalid or missing token")


@app.on_event("startup")
def _startup() -> None:
    threading.Thread(target=load_adapter, daemon=True).start()


@app.get("/health")
def health(_: None = Depends(auth)):
    a = STATE["adapter"]
    if a is None:
        raise HTTPException(503, STATE["error"] or "model is still loading")
    return {"status": "ok", "model": a.name, "device": str(a.device), "version": VERSION}


@app.post("/v1/jobs")
async def create_job(
    image: UploadFile = File(...),
    remove_bg: bool = Form(True),
    mc_resolution: int = Form(256),
    _: None = Depends(auth),
):
    if STATE["adapter"] is None:
        raise HTTPException(503, STATE["error"] or "model is still loading")
    data = await image.read()
    if len(data) > MAX_UPLOAD:
        raise HTTPException(413, "image too large")
    try:
        from PIL import Image

        Image.open(io.BytesIO(data)).verify()
    except Exception:
        raise HTTPException(400, "not a valid image")
    if not 64 <= mc_resolution <= 512:
        raise HTTPException(400, "mc_resolution must be 64..512")
    job = Job(id=uuid.uuid4().hex, image=data, remove_bg=remove_bg, resolution=mc_resolution)
    JOBS[job.id] = job
    WORK.put(job.id)
    return {"id": job.id}


@app.get("/v1/jobs/{jid}")
def get_job(jid: str, _: None = Depends(auth)):
    job = JOBS.get(jid)
    if not job:
        raise HTTPException(404, "unknown job")
    return {"id": job.id, "status": job.status, "progress": job.progress, "error": job.error}


@app.get("/v1/jobs/{jid}/result")
def get_result(jid: str, _: None = Depends(auth)):
    job = JOBS.get(jid)
    if not job or job.status != "done" or not job.result:
        raise HTTPException(404, "result not available")
    return Response(job.result, media_type="model/gltf-binary", headers={"Content-Disposition": f'attachment; filename="generated-{jid[:8]}.glb"'})
