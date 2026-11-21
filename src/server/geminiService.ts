import {
  GoogleGenAI,
  InteractionStatus,
  LiveServerMessage,
  Modality,
  ThinkingLevel,
} from '@google/genai';
import type http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { AI_PERSONALITIES, DEFAULT_AI_PERSONALITY, buildAISystemInstruction } from '../data/aiPersonalities';

export interface UploadedFilePayload {
  name: string;
  mimeType?: string;
  dataBase64: string;
  size?: number;
}

export interface FileInspectionResult {
  inspectorModel: string;
  detectedKind: string;
  normalizedMimeType: string;
  sizeBytes: number;
  transcript?: string;
  analysisReport: string;
}

const AUDIO_EXT_MIME: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  opus: 'audio/opus',
  weba: 'audio/webm',
};

const VIDEO_EXT_MIME: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
  mpeg: 'video/mpeg',
  mpg: 'video/mpeg',
  '3gp': 'video/3gpp',
};

const IMAGE_EXT_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
};

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'jsonl', 'xml', 'html', 'htm',
  'css', 'scss', 'less', 'js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx', 'py', 'rb',
  'go', 'rs', 'java', 'c', 'h', 'cpp', 'hpp', 'cs', 'php', 'sh', 'bash', 'zsh',
  'ps1', 'sql', 'yaml', 'yml', 'toml', 'ini', 'conf', 'cfg', 'env', 'log', 'svg',
  'gitignore', 'dockerfile', 'makefile',
]);

const GEMINI_INLINE_SUPPORTED_MIMES = new Set([
  'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif', 'image/gif',
  'audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/aiff', 'audio/aac', 'audio/ogg', 'audio/flac', 'audio/mp4', 'audio/webm',
  'video/mp4', 'video/mpeg', 'video/mov', 'video/quicktime', 'video/avi', 'video/x-msvideo', 'video/x-flv', 'video/mpg', 'video/webm', 'video/wmv', 'video/3gpp',
  'application/pdf', 'text/plain', 'text/csv', 'text/html',
]);

