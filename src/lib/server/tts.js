// Адрес службы голоса Silero (SPEC 12.3)
import { env } from '$env/dynamic/private';

export const ttsBase = () => env.TTS_URL || 'http://127.0.0.1:3011';
