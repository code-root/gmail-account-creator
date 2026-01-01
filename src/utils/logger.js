/**
 * Logger utility for the application
 * نظام السجلات للتطبيق
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
};

const LOG_LEVEL = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
const LOG_DIR = path.join(__dirname, '../../logs');

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

const logFile = path.join(LOG_DIR, `app-${new Date().toISOString().split('T')[0]}.log`);

function formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` | Data: ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level}] ${message}${dataStr}\n`;
}

function shouldLog(level) {
    return LOG_LEVELS[level] <= LOG_LEVELS[LOG_LEVEL];
}

function writeLog(level, message, data = null) {
    if (!shouldLog(level)) return;

    const formatted = formatMessage(level, message, data);
    
    // Console output
    const colors = {
        ERROR: '\x1b[31m', // Red
        WARN: '\x1b[33m',  // Yellow
        INFO: '\x1b[36m',  // Cyan
        DEBUG: '\x1b[90m'  // Gray
    };
    const reset = '\x1b[0m';
    console.log(`${colors[level] || ''}${formatted.trim()}${reset}`);

    // File output
    try {
        fs.appendFileSync(logFile, formatted);
    } catch (error) {
        console.error('Failed to write to log file:', error.message);
    }
}

export const logger = {
    error: (message, data) => writeLog('ERROR', message, data),
    warn: (message, data) => writeLog('WARN', message, data),
    info: (message, data) => writeLog('INFO', message, data),
    debug: (message, data) => writeLog('DEBUG', message, data)
};

export default logger;


