import { v1 } from "@google-cloud/vision";
import { config } from "../config";

class GoogleVisionService {
  private client: v1.ImageAnnotatorClient;

  constructor() {
    this.client = new v1.ImageAnnotatorClient({
      credentials: config.GOOGLE_CREDENTIALS,
    });
  }

  async detectText(imageBuffer: Buffer): Promise<any[]> {
    const [result] = await this.client.textDetection(imageBuffer);
    return result.textAnnotations || [];
  }
}

export const googleVisionService = new GoogleVisionService();
