"""Служба синтеза речи Silero (SPEC 12.3). Работает только внутри сервера: 127.0.0.1.

GET  /health -> {"ok": true, "rss_mb": ..., "speakers": [...]}
POST /tts    {"text": "...", "speaker": "xenia"} -> audio/wav, заголовок X-Synth-Ms
"""
import io
import json
import os
import re
import resource
import threading
import time
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import torch

MODEL_PATH = os.environ.get("TTS_MODEL", "/opt/mct/tts-models/v4_ru.pt")
HOST = os.environ.get("TTS_HOST", "127.0.0.1")
PORT = int(os.environ.get("TTS_PORT", "3011"))
SAMPLE_RATE = 24000
MAX_TEXT = 1000

torch.set_num_threads(int(os.environ.get("TTS_THREADS", "2")))
_t = time.time()
model = torch.package.PackageImporter(MODEL_PATH).load_pickle("tts_models", "model")
model.to(torch.device("cpu"))
SPEAKERS = [s for s in model.speakers if s != "random"]
print(f"[tts] модель загружена за {time.time() - _t:.1f} с, голоса: {', '.join(SPEAKERS)}", flush=True)

_lock = threading.Lock()  # модель не рассчитана на параллельные вызовы


def chunks(text, limit=700):
    """Режем длинный текст по предложениям, чтобы модель не падала на больших кусках."""
    parts, cur = [], ""
    for sent in re.split(r"(?<=[.!?…])\s+", text):
        if len(cur) + len(sent) + 1 > limit and cur:
            parts.append(cur)
            cur = sent
        else:
            cur = f"{cur} {sent}".strip()
    if cur:
        parts.append(cur)
    return parts


def synth(text, speaker):
    pause = torch.zeros(int(SAMPLE_RATE * 0.15))
    pieces = []
    with _lock:
        for part in chunks(text):
            audio = model.apply_tts(text=part, speaker=speaker, sample_rate=SAMPLE_RATE, put_accent=True, put_yo=True)
            pieces += [audio, pause]
    pcm = (torch.cat(pieces[:-1]).clamp(-1, 1) * 32767).to(torch.int16).numpy().tobytes()
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SAMPLE_RATE)
        w.writeframes(pcm)
    return buf.getvalue()


def rss_mb():
    return round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024)


class Handler(BaseHTTPRequestHandler):
    def _json(self, code, data):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            return self._json(200, {"ok": True, "rss_mb": rss_mb(), "speakers": SPEAKERS})
        self._json(404, {"error": "нет такого адреса"})

    def do_POST(self):
        if self.path != "/tts":
            return self._json(404, {"error": "нет такого адреса"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            data = json.loads(self.rfile.read(min(length, 20000)) or b"{}")
            text = str(data.get("text", "")).strip()
            speaker = str(data.get("speaker", "xenia"))
        except (ValueError, json.JSONDecodeError):
            return self._json(400, {"error": "неверный запрос"})
        if not text or len(text) > MAX_TEXT:
            return self._json(400, {"error": f"текст пустой или длиннее {MAX_TEXT} символов"})
        if speaker not in SPEAKERS:
            return self._json(400, {"error": "неизвестный голос"})
        t0 = time.time()
        try:
            wav = synth(text, speaker)
        except Exception as e:  # модель иногда не принимает отдельные символы
            print(f"[tts] ошибка синтеза: {e}", flush=True)
            return self._json(500, {"error": "не удалось озвучить текст"})
        ms = int((time.time() - t0) * 1000)
        self.send_response(200)
        self.send_header("Content-Type", "audio/wav")
        self.send_header("Content-Length", str(len(wav)))
        self.send_header("X-Synth-Ms", str(ms))
        self.end_headers()
        self.wfile.write(wav)

    def log_message(self, fmt, *args):
        # Текст реплик в журнал не пишем (SPEC 13.1) — только служебное
        print(f"[tts] {self.command} {self.path} {args[1] if len(args) > 1 else ''}", flush=True)


if __name__ == "__main__":
    print(f"[tts] слушаю http://{HOST}:{PORT}", flush=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
