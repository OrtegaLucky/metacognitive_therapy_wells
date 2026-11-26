"""Служба распознавания речи faster-whisper (SPEC 12.3). Работает только внутри сервера: 127.0.0.1.

GET  /health -> {"ok": true, "model": "small", "rss_mb": ...}
POST /stt    тело — звук (webm/opus, mp4/aac, ogg, wav) -> {"text": "...", "ms": ..., "audio_sec": ...}

Звук обрабатывается в памяти и на диск не пишется. Текст в журнал не попадает.
"""
import io
import json
import os
import resource
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from faster_whisper import WhisperModel

MODEL = os.environ.get("STT_MODEL", "small")
MODELS_DIR = os.environ.get("STT_MODELS_DIR", "/opt/mct/stt-models")
HOST = os.environ.get("STT_HOST", "127.0.0.1")
PORT = int(os.environ.get("STT_PORT", "3012"))
THREADS = int(os.environ.get("STT_THREADS", "4"))
BEAM = int(os.environ.get("STT_BEAM", "1"))
MAX_BYTES = 15 * 1024 * 1024

_t = time.time()
model = WhisperModel(MODEL, device="cpu", compute_type="int8", cpu_threads=THREADS, download_root=MODELS_DIR)
print(f"[stt] модель {MODEL} загружена за {time.time() - _t:.1f} с", flush=True)

_lock = threading.Lock()  # фразы распознаются по одной


def rss_mb():
    return round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024)


def transcribe(data):
    with _lock:
        t0 = time.time()
        segments, info = model.transcribe(
            io.BytesIO(data),
            language="ru",
            beam_size=BEAM,
            vad_filter=True,
            condition_on_previous_text=False,
        )
        text = " ".join(s.text.strip() for s in segments).strip()
        return {"text": text, "ms": round((time.time() - t0) * 1000), "audio_sec": round(info.duration, 1)}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass  # без журнала запросов: в нём нечего хранить

    def send_json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            return self.send_json(200, {"ok": True, "model": MODEL, "rss_mb": rss_mb()})
        self.send_json(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/stt":
            return self.send_json(404, {"error": "not found"})
        n = int(self.headers.get("Content-Length") or 0)
        if n <= 0 or n > MAX_BYTES:
            return self.send_json(400, {"error": "Запись пустая или длиннее 15 МБ"})
        data = self.rfile.read(n)
        try:
            out = transcribe(data)
        except Exception as e:  # битый файл, неизвестный формат
            print(f"[stt] ошибка распознавания: {type(e).__name__}", flush=True)
            return self.send_json(422, {"error": "Не удалось разобрать запись"})
        finally:
            del data
        print(f"[stt] {out['audio_sec']} с звука за {out['ms']} мс, {len(out['text'])} симв.", flush=True)
        self.send_json(200, out)


if __name__ == "__main__":
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
