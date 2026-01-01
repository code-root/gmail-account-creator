/**
 * User Data Storage Utility
 * أداة تخزين بيانات المستخدم
 * 
 * Optimized function to store username and birth date
 * دالة محسّنة لتخزين اسم المستخدم وتاريخ الميلاد
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Storage file path
const STORAGE_FILE = path.join(__dirname, '../../user-data.json');

/**
 * Save username and birth date to storage file
 * حفظ اسم المستخدم وتاريخ الميلاد في ملف التخزين
 * 
 * @param {string} username - Username to save
 * @param {Object} birthDate - Birth date object {year, month, day} or {birthYear, birthMonth, birthDay}
 * @returns {boolean} - Success status
 */
export function saveUserData(username, birthDate) {
    try {
        // Normalize birth date format
        const normalizedDate = {
            year: birthDate.year || birthDate.birthYear || null,
            month: birthDate.month || birthDate.birthMonth || null,
            day: birthDate.day || birthDate.birthDay || null
        };

        // Validate input
        if (!username || !normalizedDate.year || !normalizedDate.month || !normalizedDate.day) {
            logger.warn('Invalid user data provided', { username, birthDate: normalizedDate });
            return false;
        }

        // Format date as YYYY-MM-DD for consistency
        const formattedDate = `${normalizedDate.year}-${String(normalizedDate.month).padStart(2, '0')}-${String(normalizedDate.day).padStart(2, '0')}`;

        // Prepare data entry
        const entry = {
            username,
            birthDate: formattedDate,
            birthYear: normalizedDate.year,
            birthMonth: normalizedDate.month,
            birthDay: normalizedDate.day,
            timestamp: new Date().toISOString()
        };

        // Read existing data or initialize empty array
        let data = [];
        if (fs.existsSync(STORAGE_FILE)) {
            try {
                const content = fs.readFileSync(STORAGE_FILE, 'utf8');
                data = JSON.parse(content);
                // Ensure it's an array
                if (!Array.isArray(data)) {
                    data = [];
                }
            } catch (parseError) {
                logger.warn('Failed to parse existing storage file, creating new one', { error: parseError.message });
                data = [];
            }
        }

        // Check if username already exists (avoid duplicates)
        const existingIndex = data.findIndex(item => item.username === username);
        if (existingIndex !== -1) {
            // Update existing entry
            data[existingIndex] = { ...data[existingIndex], ...entry };
            logger.debug('Updated existing user data', { username });
        } else {
            // Add new entry
            data.push(entry);
        }

        // Write to file atomically (write to temp file then rename for safety)
        const tempFile = `${STORAGE_FILE}.tmp`;
        fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
        fs.renameSync(tempFile, STORAGE_FILE);

        logger.info('User data saved successfully', { username, birthDate: formattedDate });
        return true;
    } catch (error) {
        logger.error('Failed to save user data', { 
            error: error.message, 
            username,
            stack: error.stack 
        });
        return false;
    }
}

/**
 * Get user data by username
 * الحصول على بيانات المستخدم بواسطة اسم المستخدم
 * 
 * @param {string} username - Username to search for
 * @returns {Object|null} - User data or null if not found
 */
export function getUserData(username) {
    try {
        if (!fs.existsSync(STORAGE_FILE)) {
            return null;
        }

        const content = fs.readFileSync(STORAGE_FILE, 'utf8');
        const data = JSON.parse(content);
        
        if (!Array.isArray(data)) {
            return null;
        }

        return data.find(item => item.username === username) || null;
    } catch (error) {
        logger.error('Failed to get user data', { error: error.message, username });
        return null;
    }
}

/**
 * Get all user data
 * الحصول على جميع بيانات المستخدمين
 * 
 * @returns {Array} - Array of all user data entries
 */
export function getAllUserData() {
    try {
        if (!fs.existsSync(STORAGE_FILE)) {
            return [];
        }

        const content = fs.readFileSync(STORAGE_FILE, 'utf8');
        const data = JSON.parse(content);
        
        return Array.isArray(data) ? data : [];
    } catch (error) {
        logger.error('Failed to get all user data', { error: error.message });
        return [];
    }
}

/**
 * Batch save multiple user data entries
 * حفظ متعدد لبيانات المستخدمين
 * 
 * @param {Array} entries - Array of {username, birthDate} objects
 * @returns {number} - Number of successfully saved entries
 */
export function saveUserDataBatch(entries) {
    if (!Array.isArray(entries) || entries.length === 0) {
        return 0;
    }

    let savedCount = 0;
    for (const entry of entries) {
        if (saveUserData(entry.username, entry.birthDate)) {
            savedCount++;
        }
    }

    logger.info('Batch save completed', { total: entries.length, saved: savedCount });
    return savedCount;
}

export default {
    saveUserData,
    getUserData,
    getAllUserData,
    saveUserDataBatch
};

