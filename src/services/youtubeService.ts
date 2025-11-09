import { google } from 'googleapis';
import fs from 'fs';
import loggerService from './loggerService';

/**
 * @fileoverview
 * This service handles all interactions with the YouTube Data API,
 * specifically for uploading videos to a designated channel.
 *
 * @see https://developers.google.com/youtube/v3/guides/uploading_a_video
 *
 * @requires Google Cloud Project with YouTube Data API v3 enabled.
 * @requires OAuth 2.0 Credentials (client_id, client_secret).
 * @requires An OAuth 2.0 Refresh Token obtained from an initial authorization flow.
 */

// --- CONFIGURATION ---
// TODO: Replace with your actual OAuth 2.0 credentials from the Google Cloud Console.
// SEE: https://console.cloud.google.com/apis/credentials
const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID || 'YOUR_CLIENT_ID';
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET || 'YOUR_CLIENT_SECRET';
const REDIRECT_URI = 'https://developers.google.com/oauthplayground';

// TODO: This is a critical piece of information that you must obtain once.
// It allows the application to generate new access tokens without user interaction.
// 1. Go to https://developers.google.com/oauthplayground
// 2. In the top-right settings gear, check "Use your own OAuth credentials" and provide your CLIENT_ID and CLIENT_SECRET.
// 3. On the left, find "YouTube Data API v3" and select the scope: "https://www.googleapis.com/auth/youtube.upload"
// 4. Click "Authorize APIs".
// 5. Exchange authorization code for tokens.
// 6. Copy the "Refresh token" and paste it here or in your .env file.
const REFRESH_TOKEN = process.env.YOUTUBE_REFRESH_TOKEN || 'YOUR_REFRESH_TOKEN';

class YouTubeService {
  private oauth2Client;
  private youtube;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    );

    // Set the refresh token so we can get new access tokens
    this.oauth2Client.setCredentials({
      refresh_token: REFRESH_TOKEN,
    });

    this.youtube = google.youtube({
      version: 'v3',
      auth: this.oauth2Client,
    });

    this.testAuthentication();
  }

  private async testAuthentication() {
    if (REFRESH_TOKEN === 'YOUR_REFRESH_TOKEN') {
      loggerService.warn(
        'YouTubeService is not configured. Please provide credentials in .env or youtubeService.ts'
      );
      return;
    }
    try {
      // The getAccessToken method will automatically use the refresh token to get a new access token.
      const tokenInfo = await this.oauth2Client.getAccessToken();
      if (tokenInfo.token) {
        loggerService.info('Successfully authenticated with YouTube API.');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      loggerService.error({
        error: errorMessage,
        suggestion:
          'Ensure your YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, and YOUTUBE_REFRESH_TOKEN are correct.',
      }, 'Failed to authenticate with YouTube API.');
    }
  }

  /**
   * Uploads a video to the configured YouTube channel.
   * @param videoPath - The absolute local path to the video file.
   * @param title - The title of the video.
   * @param description - The description of the video.
   * @returns The ID of the uploaded YouTube video.
   */
  public async uploadVideo(
    videoPath: string,
    title: string,
    description: string,
    privacyStatus: 'private' | 'unlisted' | 'public' = 'private'
  ): Promise<string | null> {
    loggerService.info({ title, privacyStatus }, 'Starting YouTube video upload.');

    try {
      const response = await this.youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title,
            description,
            // TODO: Add tags if needed, e.g., ['mcoc', 'alliance-war', 'gaming']
            tags: [],
          },
          status: {
            privacyStatus,
          },
        },
        media: {
          body: fs.createReadStream(videoPath),
        },
      });

      const videoId = response.data.id;
      if (videoId) {
        loggerService.info({
          videoId,
          title,
        }, 'Successfully uploaded video to YouTube.');
        return videoId;
      } else {
        loggerService.error({
          response: response.data,
        }, 'YouTube API did not return a video ID.');
        return null;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      loggerService.error({
        error: errorMessage,
        title,
      }, 'Failed to upload video to YouTube.');
      return null;
    }
  }

  /**
   * Updates the privacy status of a YouTube video.
   * @param videoId - The ID of the YouTube video to update.
   * @param privacyStatus - The new privacy status.
   */
  public async updateVideoPrivacy(
    videoId: string,
    privacyStatus: 'private' | 'unlisted' | 'public'
  ): Promise<void> {
    loggerService.info({ videoId, privacyStatus }, 'Updating YouTube video privacy.');
    try {
      await this.youtube.videos.update({
        part: ['status'],
        requestBody: {
          id: videoId,
          status: { privacyStatus },
        },
      });
      loggerService.info({ videoId }, 'Successfully updated video privacy.');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      loggerService.error({
        error: errorMessage,
        videoId,
      }, 'Failed to update video privacy.');
    }
  }

  /**
   * Deletes a video from YouTube.
   * @param videoId - The ID of the YouTube video to delete.
   */
  public async deleteVideo(videoId: string): Promise<void> {
    loggerService.info({ videoId }, 'Deleting YouTube video.');
    try {
      await this.youtube.videos.delete({
        id: videoId,
      });
      loggerService.info({ videoId }, 'Successfully deleted video from YouTube.');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      loggerService.error({
        error: errorMessage,
        videoId,
      }, 'Failed to delete video from YouTube.');
    }
  }

  /**
   * Constructs the URL for the uploaded video.
   * @param videoId - The ID of the YouTube video.
   * @returns The full URL to the video.
   */
  public getVideoUrl(videoId: string): string {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }
}

export const youTubeService = new YouTubeService();