import path from 'path';
import fs from 'fs/promises';
import { getStyledImagePath } from './imageStyleService';
import logger from './loggerService';

async function runTest() {
    logger.info('Starting image style test...');

    const testImageUrl = 'https://storage.googleapis.com/champion-images/feature-showcase/tags_dracula.png';
    const outputDir = path.join(process.cwd(), 'temp', 'test-output');

    try {
        // Ensure output directory exists
        await fs.mkdir(outputDir, { recursive: true });

        const styledImagePath = await getStyledImagePath(testImageUrl);

        if (styledImagePath) {
            // To see the output, copy the generated file from the cache to a known test-output folder
            const finalFileName = `test-output-${Date.now()}.png`;
            const finalOutputPath = path.join(outputDir, finalFileName);
            await fs.copyFile(styledImagePath, finalOutputPath);

            logger.info(`Successfully created styled image at: ${finalOutputPath}`);
            logger.info(`You can view the result by opening the file on your local machine.`);
        } else {
            logger.error('getStyledImagePath returned null. Styling failed.');
        }
    } catch (error) {
        logger.error({ err: error }, 'An error occurred during the image style test.');
    }
}

runTest();