export function resolveGeminiApiKey(): string {
  const key = (process.env.GEMINI_API_KEY || '').replace(/^["']|["']$/g, '').trim();
  if (!key || key.startsWith('gsk_')) return '';
  return key;
}

export function createGeminiClient(apiVersion?: string): GoogleGenAI {
  const apiKey = resolveGeminiApiKey();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing or invalid. Please check your key in the Settings > Secrets panel.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      ...(apiVersion ? { apiVersion } : {}),
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isTransientCapacityError(err: any): boolean {
  const msg = String(err?.message || err || '');
  return (
    msg.includes('"code":503') ||
    msg.includes('"code":429') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('high demand') ||
    msg.includes('overloaded')
  );
}

function extractReadableGeminiError(err: any): string {
  const raw = String(err?.message || err || 'Gemini API request failed.');
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.error?.message) return String(parsed.error.message);
  } catch {}
  return raw;
}

async function runMultimodalInspection(
  ai: GoogleGenAI,
  contents: any
): Promise<{ modelUsed: string; text: string }> {
  const attempts: Array<{ model: string; useLowThinking: boolean; delayMs: number }> = [
    { model: 'gemini-4-hydrogen', useLowThinking: true, delayMs: 0 },
    { model: 'gemini-3.1-flash-lite', useLowThinking: false, delayMs: 300 },
    { model: 'gemini-4-hydrogen', useLowThinking: true, delayMs: 900 },
  ];

  let lastErr: any = null;
  for (const attempt of attempts) {
    if (attempt.delayMs > 0) {
      await new Promise((r) => setTimeout(r, attempt.delayMs));
    }
    try {
      const res = await ai.models.generateContent({
        model: attempt.model,
        contents,
        ...(attempt.useLowThinking
          ? { config: { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } }
          : {}),
      });
      const text = (res.text || '').trim();
      if (text) {
        return { modelUsed: attempt.model, text };
      }
    } catch (err: any) {
      lastErr = err;
      if (!isTransientCapacityError(err)) {
        throw new Error(extractReadableGeminiError(err));
      }
      console.warn(`[Gemini Inspector] ${attempt.model} transient 503/429, trying next attempt...`);
    }
  }

  throw new Error(extractReadableGeminiError(lastErr || 'Multimodal inspector model is temporarily busy.'));
}

function getFileExtension(filename: string): string {
  const clean = filename.split(/[\\/]/).pop() || '';
  const idx = clean.lastIndexOf('.');
  return idx !== -1 ? clean.slice(idx + 1).toLowerCase() : '';
}

function normalizeMimeType(filename: string, rawMime?: string): string {
  const mime = (rawMime || '').split(';')[0].trim().toLowerCase();
  const ext = getFileExtension(filename);

  if (mime === 'audio/mp3') return 'audio/mpeg';
  if (mime === 'video/mov') return 'video/quicktime';
  if (mime && mime !== 'application/octet-stream') return mime;

  if (AUDIO_EXT_MIME[ext]) return AUDIO_EXT_MIME[ext];
  if (VIDEO_EXT_MIME[ext]) return VIDEO_EXT_MIME[ext];
  if (IMAGE_EXT_MIME[ext]) return IMAGE_EXT_MIME[ext];
  if (ext === 'pdf') return 'application/pdf';
  if (TEXT_EXTENSIONS.has(ext)) return ext === 'csv' ? 'text/csv' : ext === 'html' || ext === 'htm' ? 'text/html' : 'text/plain';

  return mime || 'application/octet-stream';
}

function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function detectMagicSignature(buf: Buffer): string {
  if (buf.length < 4) return 'Tiny/Empty Binary';
  const hex4 = buf.subarray(0, 4).toString('hex').toUpperCase();
  const ascii4 = buf.subarray(0, 4).toString('latin1');
  if (ascii4 === '%PDF') return 'PDF Document (%PDF)';
  if (hex4 === '504B0304' || hex4 === '504B0506') return 'ZIP Archive / Office / APK / JAR container (PK)';
  if (hex4 === '89504E47') return 'PNG Image';
  if (hex4.startsWith('FFD8FF')) return 'JPEG Image';
  if (ascii4 === 'GIF8') return 'GIF Image';
  if (ascii4 === 'RIFF' && buf.length >= 12) return `RIFF container (${buf.subarray(8, 12).toString('latin1')})`;
  if (ascii4 === 'ID3\x03' || ascii4 === 'ID3\x04' || ascii4.startsWith('ID3') || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) {
    return 'MP3 / MPEG Audio';
  }
  if (buf.length >= 8 && buf.subarray(4, 8).toString('latin1') === 'ftyp') return 'ISO Base Media / MP4 / M4A container';
  if (hex4 === '1A45DFA3') return 'Matroska / WebM container';
  if (ascii4 === 'OggS') return 'Ogg Media container';
  if (ascii4 === 'fLaC') return 'FLAC Lossless Audio';
  if (hex4 === '0061736D') return 'WebAssembly Binary (.wasm)';
  if (buf[0] === 0x4d && buf[1] === 0x5a) return 'Windows PE Executable / DLL (MZ)';
  if (hex4 === '7F454C46') return 'Linux ELF Binary';
  if (ascii4 === 'NES\x1a') return 'NES ROM Image (iNES)';
  if (buf.subarray(0, 15).toString('latin1') === 'SQLite format 3') return 'SQLite 3 Database';
  if (hex4 === '377ABCAF') return '7-Zip Archive';
  if (ascii4 === 'Rar!') return 'RAR Archive';
  return `Binary (header hex: ${buf.subarray(0, Math.min(16, buf.length)).toString('hex')})`;
}

function isLikelyUtf8Text(buf: Buffer): boolean {
  const sample = buf.subarray(0, Math.min(4096, buf.length));
  if (sample.length === 0) return true;
  let controlCount = 0;
  for (let i = 0; i < sample.length; i++) {
    const b = sample[i];
    if (b === 0) return false;
    if (b < 32 && b !== 9 && b !== 10 && b !== 13) controlCount++;
  }
  return controlCount / sample.length < 0.05;
}

function extractReadableStrings(buf: Buffer, maxLen = 4000): string {
  const matches = buf.toString('latin1').match(/[\x20-\x7e]{5,}/g);
  if (!matches) return '';
  return matches.slice(0, 120).join(' | ').slice(0, maxLen);
}

/**
 * Stage 1 File Inspector: Uses a Gemini multimodal / transcription model
 * (different from the downstream text model) to inspect any uploaded video,
 * image, audio/mp3, document, code, or binary file and return a clear factual report.
 */
export async function inspectUploadedFileWithGemini(
  file: UploadedFilePayload,
  userPrompt: string
): Promise<FileInspectionResult> {
  const ai = createGeminiClient();
  const base64Clean = file.dataBase64.includes(',')
    ? file.dataBase64.slice(file.dataBase64.indexOf(',') + 1)
    : file.dataBase64;
  const buffer = Buffer.from(base64Clean, 'base64');
  const sizeBytes = file.size || buffer.length;
  const normalizedMime = normalizeMimeType(file.name, file.mimeType);
  const ext = getFileExtension(file.name);

  const isAudio = normalizedMime.startsWith('audio/');
  const isVideo = normalizedMime.startsWith('video/');
  const isImage = normalizedMime.startsWith('image/') && normalizedMime !== 'image/svg+xml';
  const isPdf = normalizedMime === 'application/pdf';
  const isTextLike =
    normalizedMime.startsWith('text/') ||
    normalizedMime === 'image/svg+xml' ||
    TEXT_EXTENSIONS.has(ext) ||
    (!GEMINI_INLINE_SUPPORTED_MIMES.has(normalizedMime) && isLikelyUtf8Text(buffer));

  // 1. Audio / MP3 branch: Transcribe spoken lyrics/speech with gemini-3.5-transcribe + inspect audio with gemini-4-hydrogen
  if (isAudio) {
    let transcript = '';
    const modelsUsed: string[] = [];

    try {
      const transcribeRes = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: normalizedMime,
                data: base64Clean,
              },
            },
            {
              text: 'Transcribe all spoken words, dialogue, narration, or lyrics accurately. If there is no speech, state "[No speech detected]".',
            },
          ],
        },
      });
      const t = (transcribeRes.text || '').trim();
      if (t) {
        transcript = t;
        modelsUsed.push('gemini-3.5-transcribe');
      }
    } catch (transErr: any) {
      console.warn('[Gemini Inspector] Transcription step note:', transErr?.message || transErr);
    }

    const inspectResult = await runMultimodalInspection(ai, {
      parts: [
        {
          inlineData: {
            mimeType: normalizedMime,
            data: base64Clean,
          },
        },
        {
          text: `You are Stage 1 Multimodal Audio Inspector. Carefully analyze this uploaded audio file ("${file.name}", ${normalizedMime}, ${formatByteSize(sizeBytes)}). Describe clearly what it is: speakers/voices, music/instruments/genre/tempo, sound effects, mood, key spoken content, and anything relevant to the user's request: "${userPrompt || 'What is this audio file?'}". Be factual and thorough.`,
        },
      ],
    });
    modelsUsed.push(inspectResult.modelUsed);

    const analysisReport = [
      `File: ${file.name} (${normalizedMime}, ${formatByteSize(sizeBytes)})`,
      transcript ? `Audio Transcript (gemini-3.5-transcribe):\n${transcript}` : '',
      `Audio Inspection (${inspectResult.modelUsed}):\n${inspectResult.text}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    return {
      inspectorModel: modelsUsed.join(' + '),
      detectedKind: 'audio',
      normalizedMimeType: normalizedMime,
      sizeBytes,
      transcript: transcript || undefined,
      analysisReport,
    };
  }

  // 2. Native Gemini Multimodal branch (Images, Videos, PDFs) using Stage 1 multimodal model
  if ((isImage || isVideo || isPdf) && GEMINI_INLINE_SUPPORTED_MIMES.has(normalizedMime)) {
    const kindLabel = isVideo ? 'video' : isImage ? 'image' : 'pdf document';
    const inspectPrompt = isVideo
      ? `You are Stage 1 Multimodal Video Inspector. Examine this uploaded video ("${file.name}", ${normalizedMime}, ${formatByteSize(sizeBytes)}) frame-by-frame and listen to its audio track. Identify clearly what is shown and heard: main subject, objects, people, text on screen, actions/events over time, spoken dialogue/sounds, style/setting, and details relevant to: "${userPrompt || 'What is this video?'}".`
      : isImage
      ? `You are Stage 1 Vision Inspector. Examine this uploaded image ("${file.name}", ${normalizedMime}, ${formatByteSize(sizeBytes)}). Identify clearly what it depicts: subjects, objects, text/OCR verbatim, UI/diagrams/equations if any, scene/colors/style, and details relevant to: "${userPrompt || 'What is this image?'}".`
      : `You are Stage 1 Document Inspector. Examine this uploaded PDF ("${file.name}", ${formatByteSize(sizeBytes)}). Summarize what document it is, key headings, extracted facts, tables/figures, and details relevant to: "${userPrompt || 'What is this PDF?'}".`;

    const inspectResult = await runMultimodalInspection(ai, {
      parts: [
        {
          inlineData: {
            mimeType: normalizedMime,
            data: base64Clean,
          },
        },
        { text: inspectPrompt },
      ],
    });

    if (!inspectResult.text) {
      throw new Error(`Gemini inspector returned an empty analysis for ${file.name}.`);
    }

    return {
      inspectorModel: inspectResult.modelUsed,
      detectedKind: kindLabel,
      normalizedMimeType: normalizedMime,
      sizeBytes,
      analysisReport: `File: ${file.name} (${normalizedMime}, ${formatByteSize(sizeBytes)})\n\n${kindLabel.toUpperCase()} Inspection:\n${inspectResult.text}`,
    };
  }

  // 3. Text / Source Code / Markup / CSV / SVG / Config files
  if (isTextLike) {
    const textContent = buffer.toString('utf8').slice(0, 90000);
    const inspectResult = await runMultimodalInspection(
      ai,
      `You are Stage 1 File & Code Inspector. Examine this uploaded file ("${file.name}", MIME: ${normalizedMime}, Size: ${formatByteSize(sizeBytes)}). Identify clearly what this file is, its format/language, purpose, structure, key contents, or any issues relevant to: "${userPrompt || 'What is this file?'}".\n\n--- FILE CONTENT ---\n${textContent}`
    );

    if (!inspectResult.text) {
      throw new Error(`Gemini inspector returned an empty analysis for ${file.name}.`);
    }

    return {
      inspectorModel: inspectResult.modelUsed,
      detectedKind: 'text/code file',
      normalizedMimeType: normalizedMime,
      sizeBytes,
      analysisReport: `File: ${file.name} (${normalizedMime}, ${formatByteSize(sizeBytes)})\n\nInspection:\n${inspectResult.text}`,
    };
  }

  // 4. Generic Binary / Unknown File fallback (zip, exe, rom, bin, wasm, etc.)
  const signature = detectMagicSignature(buffer);
  const hexHeader = buffer.subarray(0, Math.min(128, buffer.length)).toString('hex').match(/.{1,2}/g)?.join(' ') || '';
  const readableStrings = extractReadableStrings(buffer, 3500);

  const inspectResult = await runMultimodalInspection(
    ai,
    `You are Stage 1 Binary File Inspector. Analyze this uploaded file metadata and binary signature, and explain clearly what file format/program/data it is and what it is used for in relation to the user's question ("${userPrompt || 'What is this file?'}").\n\nFilename: ${file.name}\nReported MIME: ${normalizedMime}\nSize: ${formatByteSize(sizeBytes)} (${sizeBytes} bytes)\nMagic Signature Detection: ${signature}\nFirst 128 bytes (hex): ${hexHeader}\nExtracted printable strings sample:\n${readableStrings || '[None found]'}`
  );

  if (!inspectResult.text) {
    throw new Error(`Gemini inspector returned an empty analysis for ${file.name}.`);
  }

  return {
    inspectorModel: inspectResult.modelUsed,
    detectedKind: signature,
    normalizedMimeType: normalizedMime,
    sizeBytes,
    analysisReport: `File: ${file.name} (${normalizedMime}, ${formatByteSize(sizeBytes)}, Signature: ${signature})\n\nBinary Inspection:\n${inspectResult.text}`,
  };
}

