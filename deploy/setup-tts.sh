#!/bin/bash
# Разовая установка службы голоса на main (запускать на сервере от root).
# Ставит PyTorch (версия для процессора) в /opt/mct/tts-venv и скачивает модель Silero v4_ru.
set -euo pipefail
VENV=/opt/mct/tts-venv
MODELS=/opt/mct/tts-models
MODEL_URL=https://models.silero.ai/models/tts/ru/v4_ru.pt

if [ ! -x $VENV/bin/python ]; then
	python3 -m venv $VENV
	$VENV/bin/pip install --quiet --upgrade pip
	$VENV/bin/pip install --quiet torch --index-url https://download.pytorch.org/whl/cpu
	$VENV/bin/pip install --quiet numpy
fi
$VENV/bin/python -c "import torch; print('torch', torch.__version__)"

mkdir -p $MODELS
if [ ! -s $MODELS/v4_ru.pt ]; then
	curl -fsSL -o $MODELS/v4_ru.pt.part "$MODEL_URL"
	mv $MODELS/v4_ru.pt.part $MODELS/v4_ru.pt
fi
chmod 755 $MODELS; chmod 644 $MODELS/v4_ru.pt
ls -la $MODELS
du -sh $VENV $MODELS
