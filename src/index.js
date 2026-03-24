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
import config from './config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

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

/**
 * Save account result
 * حفظ نتيجة الحساب
 */
function saveResult(result) {
    try {
        let results = [];
        if (fs.existsSync(RESULTS_FILE)) {
            const content = fs.readFileSync(RESULTS_FILE, 'utf8');
            results = JSON.parse(content);
        }
        
        results.push({
            ...result,
            createdAt: new Date().toISOString()
        });
        
        fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
        logger.info('Result saved', { email: result.email });
    } catch (error) {
        logger.error('Failed to save result', { error: error.message });
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

    try {
        logger.info(`${accountLabel} === Starting Gmail Account Creation ===`);

        // Step 1: Get proxy
        proxy = proxyManager.getNextProxy();
        if (!proxy) {
            throw new Error('No proxies available');
        }
        logger.info(`${accountLabel} Proxy selected`, { proxy: proxy.ip });

        // Step 2: Generate account data
        const accountData = nameGenerator.generateAccountData();
        logger.info(`${accountLabel} Account data generated`, { 
            name: accountData.fullName,
            email: accountData.email
        });

        // Step 3: Create profile based on selected service
        const profileName = `Gmail_${accountData.username}_${Date.now()}`;
        const profileService = config.profileService || 'gpm';
        
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

        // Step 4: Get browser and page
        const browser = await profile.getBrowser();
        const page = await profile.getPage();

        if (!browser || !page) {
            const serviceName = profileService === 'dolphin' ? 'Dolphin Anty' : 'GPM Login';
            throw new Error(`Failed to get browser instance from ${serviceName} profile`);
        }

        // Step 5: Create Gmail account
        logger.info(`${accountLabel} Starting Gmail account creation process`);
        const result = await createGmailAccount(page, accountData);

        // Step 6: Get profile IP (if available)
        let profileIP = null;
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
            }
        } catch (ipError) {
            logger.debug('Could not get profile IP', { error: ipError.message });
        }

        // Step 7: Save result with all details
        saveResult({
            success: true,
            ...result,
            profileId: profile.profileId,
            profileType: profileService === 'dolphin' ? 'Dolphin Anty' : 'GPM Login',
            proxy: proxyManager.getStringFormat(proxy),
            proxyIP: proxy ? proxy.ip : null,
            profileIP: profileIP,
            timestamp: new Date().toISOString()
        });

        logger.info(`${accountLabel} === Account Creation Completed Successfully ===`, {
            email: result.email
        });

        return result;
    } catch (error) {
        logger.error(`${accountLabel} === Account Creation Failed ===`, {
            error: error.message,
            stack: error.stack
        });

        // Save failure result
        saveResult({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });

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

