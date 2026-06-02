export type Support = 'supported' | 'partial' | 'unsupported' | 'unknown';

export type Capability = {
  id: string;
  name: string;
  description: string;
  category: Category;
  /** Sync check. Return support level at module load time. */
  check: () => Support;
  /** Optional async refinement (e.g. needs the SW registration). */
  refine?: (registration: ServiceWorkerRegistration | null) => Promise<Support>;
  /** Optional reference link (MDN, spec). */
  ref?: string;
};

export type Category =
  | 'Notifications'
  | 'Background & lifecycle'
  | 'Storage & files'
  | 'Hardware'
  | 'Sensors'
  | 'Media'
  | 'Input & UX'
  | 'Identity & payments'
  | 'Graphics & compute'
  | 'Networking'
  | 'Install & PWA';

const has = (root: unknown, key: string): boolean => {
  if (root == null) return false;
  return typeof root === 'object' && key in (root as object);
};

/** URL-safe slug for a Category name. Used in /category/:slug routes. */
export function slugifyCategory(c: string): string {
  return c.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const supported = (cond: boolean): Support => (cond ? 'supported' : 'unsupported');

export const CATEGORIES: Category[] = [
  'Install & PWA',
  'Notifications',
  'Background & lifecycle',
  'Storage & files',
  'Networking',
  'Hardware',
  'Sensors',
  'Media',
  'Input & UX',
  'Identity & payments',
  'Graphics & compute',
];

export const CAPABILITIES: Capability[] = [
  // ──── Install & PWA ──────────────────────────────────────────
  {
    id: 'service-worker',
    name: 'Service Worker',
    description: 'Background script for caching, push, and offline.',
    category: 'Install & PWA',
    check: () => supported('serviceWorker' in navigator),
    ref: 'https://developer.mozilla.org/docs/Web/API/Service_Worker_API',
  },
  {
    id: 'manifest-install',
    name: 'Install prompt',
    description: 'Browser-triggered "install this PWA" prompt.',
    category: 'Install & PWA',
    check: () => supported('onbeforeinstallprompt' in window),
  },
  {
    id: 'related-apps',
    name: 'Installed related apps',
    description: 'Detect whether the native or web app is already installed.',
    category: 'Install & PWA',
    check: () => supported('getInstalledRelatedApps' in navigator),
  },
  {
    id: 'wco',
    name: 'Window controls overlay',
    description: 'Customize the desktop titlebar area for installed PWAs.',
    category: 'Install & PWA',
    check: () => supported('windowControlsOverlay' in navigator),
  },
  {
    id: 'launch-queue',
    name: 'Launch handler',
    description: 'Control how the PWA launches (focus existing, navigate, etc).',
    category: 'Install & PWA',
    check: () => supported('launchQueue' in window),
  },

  // ──── Notifications ──────────────────────────────────────────
  {
    id: 'notifications',
    name: 'Notifications',
    description: 'Show OS-level notifications.',
    category: 'Notifications',
    check: () => supported('Notification' in window),
  },
  {
    id: 'push',
    name: 'Push API',
    description: 'Receive server-sent pushes even when closed.',
    category: 'Notifications',
    check: () => supported('PushManager' in window),
  },
  {
    id: 'badging',
    name: 'Badging',
    description: 'Show a numeric badge on the app icon.',
    category: 'Notifications',
    check: () => supported('setAppBadge' in navigator),
  },
  {
    id: 'vibration',
    name: 'Vibration',
    description: 'Vibrate the device.',
    category: 'Notifications',
    check: () => supported('vibrate' in navigator),
  },

  // ──── Background & lifecycle ────────────────────────────────
  {
    id: 'wake-lock',
    name: 'Screen Wake Lock',
    description: 'Prevent the screen from sleeping.',
    category: 'Background & lifecycle',
    check: () => supported('wakeLock' in navigator),
  },
  {
    id: 'idle-detection',
    name: 'Idle Detection',
    description: 'Detect when the user has gone idle.',
    category: 'Background & lifecycle',
    check: () => supported('IdleDetector' in window),
  },
  {
    id: 'bg-sync',
    name: 'Background Sync',
    description: 'Defer requests until the device is back online.',
    category: 'Background & lifecycle',
    check: () => supported('SyncManager' in window),
  },
  {
    id: 'bg-fetch',
    name: 'Background Fetch',
    description: 'Download large resources while the page is closed.',
    category: 'Background & lifecycle',
    check: () => 'unknown',
    refine: async (reg) => supported(reg != null && 'backgroundFetch' in reg),
  },
  {
    id: 'periodic-sync',
    name: 'Periodic Background Sync',
    description: 'Periodically refresh content in the background.',
    category: 'Background & lifecycle',
    check: () => 'unknown',
    refine: async (reg) => supported(reg != null && 'periodicSync' in reg),
  },
  {
    id: 'page-lifecycle',
    name: 'Page Lifecycle',
    description: '`freeze` / `resume` events when the browser hibernates a tab.',
    category: 'Background & lifecycle',
    check: () => supported('onfreeze' in document),
  },

  // ──── Storage & files ───────────────────────────────────────
  {
    id: 'indexeddb',
    name: 'IndexedDB',
    description: 'Asynchronous client-side database.',
    category: 'Storage & files',
    check: () => supported('indexedDB' in window),
  },
  {
    id: 'cache-storage',
    name: 'Cache Storage',
    description: 'Programmatic HTTP cache for the SW.',
    category: 'Storage & files',
    check: () => supported('caches' in window),
  },
  {
    id: 'storage-quota',
    name: 'Storage estimate',
    description: 'Read how much storage you\'re using.',
    category: 'Storage & files',
    check: () => supported(typeof navigator.storage?.estimate === 'function'),
  },
  {
    id: 'persistent-storage',
    name: 'Persistent storage',
    description: 'Ask the browser not to evict your data.',
    category: 'Storage & files',
    check: () => supported(typeof navigator.storage?.persist === 'function'),
  },
  {
    id: 'fs-access',
    name: 'File System Access',
    description: 'Read and write user-picked files with persistent handles.',
    category: 'Storage & files',
    check: () => supported('showOpenFilePicker' in window),
  },
  {
    id: 'opfs',
    name: 'Origin Private File System',
    description: 'Private sandboxed filesystem, no permission prompts.',
    category: 'Storage & files',
    check: () => supported(typeof navigator.storage?.getDirectory === 'function'),
  },

  // ──── Networking ─────────────────────────────────────────────
  {
    id: 'fetch',
    name: 'Fetch',
    description: 'Modern HTTP client.',
    category: 'Networking',
    check: () => supported('fetch' in window),
  },
  {
    id: 'websocket',
    name: 'WebSocket',
    description: 'Full-duplex socket connections.',
    category: 'Networking',
    check: () => supported('WebSocket' in window),
  },
  {
    id: 'webtransport',
    name: 'WebTransport',
    description: 'HTTP/3-based streams and datagrams.',
    category: 'Networking',
    check: () => supported('WebTransport' in window),
  },
  {
    id: 'network-info',
    name: 'Network Information',
    description: 'Read the connection type and effective bandwidth.',
    category: 'Networking',
    check: () => supported('connection' in navigator),
  },
  {
    id: 'beacon',
    name: 'Beacon',
    description: 'Send analytics during unload.',
    category: 'Networking',
    check: () => supported('sendBeacon' in navigator),
  },

  // ──── Hardware ───────────────────────────────────────────────
  {
    id: 'bluetooth',
    name: 'Web Bluetooth',
    description: 'Talk to BLE devices.',
    category: 'Hardware',
    check: () => supported('bluetooth' in navigator),
  },
  {
    id: 'usb',
    name: 'WebUSB',
    description: 'Talk to USB devices.',
    category: 'Hardware',
    check: () => supported('usb' in navigator),
  },
  {
    id: 'serial',
    name: 'Web Serial',
    description: 'Talk to serial / UART devices.',
    category: 'Hardware',
    check: () => supported('serial' in navigator),
  },
  {
    id: 'hid',
    name: 'WebHID',
    description: 'Talk to keyboards, gamepads, and other HID devices.',
    category: 'Hardware',
    check: () => supported('hid' in navigator),
  },
  {
    id: 'nfc',
    name: 'Web NFC',
    description: 'Read and write NFC tags.',
    category: 'Hardware',
    check: () => supported('NDEFReader' in window),
  },

  // ──── Sensors ────────────────────────────────────────────────
  {
    id: 'geolocation',
    name: 'Geolocation',
    description: 'Read the device location.',
    category: 'Sensors',
    check: () => supported('geolocation' in navigator),
  },
  {
    id: 'motion',
    name: 'Device Motion',
    description: 'Accelerometer events.',
    category: 'Sensors',
    check: () => supported('DeviceMotionEvent' in window),
  },
  {
    id: 'orientation',
    name: 'Device Orientation',
    description: 'Gyroscope-derived rotation events.',
    category: 'Sensors',
    check: () => supported('DeviceOrientationEvent' in window),
  },
  {
    id: 'ambient-light',
    name: 'Ambient Light Sensor',
    description: 'Read the ambient brightness in lux.',
    category: 'Sensors',
    check: () => supported('AmbientLightSensor' in window),
  },
  {
    id: 'battery',
    name: 'Battery Status',
    description: 'Read the device battery level.',
    category: 'Sensors',
    check: () =>
      typeof (navigator as Navigator & { getBattery?: unknown }).getBattery === 'function'
        ? 'supported'
        : 'unsupported',
  },

  // ──── Media ──────────────────────────────────────────────────
  {
    id: 'getusermedia',
    name: 'getUserMedia',
    description: 'Capture camera and microphone.',
    category: 'Media',
    check: () => supported(typeof navigator.mediaDevices?.getUserMedia === 'function'),
  },
  {
    id: 'screen-capture',
    name: 'Screen Capture',
    description: 'Capture the screen or a window.',
    category: 'Media',
    check: () => supported(typeof navigator.mediaDevices?.getDisplayMedia === 'function'),
  },
  {
    id: 'media-recorder',
    name: 'Media Recorder',
    description: 'Record streams to webm / mp4.',
    category: 'Media',
    check: () => supported('MediaRecorder' in window),
  },
  {
    id: 'webrtc',
    name: 'WebRTC',
    description: 'Peer-to-peer audio, video, and data.',
    category: 'Media',
    check: () => supported('RTCPeerConnection' in window),
  },
  {
    id: 'pip',
    name: 'Picture-in-Picture',
    description: 'Detach a video into a floating window.',
    category: 'Media',
    check: () => supported('pictureInPictureEnabled' in document),
  },
  {
    id: 'webcodecs',
    name: 'WebCodecs',
    description: 'Low-level video/audio encode and decode.',
    category: 'Media',
    check: () => supported('VideoDecoder' in window),
  },

  // ──── Input & UX ─────────────────────────────────────────────
  {
    id: 'web-share',
    name: 'Web Share',
    description: 'Trigger the OS share sheet.',
    category: 'Input & UX',
    check: () => supported(typeof navigator.share === 'function'),
  },
  {
    id: 'clipboard',
    name: 'Async Clipboard',
    description: 'Read and write the clipboard, including images.',
    category: 'Input & UX',
    check: () => supported('clipboard' in navigator),
  },
  {
    id: 'gamepad',
    name: 'Gamepad',
    description: 'Read controller input.',
    category: 'Input & UX',
    check: () => supported('getGamepads' in navigator),
  },
  {
    id: 'speech',
    name: 'Speech (STT & TTS)',
    description: 'Browser speech-to-text and text-to-speech.',
    category: 'Input & UX',
    // Two independent APIs under one capability: supported only when BOTH are
    // present, partial when just one is (e.g. Firefox ships speechSynthesis but
    // not SpeechRecognition), unsupported when neither.
    check: () => {
      const stt = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
      const tts = 'speechSynthesis' in window;
      return stt && tts ? 'supported' : stt || tts ? 'partial' : 'unsupported';
    },
  },
  {
    id: 'contacts',
    name: 'Contact Picker',
    description: 'Let the user pick contacts.',
    category: 'Input & UX',
    check: () =>
      supported(typeof (navigator as Navigator & { contacts?: { select?: unknown } }).contacts?.select === 'function'),
  },
  {
    id: 'eyedropper',
    name: 'EyeDropper',
    description: 'OS-level color picker.',
    category: 'Input & UX',
    check: () => supported('EyeDropper' in window),
  },

  // ──── Identity & payments ───────────────────────────────────
  {
    id: 'webauthn',
    name: 'WebAuthn / Passkeys',
    description: 'Hardware-backed credentials and passkeys.',
    category: 'Identity & payments',
    check: () => supported('PublicKeyCredential' in window),
  },
  {
    id: 'webotp',
    name: 'WebOTP',
    description: 'Auto-fill SMS one-time codes (Android only).',
    category: 'Identity & payments',
    check: () => supported('OTPCredential' in window),
  },
  {
    id: 'cred-mgmt',
    name: 'Credential Management',
    description: 'Programmatic credential storage.',
    category: 'Identity & payments',
    check: () => supported('credentials' in navigator),
  },
  {
    id: 'payment-request',
    name: 'Payment Request',
    description: 'Browser-mediated payments.',
    category: 'Identity & payments',
    check: () => supported('PaymentRequest' in window),
  },

  // ──── Graphics & compute ────────────────────────────────────
  {
    id: 'webgl',
    name: 'WebGL',
    description: 'GPU-accelerated 2D/3D graphics. Partial = WebGL 1 only; supported = WebGL 2 (GLES 3.0).',
    category: 'Graphics & compute',
    // Combined WebGL 1 + 2: supported when WebGL 2 is available, partial when
    // only the v1 context can be created, unsupported when neither works.
    check: () => {
      try {
        const c = document.createElement('canvas');
        if (c.getContext('webgl2')) return 'supported';
        if (c.getContext('webgl')) return 'partial';
        return 'unsupported';
      } catch { return 'unsupported'; }
    },
  },
  {
    id: 'webgpu',
    name: 'WebGPU',
    description: 'Modern GPU API for compute and rendering.',
    category: 'Graphics & compute',
    check: () => supported('gpu' in navigator),
  },
  {
    id: 'offscreen',
    name: 'OffscreenCanvas',
    description: 'Render canvas from a Worker.',
    category: 'Graphics & compute',
    check: () => supported('OffscreenCanvas' in window),
  },
  {
    id: 'wasm',
    name: 'WebAssembly',
    description: 'Near-native compute in the browser.',
    category: 'Graphics & compute',
    check: () => supported('WebAssembly' in window),
  },
  {
    id: 'workers',
    name: 'Web Workers',
    description: 'Run scripts off the main thread.',
    category: 'Graphics & compute',
    check: () => supported('Worker' in window),
  },
  {
    id: 'sab',
    name: 'SharedArrayBuffer',
    description: 'Multi-threaded memory sharing (requires cross-origin isolation).',
    category: 'Graphics & compute',
    check: () =>
      'SharedArrayBuffer' in window
        ? (window.crossOriginIsolated ? 'supported' : 'partial')
        : 'unsupported',
  },
];
