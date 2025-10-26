import sharp from "sharp";

// ---- avatar ----

export async function createCircularAvatar(opts: {
  image: Buffer;
  diameter: number;
  ringWidth: number;
  ringStart: string;
  ringEnd: string;
}): Promise<Buffer> {
  const { image, diameter, ringWidth, ringStart, ringEnd } = opts;
  const padding = 10; // Px padding to allow glow to render
  const canvasSize = diameter + padding * 2;
  const r = diameter / 2;
  const cx = r + padding;
  const cy = r + padding;
  const innerR = r - ringWidth / 2;

  const avatar = await sharp(image)
    .resize(diameter, diameter, { fit: "cover" })
    .toBuffer();

  const mask = Buffer.from(`
    <svg width="${diameter}" height="${diameter}"
      xmlns="http://www.w3.org/2000/svg">
      <circle cx="${r}" cy="${r}" r="${r}" fill="#fff"/>
    </svg>
  `);

  const ring = Buffer.from(`
    <svg width="${canvasSize}" height="${canvasSize}"
      xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ring" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${ringStart}"/>
          <stop offset="100%" stop-color="${ringEnd}"/>
        </linearGradient>
        <filter id="avatarGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="3.5" flood-color="${ringStart}" flood-opacity="0.65" />
        </filter>
      </defs>
      <g filter="url(#avatarGlow)">
        <circle cx="${cx}" cy="${cy}" r="${innerR}"
          fill="none" stroke="url(#ring)" stroke-width="${ringWidth}"/>
        <circle cx="${cx}" cy="${cy}" r="${innerR}"
          fill="none" stroke="#ffffff" stroke-width="${
            ringWidth * 0.25
          }" stroke-opacity="0.4"/>
      </g>
    </svg>
  `);

  const masked = await sharp(avatar)
    .composite([{ input: mask, blend: "dest-in" }])
    .toBuffer();

  return sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: masked, top: padding, left: padding },
      { input: ring, top: 0, left: 0 },
    ])
    .png()
    .toBuffer();
}
