import fs from 'node:fs';
import path from 'node:path';
import { type DatabaseSchema, getDefaultColumns, getInitialSeedData } from '../database/seed';

const DB_FILE_PATH = path.join(process.cwd(), 'server', 'database', 'db.json');

declare global {
  // eslint-disable-next-line no-var
  var __taskflow_db__: DatabaseSchema | undefined;
}

function loadDbFromFile(): DatabaseSchema {
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const fileData = fs.readFileSync(DB_FILE_PATH, 'utf-8');
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
  } catch (error) {
    console.error('Error reading db.json, generating default seed:', error);
  }

  const initial = getInitialSeedData();
  saveDbToFile(initial);
  return initial;
}

export function saveDbToFile(db?: DatabaseSchema): void {
  try {
    const targetData = db || global.__taskflow_db__;
    if (targetData) {
      global.__taskflow_db__ = targetData;
      const dir = path.dirname(DB_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(targetData, null, 2), 'utf-8');
    }
  } catch (error) {
    console.error('Error saving db.json:', error);
  }
}

export function getDatabase(): DatabaseSchema {
  global.__taskflow_db__ = loadDbFromFile();
  return global.__taskflow_db__;
}

export function resetDatabase(): DatabaseSchema {
  global.__taskflow_db__ = getInitialSeedData();
  saveDbToFile(global.__taskflow_db__);
  return global.__taskflow_db__;
}
