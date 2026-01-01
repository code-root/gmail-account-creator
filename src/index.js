/**
 * Gmail Account Creator Bot
 * بوت إنشاء حسابات Gmail
 * 
 * Main entry point for the application
 * نقطة البداية الرئيسية للتطبيق
 */

import dotenv from 'dotenv';
import logger from './utils/logger.js';
import proxyManager from './utils/proxy-manager.js';
import nameGenerator from './utils/name-generator.js';
import { createAndStartProfile as createAndStartGPMProfile } from './gpmlogin/profile.js';
import { createAndStartProfile as createAndStartDolphinProfile } from './dolphin/profile.js';
import { createGmailAccount } from './gmail/creator.js';
import { addRecoveryPhone } from './gmail/recovery-phone-handler.js';
import config from './config.js';
import { SMS_VERIFY_COUNTRIES } from './sms-provider.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { saveUserData } from './utils/user-data-storage.js';

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

const RESULTS_FILE = path.join(__dirname, '../results.json');
const ACCOUNTS_DIR = path.join(__dirname, '../accounts');

/**
 * Ensure accounts directory exists
 * التأكد من وجود مجلد accounts
 */
function ensureAccountsDir() {
    try {
        if (!fs.existsSync(ACCOUNTS_DIR)) {
            fs.mkdirSync(ACCOUNTS_DIR, { recursive: true });
            logger.info('Accounts directory created', { path: ACCOUNTS_DIR });
        }
    } catch (error) {
        logger.error('Failed to create accounts directory', { error: error.message });
    }
}

/**
 * Get cookies from page
 * الحصول على الكوكيز من الصفحة
 */
async function getCookiesFromPage(page) {
    try {
        if (!page) {
            return [];
        }
        
        const cookies = await page.cookies();
        return cookies.map(cookie => ({
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path,
            expires: cookie.expires,
            httpOnly: cookie.httpOnly,
            secure: cookie.secure,
            sameSite: cookie.sameSite
        }));
    } catch (error) {
        logger.warn('Failed to get cookies from page', { error: error.message });
        return [];
    }
}

/**
 * Save account to individual file in accounts directory
 * حفظ الحساب في ملف منفصل في مجلد accounts
 */
function saveAccountToFile(accountData) {
    try {
        ensureAccountsDir();
        
        if (!accountData.email) {
            logger.warn('Cannot save account: no email provided');
            return;
        }
        
        // Create safe filename from email (replace @ and . with _)
        // إنشاء اسم ملف آمن من البريد الإلكتروني (استبدال @ و . بـ _)
        const safeEmail = accountData.email.replace(/[@.]/g, '_');
        const accountFile = path.join(ACCOUNTS_DIR, `${safeEmail}.json`);
        
        // Prepare account data with all information
        // إعداد بيانات الحساب مع جميع المعلومات
        const accountInfo = {
            ...accountData,
            savedAt: new Date().toISOString(),
            createdAt: accountData.createdAt || accountData.timestamp || new Date().toISOString()
        };
        
        // Write atomically (write to temp file then rename for safety)
        // الكتابة بشكل آمن (الكتابة إلى ملف مؤقت ثم إعادة التسمية للأمان)
        const tempFile = `${accountFile}.tmp`;
        fs.writeFileSync(tempFile, JSON.stringify(accountInfo, null, 2), 'utf8');
        fs.renameSync(tempFile, accountFile);
        
        logger.info('Account saved to individual file', { 
            email: accountData.email,
            file: accountFile
        });
    } catch (error) {
        logger.error('Failed to save account to file', { 
            error: error.message,
            email: accountData.email,
            stack: error.stack
        });
    }
}

/**
 * Save account result (never overwrites existing data, only appends)
 * حفظ نتيجة الحساب (لا يستبدل البيانات الموجودة أبداً، يضيف فقط)
 */
