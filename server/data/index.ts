import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { type DatabaseSchema, getDefaultColumns, getInitialSeedData } from '../database/seed';

const DB_FILE_PATH =
  process.env.DB_PATH || path.join(process.cwd(), 'server', 'database', 'db.json');
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
        if (!parsed.inviteTokens) parsed.inviteTokens = {};
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
  // 1. Primary: Try reading from configured database path (Docker/Render/Local)
  const localParsed = tryParseDb(DB_FILE_PATH);
  if (localParsed) return localParsed;

  // 2. Secondary: Try reading from tmp directory (fallback in serverless)
  const tmpParsed = tryParseDb(TMP_DB_FILE_PATH);
  if (tmpParsed) return tmpParsed;

  // 3. Fallback: Initialize with seed data and persist immediately
  const initial = getInitialSeedData();
  try {
    const dir = path.dirname(DB_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(initial, null, 2), 'utf-8');
  } catch {
    // Ignore initial write failure if environment is read-only
  }
  return initial;
}

export function saveDbToFile(db?: DatabaseSchema): void {
  try {
    const targetData = db || global.__taskflow_db__;
    if (targetData) {
      global.__taskflow_db__ = targetData;
      const serialized = JSON.stringify(targetData, null, 2);

      // Primary: Save to configured database file (works in Docker / Render / Local)
      try {
        const dir = path.dirname(DB_FILE_PATH);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(DB_FILE_PATH, serialized, 'utf-8');
      } catch (err) {
        // Read-only filesystem in some serverless environments
      }

      // Secondary: Also sync to tmp directory
      try {
        fs.writeFileSync(TMP_DB_FILE_PATH, serialized, 'utf-8');
      } catch {
        // ignore tmp write issues
      }
    }
  } catch (error) {
    console.error('Error saving database:', error);
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
