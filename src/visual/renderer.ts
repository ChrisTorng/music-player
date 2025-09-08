export function mixToMono(buffer: AudioBuffer): Float32Array {
  const { numberOfChannels, length } = buffer;
  if (numberOfChannels === 1) return buffer.getChannelData(0).slice();
  const mono = new Float32Array(length);
  for (let ch = 0; ch < numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) mono[i] += data[i];
  }
  const inv = 1 / numberOfChannels;
  for (let i = 0; i < length; i++) mono[i] *= inv;
  return mono;
}

export function renderWaveformPng(buffer: AudioBuffer, width = 4000, height = 100): string {
  const mono = mixToMono(buffer);
  let peak = 0;
  for (let i = 0; i < mono.length; i++) {
    const v = Math.abs(mono[i]);
    if (v > peak) peak = v;
  }
  const norm = peak > 0 ? 1 / peak : 1;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  // Black background per spec
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  const midY = height / 2;
  const samplesPerPixel = mono.length / width;
  ctx.beginPath();
  for (let x = 0; x < width; x++) {
    const start = Math.floor(x * samplesPerPixel);
    const end = Math.min(mono.length, Math.floor((x + 1) * samplesPerPixel));
    let min = 1, max = -1;
    for (let i = start; i < end; i++) {
      const v = mono[i] * norm;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const y1 = midY - (max * midY);
    const y2 = midY - (min * midY);
    ctx.moveTo(x + 0.5, y1);
    ctx.lineTo(x + 0.5, y2);
  }
  ctx.stroke();
  return canvas.toDataURL('image/png');
}

// Internal radix-2 FFT
function fft(real: Float32Array, imag: Float32Array): void {
  const n = real.length;
  let j = 0;
  for (let i = 0; i < n; i++) {
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
    let m = n >> 1;
    while (m >= 1 && j >= m) { j -= m; m >>= 1; }
    j += m;
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const theta = -2 * Math.PI / size;
    const wpr = Math.cos(theta);
    const wpi = Math.sin(theta);
    for (let i = 0; i < n; i += size) {
      let wr = 1, wi = 0;
      for (let k = 0; k < half; k++) {
        const j1 = i + k;
        const j2 = j1 + half;
        const tr = wr * real[j2] - wi * imag[j2];
        const ti = wr * imag[j2] + wi * real[j2];
        real[j2] = real[j1] - tr;
        imag[j2] = imag[j1] - ti;
        real[j1] += tr;
        imag[j1] += ti;
        const tmp = wr;
        wr = tmp * wpr - wi * wpi;
        wi = tmp * wpi + wi * wpr;
      }
    }
  }
}

export function renderSpectrogramPng(buffer: AudioBuffer, width = 4000, height = 200): string {
  const mono = mixToMono(buffer);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(width, height);

  const winSize = 1024;
  const hop = Math.max(1, Math.floor((mono.length - winSize) / Math.max(1, width - 1)));
  const windowFunc = new Float32Array(winSize);
  for (let i = 0; i < winSize; i++) windowFunc[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (winSize - 1)));
  // First pass: compute per-column dB and global max. Use perceptual power mapping (approx. log).
  const specDb: number[][] = Array.from({ length: width }, () => new Array<number>(height));
  let globalMax = -Infinity;
  for (let x = 0; x < width; x++) {
    const center = Math.min(mono.length - winSize, Math.floor(x * hop));
    const segment = new Float32Array(winSize);
    for (let i = 0; i < winSize; i++) segment[i] = (mono[center + i] || 0) * windowFunc[i];
    const real = segment.slice();
    const imag = new Float32Array(winSize);
    fft(real, imag);
    const mags = new Float32Array(winSize / 2);
    for (let k = 0; k < mags.length; k++) {
      const re = real[k], im = imag[k];
      mags[k] = Math.sqrt(re * re + im * im) + 1e-12;
    }
    // yCanvas: 0=top (high freq), height-1=bottom (low freq)
    for (let yCanvas = 0; yCanvas < height; yCanvas++) {
      const fracCanvas = 1 - (yCanvas / (height - 1)); // emphasize highs at top
      const idx = Math.min(mags.length - 1, Math.floor((fracCanvas * fracCanvas) * (mags.length - 1)));
      const db = 20 * Math.log10(mags[idx]);
      specDb[x][yCanvas] = db;
      if (db > globalMax) globalMax = db;
    }
  }
  // Dynamic range and brightness
  // Use a wider range to avoid clipping quiet regions to pure black.
  const dynamicRangeDb = 100; // slightly narrower to brighten overall
  const minDb = Math.max(globalMax - dynamicRangeDb, -120);
  const maxDb = globalMax;

  const stops = [
    { t: 0.0, c: [0, 0, 3] },
    { t: 0.25, c: [30, 16, 68] },
    { t: 0.5, c: [83, 18, 123] },
    { t: 0.75, c: [187, 55, 84] },
    { t: 1.0, c: [251, 252, 73] },
  ];
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const grad = (v: number): [number, number, number] => {
    // Clamp before gamma to avoid NaN for negative inputs
    const vClamped = Math.max(0, Math.min(1, v));
    // Apply gentle gamma and floor to brighten low-energy regions without washing out
    const gamma = 0.4; // stronger brightening of shadows
    const floor = 0; // higher minimum visibility
    let t = Math.pow(vClamped, gamma);
    t = floor + (1 - floor) * t;
    // Boost highlights only (top range), keeping mids/shadows intact
    const pivot = 0.85;   // start boosting top 15%
    const strength = 0.6; // +60% headroom for highlights
    if (t > pivot) {
      t = pivot + (t - pivot) * (1 + strength);
    }
    t = Math.min(1, Math.max(0, t));
    let i = 0;
    while (i < stops.length - 1 && t > stops[i + 1].t) i++;
    const s0 = stops[i], s1 = stops[Math.min(i + 1, stops.length - 1)];
    const u = (t - s0.t) / Math.max(1e-6, (s1.t - s0.t));
    return [
      Math.round(lerp(s0.c[0], s1.c[0], u)),
      Math.round(lerp(s0.c[1], s1.c[1], u)),
      Math.round(lerp(s0.c[2], s1.c[2], u)),
    ];
  };

  // Paint with low freq at bottom (y=height-1)
  let p = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const db = specDb[x][y];
      const norm = (db - minDb) / Math.max(1e-6, (maxDb - minDb));
      const [r, g, b] = grad(norm);
      img.data[p++] = r;
      img.data[p++] = g;
      img.data[p++] = b;
      img.data[p++] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}