function saveResult(result) {
    try {
        let results = [];
        
        // Always read existing results first (preserve all previous data)
        // دائماً قراءة النتائج الموجودة أولاً (الحفاظ على جميع البيانات السابقة)
        if (fs.existsSync(RESULTS_FILE)) {
            try {
                const content = fs.readFileSync(RESULTS_FILE, 'utf8');
                if (content && content.trim()) {
                    results = JSON.parse(content);
                    // Ensure it's an array
                    if (!Array.isArray(results)) {
                        logger.warn('Results file is not an array, initializing new array');
                        results = [];
                    }
                }
            } catch (parseError) {
                logger.warn('Failed to parse existing results file, starting fresh', { 
                    error: parseError.message 
                });
                results = [];
            }
        }
        
        // Add new result with timestamp
        // إضافة نتيجة جديدة مع الطابع الزمني
        const newResult = {
            ...result,
            createdAt: new Date().toISOString(),
            savedAt: new Date().toISOString()
        };
        
        // Check if this result already exists (by email or timestamp) to avoid duplicates
        // التحقق من وجود هذه النتيجة بالفعل (بالبريد الإلكتروني أو الطابع الزمني) لتجنب التكرار
        const isDuplicate = results.some(existing => {
            // If both have email and they match
            if (existing.email && newResult.email && existing.email === newResult.email) {
                // Update existing entry instead of duplicating
                // تحديث الإدخال الموجود بدلاً من التكرار
                const index = results.indexOf(existing);
                results[index] = { ...existing, ...newResult };
                return true;
            }
            return false;
        });
        
        if (!isDuplicate) {
            results.push(newResult);
        }
        
        // Write atomically (write to temp file then rename for safety)
        // الكتابة بشكل آمن (الكتابة إلى ملف مؤقت ثم إعادة التسمية للأمان)
        const tempFile = `${RESULTS_FILE}.tmp`;
        fs.writeFileSync(tempFile, JSON.stringify(results, null, 2), 'utf8');
        fs.renameSync(tempFile, RESULTS_FILE);
        
        logger.info('Result saved', { 
            email: result.email || 'N/A',
            success: result.success,
            totalResults: results.length
        });
        
        // Also save to individual account file
        // أيضاً حفظ في ملف حساب منفصل
        if (result.email) {
            saveAccountToFile(newResult);
        }
    } catch (error) {
        logger.error('Failed to save result', { 
            error: error.message,
            stack: error.stack
        });
    }
}

/**
 * Create single Gmail account
 * إنشاء حساب Gmail واحد
 */
