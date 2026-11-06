# Optional image-to-3D backend

The PWA works fully without this server. The server adds **real** single-image → 3D mesh generation using **TripoSR** (code and weights MIT, by Stability AI & Tripo AI). It needs an NVIDIA GPU (≈6–8 GB VRAM). CPU works but is very slow.

**Honest limits:** TripoSR produces a mesh with vertex colours from one image. Unseen sides are guessed. It is **not rigged**, not animated, and is usually less detailed than commercial services such as Meshy. Treat results as a starting point.

Not included on purpose: **Hunyuan3D** (its license excludes the EU, UK and South Korea). **TRELLIS** (MIT, higher quality) needs 16–24 GB VRAM and is planned as a second adapter.

## API (v1)
| Method | Path | Result |
|---|---|---|
| GET | `/health` | `{status:"ok", model, device, version}` or 503 with the real loading error |
| POST | `/v1/jobs` (multipart: `image`, `remove_bg`, `mc_resolution`) | `{id}` |
| GET | `/v1/jobs/{id}` | `{status: queued/running/done/failed, progress, error}` |
| GET | `/v1/jobs/{id}/result` | GLB file |

Optional `API_TOKEN` env → clients must send `Authorization: Bearer <token>`. CORS defaults to `https://*.github.io` and localhost (`ALLOWED_ORIGIN_REGEX`).

## Option A — Google Colab (free, quota-limited, you must start it each time)
Colab's free GPU is not guaranteed and sessions stop after inactivity/time limits.

1. Open https://colab.research.google.com → New notebook → *Runtime → Change runtime type → T4 GPU*.
2. Upload `backend/main.py` and `backend/requirements.txt` (folder icon on the left), then run in one cell:
```bash
!git clone https://github.com/VAST-AI-Research/TripoSR
!pip install -q -r TripoSR/requirements.txt
!pip install -q -r requirements.txt
!wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O cloudflared && chmod +x cloudflared
```
3. Start the server and a free HTTPS tunnel (new cell):
```bash
import os, subprocess, secrets
os.environ["PYTHONPATH"] = "/content/TripoSR"
os.environ["API_TOKEN"] = secrets.token_urlsafe(16); print("TOKEN:", os.environ["API_TOKEN"])
subprocess.Popen(["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"], env=os.environ)
!./cloudflared tunnel --url http://localhost:8000
```
4. Copy the `https://….trycloudflare.com` address and the printed TOKEN into the app: **Image → 3D → Processing server**, then press **Check connection**. The first start downloads the weights (≈1.7 GB) — wait until health shows “Connected”.

## Option B — your own PC (NVIDIA GPU)
```bash
python -m venv .venv && . .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
git clone https://github.com/VAST-AI-Research/TripoSR && pip install -r TripoSR/requirements.txt
pip install -r requirements.txt
PYTHONPATH=TripoSR API_TOKEN=choose-a-secret uvicorn main:app --host 0.0.0.0 --port 8000
```
Phones need HTTPS: expose it with `cloudflared tunnel --url http://localhost:8000` (free) or your own reverse proxy.

## Privacy
Images are sent only when you press **Generate**, only to the URL you entered, kept in memory, and dropped after processing (results: last 20 jobs in memory). Never commit tokens to Git.

## Costs
Software: free (MIT). Compute: your own electricity/GPU, or Colab free tier (limited) / paid GPU rentals — only with your explicit decision.
