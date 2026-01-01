/**
 * Name Generator
 * توليد الأسماء العشوائية
 * 
 * Uses names from config/names.json
 * يستخدم الأسماء من config/names.json
 * 
 * Logic:
 * - If female: girl name + father name (male)
 * - If male: boy name + family name
 * - Arabic or English
 * 
 * المنطق:
 * - إذا كانت بنت: اسم البنت + اسم الأب (ولد)
 * - إذا كان ولد: اسم الولد + اسم العائلة
 * - عربي أو إنجليزي
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
        this.names = {
            first_name_ar_male: [],
            first_name_en_male: [],
            first_name_ar_female: [],
            first_name_en_female: [],
            last_name_ar: [],
            last_name_en: [],
            family_name_ar: [],
            family_name_en: []
        };
        this.loadNames();
    }

    /**
     * Load names from JSON file
     * تحميل الأسماء من ملف JSON
     */
    loadNames() {
        try {
            if (!fs.existsSync(NAMES_FILE)) {
                logger.error('Names file not found', { path: NAMES_FILE });
                return;
            }

            const content = fs.readFileSync(NAMES_FILE, 'utf8');
            const namesData = JSON.parse(content);
            
            // Load all name categories
            // تحميل جميع فئات الأسماء
            this.names.first_name_ar_male = namesData.first_name_ar_male || [];
            this.names.first_name_en_male = namesData.first_name_en_male || [];
            this.names.first_name_ar_female = namesData.first_name_ar_female || [];
            this.names.first_name_en_female = namesData.first_name_en_female || [];
            this.names.last_name_ar = namesData.last_name_ar || [];
            this.names.last_name_en = namesData.last_name_en || [];
            this.names.family_name_ar = namesData.family_name_ar || [];
            this.names.family_name_en = namesData.family_name_en || [];
            
            logger.info('Names loaded successfully', {
                male_ar: this.names.first_name_ar_male.length,
                male_en: this.names.first_name_en_male.length,
                female_ar: this.names.first_name_ar_female.length,
                female_en: this.names.first_name_en_female.length,
                last_names_ar: this.names.last_name_ar.length,
                last_names_en: this.names.last_name_en.length,
                family_names_ar: this.names.family_name_ar.length,
                family_names_en: this.names.family_name_en.length
            });
        } catch (error) {
            logger.error('Error loading names', { error: error.message });
        }
    }

    /**
     * Get random item from array
     * الحصول على عنصر عشوائي من المصفوفة
     */
    getRandomItem(array) {
        if (!array || array.length === 0) {
            return null;
        }
        return array[Math.floor(Math.random() * array.length)];
    }

    /**
     * Generate random username
     * توليد اسم مستخدم عشوائي
     */
    generateUsername(firstName, lastName = null) {
        const randomNum = Math.floor(Math.random() * 10000);
        const year = 1990 + Math.floor(Math.random() * 30);
        
        // Remove Arabic characters and spaces for username
        // إزالة الأحرف العربية والمسافات من اسم المستخدم
        const cleanFirstName = firstName.replace(/[\u0600-\u06FF\s]/g, '').toLowerCase();
        const cleanLastName = lastName ? lastName.replace(/[\u0600-\u06FF\s]/g, '').toLowerCase() : '';
        
        if (cleanLastName) {
            return `${cleanFirstName}${cleanLastName}${year}`;
        }
        
        return `${cleanFirstName}${randomNum}${year}`;
    }

    /**
     * Generate strong password
     * توليد كلمة مرور قوية
     */
    generatePassword(length = 16) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        
        // Ensure at least one of each type
        // التأكد من وجود نوع واحد على الأقل من كل نوع
        password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
        password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
        password += '0123456789'[Math.floor(Math.random() * 10)];
        password += '!@#$%^&*'[Math.floor(Math.random() * 8)];
        
        // Fill the rest
        // ملء الباقي
        for (let i = password.length; i < length; i++) {
            password += chars[Math.floor(Math.random() * chars.length)];
        }
        
        // Shuffle
        // خلط
        return password.split('').sort(() => Math.random() - 0.5).join('');
    }

    /**
     * Generate full account data
     * توليد بيانات حساب كاملة
     * 
     * Logic:
     * - Random gender (male/female)
     * - Random language (Arabic/English)
     * - If female: girl name + father name (male)
     * - If male: boy name + family name
     */
    generateAccountData() {
        // Random gender
        // جنس عشوائي
        const gender = Math.random() < 0.5 ? 'female' : 'male';
        
        // Random language (Arabic or English)
        // لغة عشوائية (عربي أو إنجليزي)
        const language = Math.random() < 0.5 ? 'ar' : 'en';
        
        let firstName = null;
        let lastName = null;
        let fullName = null;
        
        if (gender === 'female') {
            // For female: girl name + father name (male)
            // للبنت: اسم البنت + اسم الأب (ولد)
            const girlNameKey = `first_name_${language}_female`;
            const fatherNameKey = `first_name_${language}_male`;
            
            const girlName = this.getRandomItem(this.names[girlNameKey]);
            const fatherName = this.getRandomItem(this.names[fatherNameKey]);
            
            if (!girlName || !fatherName) {
                // Fallback if names not available
                // بديل إذا لم تكن الأسماء متاحة
                firstName = language === 'ar' ? 'فاطمة' : 'Fatima';
                lastName = language === 'ar' ? 'محمد' : 'Mohammed';
            } else {
                firstName = girlName;
                lastName = fatherName; // Father's name
            }
            
            // Full name: girl name + father name
            // الاسم الكامل: اسم البنت + اسم الأب
            fullName = `${firstName} ${lastName}`;
            
        } else {
            // For male: boy name + family name
            // للولد: اسم الولد + اسم العائلة
            const boyNameKey = `first_name_${language}_male`;
            const familyNameKey = `family_name_${language}`;
            
            const boyName = this.getRandomItem(this.names[boyNameKey]);
            const familyName = this.getRandomItem(this.names[familyNameKey]);
            
            if (!boyName || !familyName) {
                // Fallback if names not available
                // بديل إذا لم تكن الأسماء متاحة
                firstName = language === 'ar' ? 'أحمد' : 'Ahmed';
                lastName = language === 'ar' ? 'آل سعود' : 'AlSaud';
            } else {
                firstName = boyName;
                lastName = familyName; // Family name
            }
            
            // Full name: boy name + family name
            // الاسم الكامل: اسم الولد + اسم العائلة
            fullName = `${firstName} ${lastName}`;
        }
        
        // Generate username and email
        // توليد اسم المستخدم والبريد الإلكتروني
        const username = this.generateUsername(firstName, lastName);
        const password = this.generatePassword();
        const email = `${username}@gmail.com`;

        logger.debug('Account data generated', {
            gender,
            language,
            firstName,
            lastName,
            fullName,
            username
        });

        return {
            firstName,
            lastName,
            fullName,
            username,
            email,
            password,
            gender,
            language
        };
    }
}

export default new NameGenerator();