async function createAccount(accountNumber = null) {
    let profile = null;
    let phoneOrder = null;
    let proxy = null; // Initialize proxy variable
    const accountLabel = accountNumber ? `[Account ${accountNumber}]` : '';
    
    // Store account data and partial results for saving even on failure
    // تخزين بيانات الحساب والنتائج الجزئية للحفظ حتى عند الفشل
    let accountData = null;
    let partialResult = null;
    let profileIP = null;
    let profileService = null;
    let profileId = null;

    try {
        logger.info(`${accountLabel} === Starting Gmail Account Creation ===`);

        // Step 1: Get proxy
        proxy = proxyManager.getNextProxy();
        if (!proxy) {
            throw new Error('No proxies available');
        }
        logger.info(`${accountLabel} Proxy selected`, { proxy: proxy.ip });

        // Step 2: Generate account data
        accountData = nameGenerator.generateAccountData();
        logger.info(`${accountLabel} Account data generated`, { 
            name: accountData.fullName,
            email: accountData.email
        });
        
        // Save partial data immediately (in case of failure - preserve all generated data)
        // حفظ البيانات الجزئية فوراً (في حالة الفشل - الحفاظ على جميع البيانات المولدة)
        partialResult = {
            success: false,
            email: accountData.email,
            username: accountData.username,
            firstName: accountData.firstName,
            lastName: accountData.lastName,
            fullName: accountData.fullName,
            password: accountData.password,
            gender: accountData.gender,
            proxy: proxyManager.getStringFormat(proxy),
            proxyIP: proxy ? proxy.ip : null,
            timestamp: new Date().toISOString(),
            accountNumber: accountNumber
        };
        
        // Save initial data immediately to prevent data loss
        // حفظ البيانات الأولية فوراً لمنع فقدان البيانات
        saveResult(partialResult);

        // Step 3: Create profile based on selected service
        const profileName = `Gmail_${accountData.username}_${Date.now()}`;
        profileService = config.profileService || 'gpm';
        
        logger.info(`${accountLabel} Creating ${profileService.toUpperCase()} profile`, { name: profileName });
        
        // Format proxy according to service
        if (profileService === 'dolphin') {
            // Dolphin Anty proxy format
            const dolphinProxy = proxy ? {
                ip: proxy.ip,
                port: proxy.port,
                username: proxy.username || '',
                password: proxy.password || '',
                type: proxy.type || 'http'
            } : null;
            profile = await createAndStartDolphinProfile(profileName, dolphinProxy);
        } else {
            // GPM Login proxy format (default)
            const gpmProxy = proxy ? {
                ip: proxy.ip,
                port: proxy.port,
                username: proxy.username || '',
                password: proxy.password || '',
                type: 'http' // Default to HTTP
            } : null;
            profile = await createAndStartGPMProfile(profileName, gpmProxy);
        }
        
        logger.info(`${accountLabel} Profile created and started`, { profileId: profile.profileId });
        
        // Update partial result with profile info
        // تحديث النتيجة الجزئية بمعلومات البروفايل
        profileId = profile.profileId;
        partialResult.profileId = profileId;
        partialResult.profileType = profileService === 'dolphin' ? 'Dolphin Anty' : 'GPM Login';

        // Step 4: Get browser and page
        const browser = await profile.getBrowser();
        const page = await profile.getPage();

        if (!browser || !page) {
            const serviceName = profileService === 'dolphin' ? 'Dolphin Anty' : 'GPM Login';
            throw new Error(`Failed to get browser instance from ${serviceName} profile`);
        }

        // Step 5: Create Gmail account
        logger.info(`${accountLabel} Starting Gmail account creation process`);
        let result = null;
        try {
            result = await createGmailAccount(page, accountData);
            
            // Update partial result with account creation result
            // تحديث النتيجة الجزئية بنتيجة إنشاء الحساب
            if (result) {
                partialResult = {
                    ...partialResult,
                    ...result,
                    success: result.success !== false // true if not explicitly false
                };
            }
        } catch (accountError) {
            // Save partial data even if account creation fails
            // حفظ البيانات الجزئية حتى لو فشل إنشاء الحساب
            logger.error(`${accountLabel} Account creation failed, saving partial data`, {
                error: accountError.message
            });
            
            // Update partial result with error
            partialResult = {
                ...partialResult,
                success: false,
                error: accountError.message,
                errorStack: accountError.stack
            };
            
            // Save partial result immediately
            saveResult(partialResult);
            
            throw accountError;
        }

        // Step 6: Get profile IP (if available)
        try {
            const page = await profile.getPage();
            if (page) {
                profileIP = await page.evaluate(() => {
                    return new Promise((resolve) => {
                        fetch('https://api.ipify.org?format=json')
                            .then(r => r.json())
                            .then(data => resolve(data.ip))
                            .catch(() => resolve(null));
                    });
                });
                // Update partial result with profile IP
                // تحديث النتيجة الجزئية بـ IP البروفايل
                if (profileIP) {
                    partialResult.profileIP = profileIP;
                }
            }
        } catch (ipError) {
            logger.debug('Could not get profile IP', { error: ipError.message });
        }

        // Step 7: Save result with all details (always save to prevent data loss)
        // الخطوة 7: حفظ النتيجة مع جميع التفاصيل (دائماً احفظ لمنع فقدان البيانات)
        const successResult = {
            success: true,
            ...result,
            profileId: profile.profileId,
            profileType: profileService === 'dolphin' ? 'Dolphin Anty' : 'GPM Login',
            proxy: proxyManager.getStringFormat(proxy),
            proxyIP: proxy ? proxy.ip : null,
            profileIP: profileIP,
            timestamp: partialResult?.timestamp || new Date().toISOString(),
            accountNumber: accountNumber
        };
        
        // Update partial result for consistency (in case of later failure)
        // تحديث النتيجة الجزئية للاتساق (في حالة الفشل لاحقاً)
        partialResult = { ...partialResult, ...successResult };
        
        // Save/update result (will update existing entry if email matches)
        // حفظ/تحديث النتيجة (سيحدث الإدخال الموجود إذا تطابق البريد الإلكتروني)
        saveResult(successResult);

        // Step 7.5: Save username and birth date to dedicated storage
        if (result.username && result.birthDate) {
            saveUserData(result.username, result.birthDate);
        }

        // Step 8: Add recovery phone number
        // الخطوة 8: إضافة رقم هاتف الاسترداد
        let recoveryPhoneData = null;
        try {
            logger.info(`${accountLabel} Starting recovery phone addition process...`);
            
            // Get country code for recovery phone (use same logic as phone verification)
            // الحصول على رمز الدولة لرقم الاسترداد (استخدم نفس منطق التحقق من الهاتف)
            const smsProvider = (process.env.SMS_PROVIDER || 'sms-verification').toLowerCase().trim();
            let countryCode;
            
            if (smsProvider === 'fivesim-legacy' || smsProvider === '5sim-legacy') {
                const fivesimCountry = process.env.FIVESIM_COUNTRY || 'england';
                countryCode = fivesimCountry;
            } else {
                // For SMS Verification, use country selection from config
                const countryCodes = config.smsVerify.countries || [53, 95];
                const countryMap = {
                    [SMS_VERIFY_COUNTRIES.SAUDI_ARABIA]: 'Saudi Arabia',
                    [SMS_VERIFY_COUNTRIES.UAE]: 'UAE',
                    [SMS_VERIFY_COUNTRIES.RUSSIA]: 'Russia',
                    [SMS_VERIFY_COUNTRIES.UK]: 'UK',
                    [SMS_VERIFY_COUNTRIES.INDIA]: 'India',
                    [SMS_VERIFY_COUNTRIES.GERMANY]: 'Germany',
                    [SMS_VERIFY_COUNTRIES.TURKEY]: 'Turkey',
                    [SMS_VERIFY_COUNTRIES.FRANCE]: 'France',
                    [SMS_VERIFY_COUNTRIES.USA_REAL]: 'USA Real',
                    [SMS_VERIFY_COUNTRIES.CHINA]: 'China',
                    [SMS_VERIFY_COUNTRIES.INDONESIA]: 'Indonesia',
                    [SMS_VERIFY_COUNTRIES.PHILIPPINES]: 'Philippines',
                    [SMS_VERIFY_COUNTRIES.VIETNAM]: 'Vietnam',
                    [SMS_VERIFY_COUNTRIES.THAILAND]: 'Thailand',
                    [SMS_VERIFY_COUNTRIES.KUWAIT]: 'Kuwait',
                    [SMS_VERIFY_COUNTRIES.QATAR]: 'Qatar',
                    [SMS_VERIFY_COUNTRIES.OMAN]: 'Oman',
                    [SMS_VERIFY_COUNTRIES.BAHRAIN]: 'Bahrain',
                    [SMS_VERIFY_COUNTRIES.JORDAN]: 'Jordan',
                    [SMS_VERIFY_COUNTRIES.LEBANON]: 'Lebanon'
                };
                
                const countries = countryCodes.map(code => ({
                    code: code,
                    name: countryMap[code] || `Country ${code}`
                }));
                
                const selectedCountry = countries[Math.floor(Math.random() * countries.length)];
                countryCode = selectedCountry.code;
            }
            
            // Get page for recovery phone addition
            const page = await profile.getPage();
            if (page) {
                // Prepare account data with password, phone, and orderId for recovery phone flow
                const accountDataForRecovery = {
                    ...accountData,
                    password: result.password,
                    phone: result.phone,
                    orderId: result.orderId
                };
                
                recoveryPhoneData = await addRecoveryPhone(page, accountDataForRecovery, countryCode);
                
                if (recoveryPhoneData && recoveryPhoneData.success) {
                    logger.info(`${accountLabel} Recovery phone added successfully`, {
                        recoveryPhone: recoveryPhoneData.recoveryPhone,
                        recoveryPhoneOrderId: recoveryPhoneData.recoveryPhoneOrderId
                    });
                } else {
                    logger.warn(`${accountLabel} Recovery phone addition failed or skipped`, {
                        error: recoveryPhoneData?.error
                    });
                }
            } else {
                logger.warn(`${accountLabel} Could not get page for recovery phone addition`);
            }
        } catch (recoveryError) {
            logger.error(`${accountLabel} Error adding recovery phone`, {
                error: recoveryError.message,
                stack: recoveryError.stack
            });
            // Don't fail the whole account creation if recovery phone fails
            // لا تفشل عملية إنشاء الحساب بالكامل إذا فشلت إضافة رقم الاسترداد
        }

        // Step 9: Get cookies from page before stopping profile
        // الخطوة 9: الحصول على الكوكيز من الصفحة قبل إيقاف البروفايل
        let cookies = [];
        try {
            const page = await profile.getPage();
            if (page) {
                cookies = await getCookiesFromPage(page);
                logger.info(`${accountLabel} Cookies extracted`, { 
                    cookiesCount: cookies.length 
                });
            }
        } catch (cookieError) {
            logger.warn(`${accountLabel} Failed to extract cookies`, { 
                error: cookieError.message 
            });
        }

        // Step 10: Update result with recovery phone data and cookies
        // الخطوة 10: تحديث النتيجة ببيانات رقم الاسترداد والكوكيز
        const finalResult = {
            ...result,
            recoveryPhone: recoveryPhoneData?.recoveryPhone || null,
            recoveryPhoneOrderId: recoveryPhoneData?.recoveryPhoneOrderId || null,
            recoveryPhoneCode: recoveryPhoneData?.recoveryPhoneCode || null,
            cookies: cookies
        };

        // Update saved result with recovery phone info and cookies
        // تحديث النتيجة المحفوظة بمعلومات رقم الاسترداد والكوكيز
        const finalResultToSave = {
            success: true,
            ...finalResult,
            profileId: profile.profileId,
            profileType: profileService === 'dolphin' ? 'Dolphin Anty' : 'GPM Login',
            proxy: proxyManager.getStringFormat(proxy),
            proxyIP: proxy ? proxy.ip : null,
            profileIP: profileIP,
            timestamp: new Date().toISOString(),
            cookies: cookies
        };
        
        // Always save final result with cookies
        // دائماً حفظ النتيجة النهائية مع الكوكيز
        saveResult(finalResultToSave);

        logger.info(`${accountLabel} === Account Creation Completed Successfully ===`, {
            email: result.email,
            hasRecoveryPhone: !!(recoveryPhoneData?.recoveryPhone),
            cookiesCount: cookies.length
        });

        return finalResult;
    } catch (error) {
        logger.error(`${accountLabel} === Account Creation Failed ===`, {
            error: error.message,
            stack: error.stack
        });

        // Save failure result with all available data (don't lose partial data)
        // حفظ نتيجة الفشل مع جميع البيانات المتاحة (عدم فقدان البيانات الجزئية)
        const failureResult = {
            ...partialResult,
            success: false,
            error: error.message,
            errorStack: error.stack,
            timestamp: partialResult?.timestamp || new Date().toISOString()
        };
        
        // Ensure we have at least basic account data
        // التأكد من وجود بيانات الحساب الأساسية على الأقل
        if (accountData) {
            failureResult.email = failureResult.email || accountData.email;
            failureResult.username = failureResult.username || accountData.username;
            failureResult.firstName = failureResult.firstName || accountData.firstName;
            failureResult.lastName = failureResult.lastName || accountData.lastName;
            failureResult.fullName = failureResult.fullName || accountData.fullName;
            failureResult.password = failureResult.password || accountData.password;
        }
        
        // Add profile info if available
        // إضافة معلومات البروفايل إذا كانت متاحة
        if (profileId) {
            failureResult.profileId = profileId;
            failureResult.profileType = profileService === 'dolphin' ? 'Dolphin Anty' : 'GPM Login';
        }
        
        // Add proxy info if available
        // إضافة معلومات البروكسي إذا كانت متاحة
        if (proxy) {
            failureResult.proxy = failureResult.proxy || proxyManager.getStringFormat(proxy);
            failureResult.proxyIP = failureResult.proxyIP || proxy.ip;
        }
        
        // Add profile IP if available
        // إضافة IP البروفايل إذا كان متاحاً
        if (profileIP) {
            failureResult.profileIP = profileIP;
        }
        
        // Try to get cookies even on failure (if page is still available)
        // محاولة الحصول على الكوكيز حتى عند الفشل (إذا كانت الصفحة متاحة)
        try {
            if (profile) {
                const page = await profile.getPage();
                if (page) {
                    const cookies = await getCookiesFromPage(page);
                    if (cookies.length > 0) {
                        failureResult.cookies = cookies;
                        logger.info(`${accountLabel} Cookies extracted on failure`, { 
                            cookiesCount: cookies.length 
                        });
                    }
                }
            }
        } catch (cookieError) {
            logger.debug(`${accountLabel} Could not extract cookies on failure`, { 
                error: cookieError.message 
            });
        }
        
        saveResult(failureResult);
        
        // Also save username and birth date if available (even on failure)
        // أيضاً حفظ اسم المستخدم وتاريخ الميلاد إذا كانا متاحين (حتى عند الفشل)
        if (partialResult?.username && partialResult?.birthDate) {
            try {
                saveUserData(partialResult.username, partialResult.birthDate);
            } catch (userDataError) {
                logger.warn('Failed to save user data on failure', { error: userDataError.message });
            }
        }

        throw error;
    } finally {
        // Cleanup: Stop profile
        if (profile) {
            try {
                await profile.stop();
                logger.info(`${accountLabel} Profile stopped`);
            } catch (error) {
                logger.warn(`${accountLabel} Error stopping profile`, { error: error.message });
            }
        }

        // Release proxy on failure
        if (profile && proxy) {
            // Only release if we failed
            // proxyManager.releaseProxy(proxy);
        }
    }
}

