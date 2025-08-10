import { google, sheets_v4 } from "googleapis";
import { JWT } from "google-auth-library";
import { config } from "../config";

// Type for a row in the Schedules sheet
export interface ScheduleRow {
  id: string;
  name: string; // user-defined label for the schedule
  frequency: ScheduleFrequency;
  time: string;
  command: string;
  message?: string;
  target_channel_id?: string;
  target_user_id?: string;
  is_active: boolean;
  created_at: string;
  day?: string;
  interval?: string;
  unit?: "days" | "weeks";
  cron_expression?: string;
}

export enum ScheduleFrequency {
  DAILY = "daily",
  WEEKLY = "weekly",
  MONTHLY = "monthly",
  EVERY = "every",
  CUSTOM = "custom",
}

const MCOC_SHEET_NAME = "Schedules";
// Now 14 columns: id, name, frequency, time, command, message, target_channel_id, target_user_id, is_active, created_at, day, interval, unit, cron_expression
const MCOC_RANGE = `${MCOC_SHEET_NAME}!A:N`;

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
    if (!config.GOOGLE_CREDENTIALS_JSON) {
      throw new Error(
        "GOOGLE_CREDENTIALS_JSON is not defined in the .env file."
      );
    }
    let credentials;
    try {
      // Decode the Base64 string back to JSON string
      const decodedCredentialsString = Buffer.from(
        config.GOOGLE_CREDENTIALS_JSON,
        "base64"
      ).toString("utf8");
      // Parse the decoded JSON string
      credentials = JSON.parse(decodedCredentialsString);
    } catch (error) {
      console.error(
        `Error loading/parsing Google credentials from environment variable:`,
        error
      );
      throw new Error(
        `Failed to load Google credentials. Check Base64 encoding in GitHub Secrets.`
      );
    }
    const scopes = ["https://www.googleapis.com/auth/spreadsheets"];
    const auth = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
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

/**
 * Converts a Google Sheets time fraction or number to HH:mm format.
 * Supports comma-separated times.
 * @param value - The time value from Google Sheets.
 * @returns The formatted time string(s).
 */
function toReadableTimeFormat(value: string): string {
  if (!value) return value;
  if (/^\d{1,2}:\d{2}$/.test(value)) return value; // already HH:mm
  // Support comma-separated times
  return value
    .split(",")
    .map((t) => {
      const trimmed = t.trim();
      const num = parseFloat(trimmed);
      if (!isNaN(num)) {
        const totalMinutes = Math.round(num * 24 * 60);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${hours.toString().padStart(2, "0")}:${minutes
          .toString()
          .padStart(2, "0")}`;
      }
      return trimmed;
    })
    .join(",");
}

export async function getSchedules(): Promise<ScheduleRow[]> {
  /**
   * Retrieves all schedules from the Google Sheet.
   * @returns A promise that resolves to an array of ScheduleRow objects.
   */
  const rows =
    (await sheetsService.readSheet(
      config.SCHEDULE_SHEET_ID,
      MCOC_RANGE
    )) || [];
  // Remove header if present
  if (rows.length && rows[0][0] === "id") {
    rows.shift();
  }
  return rows.map(
    (row): ScheduleRow => ({
      id: row[0],
      name: row[1],
      frequency: row[2],
      time: row[3],
      command: row[4],
      message: row[5],
      target_channel_id: row[6],
      target_user_id: row[7],
      is_active: row[8] === "TRUE" || row[8] === true,
      created_at: row[9],
      day: row[10],
      interval: row[11],
      unit: row[12],
      cron_expression: row[13],
    })
  );
}

export async function addSchedule(
  /**
   * Adds a new schedule to the Google Sheet.
   * @param schedule - The schedule object to add.
   */
  schedule: Omit<ScheduleRow, "id" | "created_at">
): Promise<void> {
  const now = new Date().toISOString();
  const id = `${Date.now()}`;
  const row = [
    id,
    schedule.name,
    schedule.frequency,
    toReadableTimeFormat(schedule.time),
    schedule.command,
    schedule.message || "",
    schedule.target_channel_id || "",
    schedule.target_user_id || "",
    schedule.is_active ? "TRUE" : "FALSE",
    now,
    schedule.day || "",
    schedule.interval || "",
    schedule.unit || "",
    schedule.cron_expression || "",
  ];
  await sheetsService.appendSheet(
    config.SCHEDULE_SHEET_ID,
    MCOC_SHEET_NAME,
    [row]
  );
}

export async function updateSchedule(
  /**
   * Updates an existing schedule in the Google Sheet.
   * @param id - The ID of the schedule to update.
   * @param updates - The partial schedule object with updates.
   * @throws Will throw an error if the schedule is not found.
   */
  id: string,
  updates: Partial<ScheduleRow>
): Promise<void> {
  const schedules = await getSchedules();
  const idx = schedules.findIndex((s) => s.id === id);
  if (idx === -1) throw new Error("Schedule not found");
  const updated = { ...schedules[idx], ...updates };
  const row = [
    updated.id,
    updated.name,
    updated.frequency,
    toReadableTimeFormat(updated.time),
    updated.command,
    updated.message || "",
    updated.target_channel_id || "",
    updated.target_user_id || "",
    updated.is_active ? "TRUE" : "FALSE",
    updated.created_at,
    updated.day || "",
    updated.interval || "",
    updated.unit || "",
    updated.cron_expression || "",
  ];
  const writeRange = `${MCOC_SHEET_NAME}!A${idx + 1}:N${idx + 1}`;
  await sheetsService.writeSheet(config.SCHEDULE_SHEET_ID, writeRange, [row]);
}

export async function deleteSchedule(id: string): Promise<void> {
  /**
   * Deletes (marks as inactive) a schedule in the Google Sheet.
   * @param id - The ID of the schedule to delete.
   */
  await updateSchedule(id, { is_active: false });
}

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