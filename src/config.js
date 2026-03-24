/**
 * Application Configuration
 * إعدادات التطبيق
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file first, then try .emv if .env doesn't exist
// تحميل ملف .env أولاً، ثم تجربة .emv إذا لم يوجد .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });
// Also try loading .emv if .env doesn't have required variables
// أيضاً جرب تحميل .emv إذا لم يكن .env يحتوي على المتغيرات المطلوبة
if (!process.env.PROFILE_SERVICE && !process.env.DOLPHIN_API_KEY) {
    dotenv.config({ path: path.resolve(__dirname, '../.emv') });
}

export const config = {
    profileService: process.env.PROFILE_SERVICE || 'gpm', // 'gpm' or 'dolphin'
    gpmlogin: {
        apiUrl: process.env.GPM_API_URL || 'http://127.0.0.1:14517'
    },
    dolphin: {
        apiUrl: process.env.DOLPHIN_API_URL || 'http://127.0.0.1:30898',
        apiKey: process.env.DOLPHIN_API_KEY || '',
        folderId: process.env.DOLPHIN_FOLDER_ID || ''
    },
    gologin: {
        apiKey: process.env.GOLOGIN_API_KEY || '',
        apiUrl: 'https://api.gologin.com'
    },
    omocaptcha: {
        extensionId: 'dfjghhjachoacpgpkmbpdlpppeagojhe',
        apiKey: process.env.OMOCAPTCHA_KEY || '',
        enabled: process.env.SETUP_OMO_CAPTCHA !== 'false' // Default: true, set SETUP_OMO_CAPTCHA=false to disable
    },
    smsVerify: {
        apiKey: process.env.SMS_VERIFY_API_KEY || '',
        lang: process.env.SMS_VERIFY_LANG || 'ru',
        service: 'go', // Google service code
        country: 16, // UK
        // SMS_VERIFY_COUNTRIES: Comma-separated country codes (e.g., "53,95" for Saudi Arabia and UAE)
        // If empty, defaults to Saudi Arabia (53) and UAE (95)
        // SMS_VERIFY_COUNTRIES: أكواد الدول مفصولة بفواصل (مثل: "53,95" للسعودية والإمارات)
        countries: process.env.SMS_VERIFY_COUNTRIES ? 
            process.env.SMS_VERIFY_COUNTRIES.split(',').map(c => parseInt(c.trim())).filter(c => !isNaN(c)) : 
            [53, 95] // Default: Saudi Arabia (53) and UAE (95)
    },
    app: {
        logLevel: process.env.LOG_LEVEL || 'info',
        maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
        retryDelay: 5000,
        accountsCount: parseInt(process.env.ACCOUNTS_COUNT || '1'),
        threadsCount: parseInt(process.env.THREADS_COUNT || '1'),
        testProxy: process.env.TEST_PROXY !== 'false' // Default: true, set TEST_PROXY=false to disable
    }
};

// Validate required configuration
if (config.profileService === 'gpm') {
    if (!config.gpmlogin.apiUrl) {
        console.warn('⚠ GPM_API_URL is not set, using default: http://127.0.0.1:14517');
    }
} else if (config.profileService === 'dolphin') {
    if (!config.dolphin.apiKey) {
        console.warn('⚠ DOLPHIN_API_KEY is not set. Please set it in .env file');
    }
    if (!config.dolphin.apiUrl) {
        console.warn('⚠ DOLPHIN_API_URL is not set, using default: http://127.0.0.1:30898');
    }
    if (!config.dolphin.folderId) {
        console.warn('⚠ DOLPHIN_FOLDER_ID is not set. Profiles will be created in default folder');
    }
} else {
    console.warn(`⚠ Unknown PROFILE_SERVICE: ${config.profileService}. Using default: gpm`);
    config.profileService = 'gpm';
}

if (!config.omocaptcha.apiKey) {
    console.warn('⚠ OMOCAPTCHA_KEY is not set');
}

if (!config.smsVerify.apiKey) {
    console.warn('⚠ SMS_VERIFY_API_KEY is not set');
}

export default config;