/**
 * Process queue with concurrency control
 * معالجة قائمة الانتظار مع التحكم في التزامن
 */
async function processQueue(queue, concurrency) {
    const results = [];
    const executing = [];
    let completed = 0;
    let failed = 0;

    const executeTask = async (task, index) => {
        try {
            logger.info(`[Thread ${index + 1}] Starting account creation ${completed + failed + 1}/${queue.length}`);
            const result = await task();
            completed++;
            results.push({ success: true, result, index });
            logger.info(`[Thread ${index + 1}] Account created successfully (${completed} success, ${failed} failed)`);
        } catch (error) {
            failed++;
            results.push({ success: false, error: error.message, index });
            logger.error(`[Thread ${index + 1}] Account creation failed (${completed} success, ${failed} failed)`, {
                error: error.message
            });
        }
    };

    for (let i = 0; i < queue.length; i++) {
        const task = queue[i];
        
        // Wait if we've reached concurrency limit
        while (executing.length >= concurrency) {
            await Promise.race(executing);
        }

        const promise = executeTask(task, i).then(() => {
            executing.splice(executing.indexOf(promise), 1);
        });

        executing.push(promise);
    }

    // Wait for all remaining tasks
    await Promise.all(executing);

    return {
        results,
        stats: {
            total: queue.length,
            completed,
            failed,
            successRate: ((completed / queue.length) * 100).toFixed(2) + '%'
        }
    };
}

