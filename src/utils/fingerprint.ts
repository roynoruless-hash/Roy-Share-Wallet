/**
 * Browser Device Fingerprinting Utility for Anti Self-Referral Detection
 * Generates a stable device hash using canvas 2D, WebGL, screen, audio, and browser signals.
 */

export interface DeviceFingerprintData {
  hash: string;
  components: {
    userAgent: string;
    screenResolution: string;
    colorDepth: number;
    pixelRatio: number;
    timezone: string;
    language: string;
    hardwareConcurrency: number;
    touchPoints: number;
    canvasHash: string;
    webglVendor: string;
    webglRenderer: string;
    audioHash: string;
  };
}

/**
 * FNV-1a 32-bit Hash algorithm for fast string hashing
 */
function fnv1a(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Generate 2D Canvas Fingerprint
 */
function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 60;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no_canvas_context';

    ctx.textBaseline = 'top';
    ctx.font = '14px "Arial", "Helvetica", sans-serif';
    ctx.fillStyle = '#f60';
    ctx.fillRect(10, 10, 62, 20);

    ctx.fillStyle = '#069';
    ctx.fillText('RoyShareAntiSelfRefCheck,123!#$', 2, 15);

    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('RoyShareAntiSelfRefCheck,123!#$', 4, 17);

    return fnv1a(canvas.toDataURL());
  } catch (e) {
    return 'canvas_error';
  }
}

/**
 * Get WebGL Vendor & Renderer
 */
function getWebGLInfo(): { vendor: string; renderer: string } {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return { vendor: 'none', renderer: 'none' };

    const ext = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
    if (!ext) return { vendor: 'generic_gl', renderer: 'generic_renderer' };

    const vendor = (gl as WebGLRenderingContext).getParameter(ext.UNMASKED_VENDOR_WEBGL) || 'unknown';
    const renderer = (gl as WebGLRenderingContext).getParameter(ext.UNMASKED_RENDERER_WEBGL) || 'unknown';
    return { vendor: String(vendor), renderer: String(renderer) };
  } catch (e) {
    return { vendor: 'error', renderer: 'error' };
  }
}

/**
 * Get Audio Context Hash
 */
async function getAudioFingerprint(): Promise<string> {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return 'no_audio_ctx';

    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const compressor = ctx.createDynamicsCompressor();

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(10000, ctx.currentTime);

    compressor.threshold.setValueAtTime(-50, ctx.currentTime);
    compressor.knee.setValueAtTime(40, ctx.currentTime);
    compressor.ratio.setValueAtTime(12, ctx.currentTime);
    compressor.attack.setValueAtTime(0, ctx.currentTime);
    compressor.release.setValueAtTime(0.25, ctx.currentTime);

    oscillator.connect(compressor);
    compressor.connect(ctx.destination);

    const hash = fnv1a(`${ctx.sampleRate}_${compressor.reduction}`);
    ctx.close().catch(() => {});
    return hash;
  } catch (e) {
    return 'audio_error';
  }
}

/**
 * Generate complete stable device fingerprint
 */
export async function generateDeviceFingerprint(): Promise<DeviceFingerprintData> {
  const userAgent = navigator.userAgent || 'unknown';
  const screenResolution = `${window.screen.width}x${window.screen.height}`;
  const colorDepth = window.screen.colorDepth || 24;
  const pixelRatio = window.devicePixelRatio || 1;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const language = navigator.language || (navigator as any).userLanguage || 'en-US';
  const hardwareConcurrency = navigator.hardwareConcurrency || 4;
  const touchPoints = navigator.maxTouchPoints || 0;

  const canvasHash = getCanvasFingerprint();
  const webgl = getWebGLInfo();
  const audioHash = await getAudioFingerprint();

  const components = {
    userAgent,
    screenResolution,
    colorDepth,
    pixelRatio,
    timezone,
    language,
    hardwareConcurrency,
    touchPoints,
    canvasHash,
    webglVendor: webgl.vendor,
    webglRenderer: webgl.renderer,
    audioHash,
  };

  const rawSignal = [
    userAgent,
    screenResolution,
    colorDepth,
    pixelRatio,
    timezone,
    language,
    hardwareConcurrency,
    touchPoints,
    canvasHash,
    webgl.vendor,
    webgl.renderer,
    audioHash,
  ].join('|||');

  let hash = '';
  if (window.crypto && window.crypto.subtle) {
    try {
      const msgBuffer = new TextEncoder().encode(rawSignal);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      hash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      hash = fnv1a(rawSignal) + fnv1a(rawSignal.split('').reverse().join(''));
    }
  } else {
    hash = fnv1a(rawSignal) + fnv1a(rawSignal.split('').reverse().join(''));
  }

  return {
    hash: `fp_${hash.substring(0, 32)}`,
    components,
  };
}
