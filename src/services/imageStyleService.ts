import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { downloadImage } from '../commands/roster/ocr/imageUtils';
import logger from './loggerService';

const CACHE_DIR = path.join(process.cwd(), 'temp', 'styled-images');

// Ensure the cache directory exists on startup.
fs.mkdir(CACHE_DIR, { recursive: true }).catch(err => {
    logger.error({ err }, 'Failed to create image style cache directory');
});

async function styleImage(imageBuffer: Buffer): Promise<Buffer> {
    const metadata = await sharp(imageBuffer).metadata();
    const { width, height } = metadata;
    if (!width || !height) throw new Error('Could not get image metadata');

    // --- Configuration ---
    const cornerRadius = 20;
    const borderSize = 4;
    const glowSigma = 15; // For outer glow
    const innerGlowWidth = 25; // How far the inner glow should fade
    const innerGlowSigma = 10; // How soft the inner glow fade is

    const gradientId = 'neon-grad';
    const color1 = '#F72585'; // Hot Pink
    const color2 = '#4CC9F0'; // Bright Cyan

    // --- Dimensions ---
    const imageWithBorderSize = { width: width + borderSize * 2, height: height + borderSize * 2 };
    const finalWidth = imageWithBorderSize.width + glowSigma * 2;
    const finalHeight = imageWithBorderSize.height + glowSigma * 2;

    // --- Layer 1: Rounded Image Content ---
    const imageMask = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect x="0" y="0" width="${width}" height="${height}" rx="${cornerRadius}" ry="${cornerRadius}"/></svg>`
    );
    const roundedImage = await sharp(imageBuffer)
        .ensureAlpha()
        .composite([{ input: imageMask, blend: 'dest-in' }])
        .png()
        .toBuffer();

    // --- Layer 2: Gradient Border Shape ---
    const borderOuterRadius = cornerRadius + borderSize;
    const borderSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${imageWithBorderSize.width}" height="${imageWithBorderSize.height}"><defs><linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${color1}" /><stop offset="100%" stop-color="${color2}" /></linearGradient></defs><rect x="0" y="0" width="${imageWithBorderSize.width}" height="${imageWithBorderSize.height}" rx="${borderOuterRadius}" ry="${borderOuterRadius}" fill="url(#${gradientId})" /></svg>`;
    const gradientBorder = await sharp(Buffer.from(borderSvg)).png().toBuffer();

    // --- Layer 3: Outer Glow Layer (blurred version of the border) ---
    const outerGlowLayer = await sharp(gradientBorder)
        .blur(glowSigma)
        .modulate({ brightness: 1.2, saturation: 1.2 }) // Make the glow brighter
        .png()
        .toBuffer();

    // --- Layer 4: Inner Glow Layer ---
    const gradientFill = sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${color1}" /><stop offset="100%" stop-color="${color2}" /></linearGradient></defs><rect x="0" y="0" width="${width}" height="${height}" fill="url(#${gradientId})"/></svg>`));
    const innerRx = cornerRadius > innerGlowWidth ? cornerRadius - innerGlowWidth : 0;
    const frameMask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect x="0" y="0" width="${width}" height="${height}" rx="${cornerRadius}" ry="${cornerRadius}" fill="white"/><rect x="${innerGlowWidth}" y="${innerGlowWidth}" width="${width - innerGlowWidth * 2}" height="${height - innerGlowWidth * 2}" rx="${innerRx}" ry="${innerRx}" fill="black" /></svg>`);
    const innerGlowLayer = await gradientFill.composite([{ input: frameMask, blend: 'in' }]).blur(innerGlowSigma).png().toBuffer();

    // --- Final Assembly ---
    const outerGlowMeta = await sharp(outerGlowLayer).metadata();
    const outerGlowTop = Math.round((finalHeight - outerGlowMeta.height!) / 2);
    const outerGlowLeft = Math.round((finalWidth - outerGlowMeta.width!) / 2);

    const borderTop = Math.round((finalHeight - imageWithBorderSize.height) / 2);
    const borderLeft = Math.round((finalWidth - imageWithBorderSize.width) / 2);

    const imageTop = Math.round((finalHeight - height) / 2);
    const imageLeft = Math.round((finalWidth - width) / 2);

    return sharp({ create: { width: finalWidth, height: finalHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([
            { input: outerGlowLayer, top: outerGlowTop, left: outerGlowLeft },
            { input: gradientBorder, top: borderTop, left: borderLeft },
            { input: roundedImage, top: imageTop, left: imageLeft },
            { input: innerGlowLayer, top: imageTop, left: imageLeft }
        ])
        .png()
        .toBuffer();
}

export async function getStyledImagePath(imageUrl: string): Promise<string | null> {
    // The style is now static, so we only need to hash the URL.
    const hash = crypto.createHash('md5').update(imageUrl).digest('hex');
    const fileExtension = path.extname(new URL(imageUrl).pathname) || '.png';
    const cachedImagePath = path.join(CACHE_DIR, `${hash}${fileExtension}`);

    try {
        await fs.access(cachedImagePath);
        return cachedImagePath; // Cache hit
    } catch {
        // Cache miss
        try {
            const imageBuffer = await downloadImage(imageUrl);
            const styledBuffer = await styleImage(imageBuffer);
            await fs.writeFile(cachedImagePath, styledBuffer);
            return cachedImagePath;
        } catch (error) {
            logger.error({ err: error, imageUrl }, 'Failed to download or style image');
            return null;
        }
    }
}