/**
 * Main function
 * الدالة الرئيسية
 */
async function main() {
    try {
        // Parse command line arguments
        const args = process.argv.slice(2);
        let accountsCount = parseInt(process.env.ACCOUNTS_COUNT || '1');
        let threadsCount = parseInt(process.env.THREADS_COUNT || '1');

        // Parse arguments: --accounts=5 --threads=2
        for (const arg of args) {
            if (arg.startsWith('--accounts=')) {
                accountsCount = parseInt(arg.split('=')[1]) || accountsCount;
            } else if (arg.startsWith('--threads=')) {
                threadsCount = parseInt(arg.split('=')[1]) || threadsCount;
            } else if (arg.startsWith('-a=')) {
                accountsCount = parseInt(arg.split('=')[1]) || accountsCount;
            } else if (arg.startsWith('-t=')) {
                threadsCount = parseInt(arg.split('=')[1]) || threadsCount;
            }
        }

        logger.info('=== Gmail Account Creator Bot Started ===');
        logger.info('Configuration:', {
            accountsCount,
            threadsCount,
            hasGpmConnection: true, // GPM runs locally, no API key needed
            hasOmocaptchaKey: !!process.env.OMOCAPTCHA_KEY,
            hasSmsVerifyKey: !!process.env.SMS_VERIFY_API_KEY,
            proxyCount: proxyManager.proxies.length,
            availableProxies: proxyManager.getAvailableCount()
        });

        // Validate configuration
        if (accountsCount < 1) {
            throw new Error('Accounts count must be at least 1');
        }

        if (threadsCount < 1) {
            throw new Error('Threads count must be at least 1');
        }

        if (threadsCount > accountsCount) {
            logger.warn('Threads count is greater than accounts count, setting threads to accounts count');
            threadsCount = accountsCount;
        }

        if (proxyManager.proxies.length < threadsCount) {
            logger.warn(`Only ${proxyManager.proxies.length} proxies available, but ${threadsCount} threads requested`);
        }

        // Create queue of tasks
        const queue = [];
        for (let i = 0; i < accountsCount; i++) {
            queue.push(() => createAccount(i + 1));
        }

        logger.info(`Starting creation of ${accountsCount} accounts with ${threadsCount} concurrent threads`);

        const startTime = Date.now();
        
        // Process queue with concurrency control
        const { results, stats } = await processQueue(queue, threadsCount);

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        // Print summary
        logger.info('=== Execution Summary ===');
        logger.info('Statistics:', {
            ...stats,
            duration: `${duration}s`,
            averageTime: `${(duration / accountsCount).toFixed(2)}s per account`
        });

        // Save summary with full details
        const summary = {
            timestamp: new Date().toISOString(),
            configuration: {
                accountsCount,
                threadsCount,
                profileService: config.profileService || 'gpm',
                smsProvider: process.env.SMS_PROVIDER || 'sms-verification'
            },
            stats,
            duration: `${duration}s`,
            results: results.map(r => {
                if (r.success && r.result) {
                    return {
                        success: true,
                        email: r.result.email || null,
                        password: r.result.password || null,
                        firstName: r.result.firstName || null,
                        lastName: r.result.lastName || null,
                        fullName: r.result.fullName || null,
                        username: r.result.username || null,
                        phone: r.result.phone || null,
                        phoneCode: r.result.phoneCode || null,
                        orderId: r.result.orderId || null,
                        recoveryPhone: r.result.recoveryPhone || null,
                        recoveryPhoneOrderId: r.result.recoveryPhoneOrderId || null,
                        recoveryPhoneCode: r.result.recoveryPhoneCode || null,
                        profileId: r.result.profileId || null,
                        profileType: r.result.profileType || null,
                        proxy: r.result.proxy || null,
                        proxyIP: r.result.proxyIP || null,
                        profileIP: r.result.profileIP || null,
                        timestamp: r.result.timestamp || null,
                        error: null
                    };
                } else {
                    return {
                        success: false,
                        email: null,
                        error: r.error || null
                    };
                }
            })
        };

        const summaryFile = path.join(__dirname, '../summary.json');
        fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
        logger.info('Summary saved to summary.json');

        logger.info('=== Bot execution completed ===');

        
    } catch (error) {
        logger.error('Fatal error in main', { error: error.message, stack: error.stack });
        process.exit(1);
    }
}

// Run if this is the main module
// Check if this file is being run directly (not imported)
const isMainModule = (() => {
    if (!process.argv[1]) return false;
    try {
        const mainModulePath = pathToFileURL(path.resolve(process.argv[1])).href;
        const currentModulePath = pathToFileURL(fileURLToPath(import.meta.url)).href;
        return mainModulePath === currentModulePath;
    } catch {
        // Fallback: check if import.meta.url matches process.argv[1]
        const mainPath = process.argv[1].replace(/\\/g, '/');
        const currentPath = fileURLToPath(import.meta.url).replace(/\\/g, '/');
        return path.resolve(mainPath) === path.resolve(currentPath);
    }
})();

if (isMainModule) {
    main().catch(error => {
        logger.error('Unhandled error', { error: error.message });
        process.exit(1);
    });
}

export default {
    createAccount,
    main
};

