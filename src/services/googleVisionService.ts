import { v1 } from "@google-cloud/vision";

class GoogleVisionService {
  private client: v1.ImageAnnotatorClient;

  constructor(credentials: any) {
    this.client = new v1.ImageAnnotatorClient({
      credentials,
    });
  }

  async detectText(imageBuffer: Buffer): Promise<any[]> {
    const [result] = await this.client.textDetection(imageBuffer);
    return result.textAnnotations || [];
  }
}

let googleVisionServiceInstance: GoogleVisionService | null = null;

export async function getGoogleVisionService(): Promise<GoogleVisionService> {
    if (!googleVisionServiceInstance) {
        const { config } = await import('../config.js');
        googleVisionServiceInstance = new GoogleVisionService(config.GOOGLE_CREDENTIALS);
    }
    return googleVisionServiceInstance;
}

