// src/utils/fallbackImage.ts

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const hashString = (str: string) => {
  // FNV-1a (stable, fast)
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const hslToHex = (h: number, s: number, l: number) => {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const x = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(255 * x);
  };
  const toHex = (v: number) => v.toString(16).padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
};

const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const toDataUrl = (svg: string) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

export const buildFallbackSvgDataUrl = (name: string, w = 400, h = 300) => {
  const safeName = (name || "Item").trim();
  const key = safeName.toLowerCase();

  const hash = hashString(key);
  const hue = hash % 360;

  // "Food" vibe: warm, friendly saturation with readable text
  const bg = hslToHex(hue, 55, 92);         // light pastel
  const accent = hslToHex((hue + 20) % 360, 70, 55); // stronger accent
  const text = "#111827"; // slate-900-ish
  const subtext = "#374151"; // slate-700-ish

  const initial = escapeXml(safeName[0]?.toUpperCase() || "I");

  // Font sizes responsive to length
  const title = safeName.length > 22 ? safeName.slice(0, 22) + "…" : safeName;
  const titleSize = clamp(26 - Math.floor(safeName.length / 4), 16, 24);

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${bg}"/>
        <stop offset="100%" stop-color="#ffffff"/>
      </linearGradient>

      <!-- subtle pattern -->
      <pattern id="p" width="24" height="24" patternUnits="userSpaceOnUse">
        <circle cx="4" cy="4" r="2" fill="${accent}" opacity="0.10"/>
        <circle cx="20" cy="20" r="2" fill="${accent}" opacity="0.10"/>
      </pattern>
    </defs>

    <rect width="100%" height="100%" rx="24" ry="24" fill="url(#g)"/>
    <rect width="100%" height="100%" rx="24" ry="24" fill="url(#p)"/>

    <!-- center badge -->
    <g transform="translate(${w / 2}, ${h / 2 - 14})">
      <circle r="54" fill="${accent}" opacity="0.18"/>
      <circle r="46" fill="${accent}" opacity="0.25"/>
      <circle r="38" fill="${accent}" opacity="0.35"/>
      <text x="0" y="14" text-anchor="middle"
        font-family="Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial"
        font-size="44" font-weight="800" fill="${text}">
        ${initial}
      </text>
    </g>

    <!-- title -->
    <text x="${w / 2}" y="${h - 46}" text-anchor="middle"
      font-family="Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial"
      font-size="${titleSize}" font-weight="800" fill="${text}">
      ${escapeXml(title)}
    </text>

    <!-- subtitle -->
    <text x="${w / 2}" y="${h - 22}" text-anchor="middle"
      font-family="Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial"
      font-size="14" font-weight="600" fill="${subtext}" opacity="0.85">
      Photo not available
    </text>
  </svg>`.trim();

  return toDataUrl(svg);
};
