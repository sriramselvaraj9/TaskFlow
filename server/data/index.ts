import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { type DatabaseSchema, getDefaultColumns, getInitialSeedData } from '../database/seed';

const DB_FILE_PATH = path.join(process.cwd(), 'server', 'database', 'db.json');
const TMP_DB_FILE_PATH = path.join(os.tmpdir(), 'taskflow_db.json');

declare global {
  // eslint-disable-next-line no-var
  var __taskflow_db__: DatabaseSchema | undefined;
}

function tryParseDb(filePath: string): DatabaseSchema | null {
  try {
    if (fs.existsSync(filePath)) {
      const fileData = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(fileData);
      if (parsed && Array.isArray(parsed.users) && parsed.passwords) {
        if (!parsed.otpTokens) parsed.otpTokens = {};
        if (!Array.isArray(parsed.projects)) parsed.projects = [];
        if (!Array.isArray(parsed.tasks)) parsed.tasks = [];
        if (!Array.isArray(parsed.columns)) parsed.columns = getDefaultColumns();
        if (!Array.isArray(parsed.activities)) parsed.activities = [];
        return parsed;
      }
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

function loadDbFromFile(): DatabaseSchema {
  // 1. Try reading from tmp directory (writable in serverless)
  const tmpParsed = tryParseDb(TMP_DB_FILE_PATH);
  if (tmpParsed) return tmpParsed;

  // 2. Try reading from project directory
  const localParsed = tryParseDb(DB_FILE_PATH);
  if (localParsed) return localParsed;

  // 3. Fallback to initial seed
  const initial = getInitialSeedData();
  return initial;
}

export function saveDbToFile(db?: DatabaseSchema): void {
  try {
    const targetData = db || global.__taskflow_db__;
    if (targetData) {
      global.__taskflow_db__ = targetData;
      const serialized = JSON.stringify(targetData, null, 2);

      // Try saving to project directory (works in local dev)
      try {
        const dir = path.dirname(DB_FILE_PATH);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(DB_FILE_PATH, serialized, 'utf-8');
      } catch {
        // Read-only filesystem in Vercel serverless functions
      }

      // Also try saving to tmp directory (works across invocations in serverless)
      try {
        fs.writeFileSync(TMP_DB_FILE_PATH, serialized, 'utf-8');
      } catch {
        // ignore tmp write issues
      }
    }
  } catch (error) {
    console.error('Error saving db:', error);
  }
}

export function getDatabase(): DatabaseSchema {
  if (!global.__taskflow_db__) {
    global.__taskflow_db__ = loadDbFromFile();
  }
  return global.__taskflow_db__;
}

export function resetDatabase(): DatabaseSchema {
  global.__taskflow_db__ = getInitialSeedData();
  saveDbToFile(global.__taskflow_db__);
  return global.__taskflow_db__;
}
