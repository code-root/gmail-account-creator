/**
 * Name Generator
 * توليد الأسماء العشوائية
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NAMES_FILE = path.join(__dirname, '../../config/names.json');

class NameGenerator {
    constructor() {
        this.names = { female: [], male: [] };
        this.loadNames();
    }

    /**
     * Load names from JSON file
     * تحميل الأسماء من ملف JSON
     */
    loadNames() {
        try {
            if (!fs.existsSync(NAMES_FILE)) {
                logger.error('Names file not found');
                return;
            }

            const content = fs.readFileSync(NAMES_FILE, 'utf8');
            this.names = JSON.parse(content);
            logger.info(`Loaded ${this.names.female.length} female and ${this.names.male.length} male names`);
        } catch (error) {
            logger.error('Error loading names', { error: error.message });
        }
    }

    /**
     * Get random name
     * الحصول على اسم عشوائي
     */
    getRandomName(gender = null) {
        if (!gender) {
            gender = Math.random() < 0.5 ? 'female' : 'male';
        }

        const nameList = this.names[gender] || [];
        if (nameList.length === 0) {
            return gender === 'female' ? 'Fatima' : 'Ahmed';
        }

        return nameList[Math.floor(Math.random() * nameList.length)];
    }

    /**
     * Generate random username
     * توليد اسم مستخدم عشوائي
     */
    generateUsername(firstName, lastName = null) {
        const randomNum = Math.floor(Math.random() * 10000);
        const year = 1990 + Math.floor(Math.random() * 30);
        
        if (lastName) {
            return `${firstName.toLowerCase()}${lastName.toLowerCase()}${year}`;
        }
        
        return `${firstName.toLowerCase()}${randomNum}${year}`;
    }

    /**
     * Generate strong password
     * توليد كلمة مرور قوية
     */
    generatePassword(length = 16) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        
        // Ensure at least one of each type
        password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
        password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
        password += '0123456789'[Math.floor(Math.random() * 10)];
        password += '!@#$%^&*'[Math.floor(Math.random() * 8)];
        
        // Fill the rest
        for (let i = password.length; i < length; i++) {
            password += chars[Math.floor(Math.random() * chars.length)];
        }
        
        // Shuffle
        return password.split('').sort(() => Math.random() - 0.5).join('');
    }

    /**
     * Generate full account data
     * توليد بيانات حساب كاملة
     */
    generateAccountData() {
        const gender = Math.random() < 0.5 ? 'female' : 'male';
        const firstName = this.getRandomName(gender);
        const lastName = this.getRandomName(gender);
        const username = this.generateUsername(firstName, lastName);
        const password = this.generatePassword();
        const email = `${username}@gmail.com`;

        return {
            firstName,
            lastName,
            fullName: `${firstName} ${lastName}`,
            username,
            email,
            password,
            gender
        };
    }
}

export default new NameGenerator();


