import { google, sheets_v4 } from "googleapis";
import { JWT } from "google-auth-library";
import { config } from "../config";

/**
 * Service for interacting with Google Sheets.
 */
class SheetsService {
  private sheets: sheets_v4.Sheets;

  /**
   * Initializes the SheetsService by authenticating with Google.
   * @throws Will throw an error if GOOGLE_CREDENTIALS_JSON is not defined or invalid.
   */
  constructor() {
    const scopes = ["https://www.googleapis.com/auth/spreadsheets"];
    const auth = new JWT({
      email: config.GOOGLE_CREDENTIALS.client_email,
      key: config.GOOGLE_CREDENTIALS.private_key,
      scopes,
    });
    this.sheets = google.sheets({ version: "v4", auth });
  }

  /**
   * Reads data from a specified range in a Google Sheet.
   * @param spreadsheetId The ID of the spreadsheet.
   * @param range The A1 notation of the range to retrieve.
   * @returns A 2D array of the data, or null if no data is found.
   */
  public async readSheet(
    spreadsheetId: string,
    range: string
  ): Promise<any[][] | null> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    return response.data.values || null;
  }

  /**
   * Writes data to a specified range in a Google Sheet.
   * This will overwrite any existing data in the range.
   * @param spreadsheetId The ID of the spreadsheet.
   * @param range The A1 notation of the range to write to.
   * @param values A 2D array of data to write.
   * @returns The number of cells updated.
   */
  public async writeSheet(
    spreadsheetId: string,
    range: string,
    values: any[][]
  ): Promise<number> {
    const response = await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values,
      },
    });
    return response.data.updatedCells || 0;
  }

  /**
   * Appends data to a sheet. This is useful for logging.
   * Google Sheets will find the first empty row in the table and add the data there.
   * @param spreadsheetId The ID of the spreadsheet.
   * @param range The A1 notation of the table to append to (e.g., 'Logs!A1').
   * @param values A 2D array of data to append.
   * @returns The number of cells appended.
   */
  public async appendSheet(
    spreadsheetId: string,
    range: string,
    values: any[][]
  ): Promise<number> {
    const response = await this.sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values,
      },
    });
    return response.data.updates?.updatedCells || 0;
  }
}

export const sheetsService = new SheetsService();

export interface WarPlanData {
  assignments: any[][] | null;
  prefights: any[][] | null;
}

export async function getWarPlanData(
  battlegroup: number
): Promise<WarPlanData> {
  const sheetName = `AW BG${battlegroup}`;
  const planRange = `'${sheetName}'!FB3:FF52`;
  const prefightRange = `'${sheetName}'!GD3:GF52`;

  const assignments = await sheetsService.readSheet(
    config.MCOC_SHEET_ID,
    planRange
  );
  const prefights = await sheetsService.readSheet(
    config.MCOC_SHEET_ID,
    prefightRange
  );

  return { assignments, prefights };
}