/**
 * Fallback Stage 2 Text Synthesizer when the OpenRouter text model is unavailable.
 */
export async function generateTextWithGeminiFallback(
  systemInstruction: string,
  userMessage: string,
  history: Array<{ role: string; text: string }> = []
): Promise<string> {
  const ai = createGeminiClient();
  const chat = ai.chats.create({
    model: 'gemini-3.1-flash-lite',
    config: {
      systemInstruction,
    },
    history: history
      .filter((m) => m.text?.trim())
      .map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }],
      })),
  });
  const res = await chat.sendMessage({ message: userMessage });
  return (res.text || '').trim();
}

const VALID_LIVE_VOICES = new Set(['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir']);

/**
 * Server-side WebSocket bridge for Gemini Live API (gemini-3.8-live / gemini-3.8-live-extended-thinking).
 */
export function createGeminiLiveUpgradeHandler() {
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', async (clientWs: WebSocket, req: http.IncomingMessage) => {
    let closed = false;
    let session: any = null;
    const queuedMessages: Array<{ type: string; data?: string; mimeType?: string; text?: string }> = [];

    const safeSendClient = (payload: Record<string, unknown>) => {
      if (closed || clientWs.readyState !== WebSocket.OPEN) return;
      try {
        clientWs.send(JSON.stringify(payload));
      } catch {}
    };

    const reqUrl = new URL(req.url || '/api/ai/live', 'http://localhost');
    const requestedVoice = reqUrl.searchParams.get('voice') || 'Zephyr';
    const voiceName = VALID_LIVE_VOICES.has(requestedVoice) ? requestedVoice : 'Zephyr';
    const useExtendedThinking = reqUrl.searchParams.get('thinking') === 'true';
    const personality = reqUrl.searchParams.get('personality') || 'balanced';
    const model = useExtendedThinking ? 'gemini-3.8-live-extended-thinking' : 'gemini-3.8-live';

    const dispatchInputToSession = (msg: { type: string; data?: string; mimeType?: string; text?: string }) => {
      if (!session || closed) return;
      try {
        if (msg.type === 'audio' && msg.data) {
          session.sendRealtimeInput({
            audio: {
              data: msg.data,
              mimeType: msg.mimeType || 'audio/pcm;rate=16000',
            },
          });
        } else if (msg.type === 'video' && msg.data) {
          session.sendRealtimeInput({
            video: {
              data: msg.data,
              mimeType: msg.mimeType || 'image/jpeg',
            },
          });
        } else if (msg.type === 'text' && msg.text) {
          session.sendRealtimeInput({
            text: msg.text,
          });
        }
      } catch (err: any) {
        safeSendClient({
          type: 'error',
          error: err?.message || 'Failed forwarding live input to Gemini Live.',
        });
      }
    };

    clientWs.on('message', (rawData) => {
      try {
        const parsed = JSON.parse(rawData.toString());
        if (!parsed || typeof parsed !== 'object') return;
        if (parsed.type === 'ping') {
          safeSendClient({ type: 'pong', ts: Date.now() });
          return;
        }
        if (session) {
          dispatchInputToSession(parsed);
        } else {
          queuedMessages.push(parsed);
          if (queuedMessages.length > 40) queuedMessages.shift();
        }
      } catch {}
    });

    const cleanup = () => {
      if (closed) return;
      closed = true;
      if (session) {
        try {
          session.close();
        } catch {}
        session = null;
      }
    };

    clientWs.on('close', cleanup);
    clientWs.on('error', cleanup);

    try {
      const ai = createGeminiClient('v1beta');
      const selectedPersona =
        AI_PERSONALITIES.find((p) => p.id === personality) ??
        AI_PERSONALITIES.find((p) => p.id === DEFAULT_AI_PERSONALITY)!;
      const liveInstruction = `You are in a live, real-time voice and vision conversation with the user, just like native Gemini Live.
Speak naturally, warmly, and fluidly with human pacing—never robotic or stiff. Keep spoken responses concise, engaging, and conversational.
Never read out markdown formatting, asterisks, URLs, or LaTeX symbols. If something the user says sounds casual, brief, or like an informal greeting or fragment, react naturally and conversationally rather than giving rigid error boilerplate.
LIVE CAMERA VISION: You receive real-time camera video frames from the user's camera. You CAN see the user's camera feed in real time. Whenever the camera is active, or the user shows something, asks "what is this?", "can you check this?", "what do you see?", "what am I looking at?", or points their camera at any object, document, book, screen, or surroundings, inspect the camera video frames and describe, identify, and answer questions about what is shown in the camera feed immediately and directly.
Conversational tone: ${selectedPersona.tone}`;

      const liveConfig: Record<string, any> = {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        systemInstruction: liveInstruction,
      };

      if (useExtendedThinking) {
        liveConfig.thinkingConfig = {
          thinkingLevel: ThinkingLevel.MEDIUM,
        };
      }

      session = await ai.live.connect({
        model,
        config: liveConfig,
        callbacks: {
          onopen: () => {
            safeSendClient({ type: 'ready', model, voice: voiceName });
          },
          onmessage: (message: LiveServerMessage) => {
            if (closed) return;
            const content = message.serverContent;

            if (content?.inputTranscription?.text) {
              safeSendClient({
                type: 'inputTranscript',
                text: content.inputTranscription.text,
              });
            }

            if (content?.outputTranscription?.text) {
              safeSendClient({
                type: 'outputTranscript',
                text: content.outputTranscription.text,
              });
            }

            for (const part of content?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                safeSendClient({
                  type: 'audio',
                  data: part.inlineData.data,
                });
              } else if (part.text) {
                safeSendClient({
                  type: 'modelText',
                  text: part.text,
                });
              }
            }

            if (content?.interrupted) {
              safeSendClient({ type: 'interrupted' });
            }

            if (content?.turnComplete) {
              safeSendClient({ type: 'turnComplete' });
            }

            const status = (content as any)?.interactionStatus;
            if (status === InteractionStatus.IN_PROGRESS) {
              safeSendClient({ type: 'status', status: 'in_progress' });
            } else if (status === InteractionStatus.IDLE) {
              safeSendClient({ type: 'status', status: 'idle' });
            }
          },
          onerror: (err: any) => {
            safeSendClient({
              type: 'error',
              error: err?.message || 'Gemini Live connection error.',
            });
          },
          onclose: (ev: any) => {
            safeSendClient({
              type: 'closed',
              reason: ev?.reason || 'Live session closed',
            });
            if (!closed) {
              closed = true;
              try {
                clientWs.close();
              } catch {}
            }
          },
        },
      });

      if (closed) {
        try {
          session.close();
        } catch {}
        return;
      }

      // Send ready notice & flush any buffered early messages
      safeSendClient({ type: 'ready', model, voice: voiceName });
      while (queuedMessages.length > 0) {
        const queued = queuedMessages.shift();
        if (queued) dispatchInputToSession(queued);
      }
    } catch (err: any) {
      const message = err?.message || 'Failed to connect to Gemini Live API.';
      safeSendClient({ type: 'error', error: message });
      closed = true;
      try {
        clientWs.close(1011, message.slice(0, 120));
      } catch {}
    }
  });

  return (req: http.IncomingMessage, socket: any, head: Buffer) => {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  };
}
