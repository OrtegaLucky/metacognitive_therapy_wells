#!/bin/bash
# Разовая установка службы распознавания речи на main (запускать на сервере от root).
# Ставит faster-whisper в /opt/mct/stt-venv и скачивает модель в /opt/mct/stt-models.
# Модель по умолчанию — small; другую можно передать аргументом: setup-stt.sh medium
set -euo pipefail
VENV=/opt/mct/stt-venv
MODELS=/opt/mct/stt-models
M=${1:-small}

if [ ! -x $VENV/bin/python ]; then
	python3 -m venv $VENV
	$VENV/bin/pip install --quiet --upgrade pip
	# av 16+ несовместим с faster-whisper 1.2 (нет параметра metadata_errors)
	$VENV/bin/pip install --quiet faster-whisper "av>=14,<16"
fi
$VENV/bin/python -c "import faster_whisper, ctranslate2; print('faster-whisper', faster_whisper.__version__, 'ctranslate2', ctranslate2.__version__)"

mkdir -p $MODELS
$VENV/bin/python -c "from faster_whisper import WhisperModel; WhisperModel('$M', device='cpu', compute_type='int8', download_root='$MODELS')"
chown -R root:root $MODELS
find $MODELS -type d -exec chmod 755 {} +
find $MODELS -type f -exec chmod 644 {} +
du -sh $VENV $MODELS
