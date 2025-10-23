import { Storage } from "@google-cloud/storage";
import { config } from "../config";

class GcpStorageService {
  private storage: Storage;
  private bucketName: string;

  constructor() {
    this.storage = new Storage({
      credentials: {
        client_email: config.GOOGLE_CREDENTIALS.client_email,
        private_key: config.GOOGLE_CREDENTIALS.private_key,
      },
      projectId: config.GOOGLE_CREDENTIALS.project_id,
    });

    this.bucketName = process.env.GCS_BUCKET_NAME || "champion-images";
  }

  async uploadBuffer(
    buffer: Buffer,
    destinationPath: string
  ): Promise<string> {
    const file = this.storage.bucket(this.bucketName).file(destinationPath);
    await file.save(buffer);
    const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${destinationPath}`;
    return publicUrl;
  }
}

export const gcpStorageService = new GcpStorageService();
