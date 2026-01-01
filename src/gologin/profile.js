/**
 * GoLogin Profile Manager
 * إدارة بروفايلات GoLogin
 */

import { GologinApi } from 'gologin';
import puppeteer from 'puppeteer-core';
import logger from '../utils/logger.js';
import gologinClient from './client.js';
import config from '../config.js';

class GoLoginProfile {
    constructor(profileId, gologinApi = null) {
        this.profileId = profileId;
        this.browser = null;
        this.page = null;
        this.gologinApi = gologinApi;
    }

    /**
     * Start profile and get browser instance
     * بدء البروفايل والحصول على متصفح
     */
    async start() {
        try {
            logger.info('Starting GoLogin profile (Remote Mode)', { profileId: this.profileId });

            if (!this.gologinApi) {
                const apiKey = process.env.GOLOGIN_API_KEY;
                if (!apiKey) {
                    throw new Error('GOLOGIN_API_KEY is not set');
                }
                // Use Remote Mode (Cloud Browser)
                this.gologinApi = GologinApi({ token: apiKey });
            }

            // Start browser using Remote Mode (Cloud Browser)
            logger.info('Starting GoLogin browser (Remote Mode, may take 30-60 seconds)...');
            
            // Retry logic with proper error handling for remote mode
            let browser;
            let retries = 5;
            let lastError;
            
            for (let attempt = 1; attempt <= retries; attempt++) {
                try {
                    logger.info(`Starting browser attempt ${attempt}/${retries} (Remote Mode, may take 30-60 seconds)...`);
                    
                    // Remote Mode uses cloud browser - no local browser needed
                    const startPromise = this.gologinApi.launch({ 
                        profileId: this.profileId,
                        cloud: true // Use Remote Mode (Cloud Browser)
                    });
                    const timeoutPromise = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Connection timeout after 120 seconds')), 120000)
                    );
                    
                    const result = await Promise.race([startPromise, timeoutPromise]);
                    browser = result.browser;
                    
                    if (browser) {
                        logger.info('Browser started successfully (Remote Mode)');
                        break;
                    } else {
                        lastError = new Error('Browser launch returned null');
                        if (attempt < retries) {
                            const waitTime = Math.min(attempt * 10000, 30000); // Progressive backoff: 10s, 20s, 30s, 30s
                            logger.warn(`Attempt ${attempt} failed, retrying in ${waitTime/1000}s...`);
                            await new Promise(resolve => setTimeout(resolve, waitTime));
                        }
                    }
                } catch (e) {
                    lastError = e;
                    const isTimeout = e.message.includes('timeout') || 
                                     e.message.includes('disconnected') || 
                                     e.message.includes('TLS') ||
                                     e.message.includes('ECONNRESET');
                    logger.warn(`GoLogin start attempt ${attempt} failed`, { 
                        error: e.message,
                        isTimeout,
                        stack: isTimeout ? undefined : e.stack
                    });
                    
                    if (attempt < retries) {
                        const waitTime = Math.min(attempt * 10000, 30000); // Progressive backoff: 10s, 20s, 30s, 30s
                        logger.info(`Waiting ${waitTime/1000}s before retry (Remote servers may be slow)...`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                    }
                }
            }
            
            if (!browser) {
                logger.error('GoLogin start failed after all retries', { 
                    error: lastError?.message
                });
                throw new Error(`Failed to start GoLogin profile: ${lastError?.message || 'Unknown error'}`);
            }

            // Browser is already connected via Remote Mode
            this.browser = browser;
            this.page = await this.browser.newPage();

            logger.info('Profile started successfully (Remote Mode)', { profileId: this.profileId });
            return this;
        } catch (error) {
            logger.error('Failed to start profile', { profileId: this.profileId, error: error.message });
            throw error;
        }
    }

    /**
     * Get browser instance (creates new if needed)
     * الحصول على متصفح (إنشاء جديد إذا لزم الأمر)
     */
    async getBrowser() {
        if (!this.browser) {
            await this.start();
        }
        return this.browser;
    }

    /**
     * Get page instance
     * الحصول على صفحة
     */
    async getPage() {
        if (!this.page) {
            const browser = await this.getBrowser();
            const pages = await browser.pages();
            this.page = pages[0] || await browser.newPage();
        }
        return this.page;
    }

    /**
     * Stop profile
     * إيقاف البروفايل
     */
    async stop() {
        try {
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
                this.page = null;
            }

            if (this.gologinApi) {
                await this.gologinApi.stop();
            }

            await gologinClient.stopProfile(this.profileId);
            logger.info('Profile stopped', { profileId: this.profileId });
            return true;
        } catch (error) {
            logger.warn('Error stopping profile', { profileId: this.profileId, error: error.message });
            return false;
        }
    }

    /**
     * Delete profile
     * حذف البروفايل
     */
    async delete() {
        try {
            await this.stop();
            await gologinClient.deleteProfile(this.profileId);
            logger.info('Profile deleted', { profileId: this.profileId });
            return true;
        } catch (error) {
            logger.error('Failed to delete profile', { profileId: this.profileId, error: error.message });
            throw error;
        }
    }
}

/**
 * Create and start a new profile
 * إنشاء وبدء بروفايل جديد
 */
export async function createAndStartProfile(name, proxy = null) {
    try {
        // Get API key
        const apiKey = process.env.GOLOGIN_API_KEY;
        if (!apiKey) {
            throw new Error('GOLOGIN_API_KEY is not set');
        }

        // Use GologinApi to create profile (uses /browser/quick which is more efficient)
        const gologinApi = GologinApi({ token: apiKey });
        
        // Create profile using gologinClient (uses /browser/quick - more efficient)
        // This reduces API calls and works better with free tier
        logger.info('Creating GoLogin profile using quick method (Android)...');
        // Use config to determine if proxy testing should be enabled
        const testProxy = config.app.testProxy !== false;
        const profile = await gologinClient.createProfileWithProxy(name, proxy, testProxy);
        logger.info('Profile created', { profileId: profile.id, name });

        // Wait a bit after profile creation to ensure it's fully initialized on GoLogin servers
        // الانتظار قليلاً بعد إنشاء البروفايل لضمان تهيئته بالكامل على خوادم GoLogin
        logger.info('Waiting for profile initialization...');
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconds delay (increased for better reliability)
        
        // Verify profile is ready by checking it exists
        // التحقق من أن البروفايل جاهز عن طريق التحقق من وجوده
        try {
            await gologinClient.getProfile(profile.id);
            logger.info('Profile verified and ready', { profileId: profile.id });
        } catch (verifyError) {
            logger.warn('Profile verification failed, continuing anyway', { 
                profileId: profile.id,
                error: verifyError.message 
            });
        }

        // Start browser (Remote Mode - may take 30-60 seconds)
        logger.info('Starting GoLogin browser (Remote Mode, may take 30-60 seconds)...');
        
        // Retry logic for browser start with longer timeouts for remote mode
        // خطأ 500 يعني مشكلة في خادم GoLogin - نحتاج محاولات أكثر وانتظار أطول
        let browser;
        let retries = 8; // زيادة المحاولات من 5 إلى 8
        let lastError;
        let serverErrorCount = 0; // تتبع عدد أخطاء الخادم
        
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                logger.info(`Starting browser attempt ${attempt}/${retries} (Remote Mode, may take 60-120 seconds)...`);
                
                // Remote Mode uses cloud browser - no local browser needed
                // Add exponential backoff delay before launch for server errors
                // إضافة تأخير تدريجي قبل البدء للأخطاء من الخادم
                if (serverErrorCount > 0 && attempt > 1) {
                    const backoffDelay = Math.min(Math.pow(2, serverErrorCount - 1) * 2000, 30000); // 2s, 4s, 8s, 16s, max 30s
                    logger.info(`Waiting ${backoffDelay/1000}s before launch (exponential backoff for server errors)...`);
                    await new Promise(resolve => setTimeout(resolve, backoffDelay));
                }
                
                const launchResult = await Promise.race([
                    gologinApi.launch({ 
                        profileId: profile.id,
                        cloud: true // Use Remote Mode (Cloud Browser)
                    }).catch(async (launchError) => {
                        // If launch fails with 500, wait a bit and try to verify profile
                        if (launchError.message.includes('500') || launchError.message.includes('Unexpected server response')) {
                            logger.warn('Launch failed with server error, verifying profile status...', { 
                                profileId: profile.id 
                            });
                            // Wait a bit and verify profile exists
                            await new Promise(resolve => setTimeout(resolve, 3000));
                            try {
                                await gologinClient.getProfile(profile.id);
                                logger.info('Profile exists, server may be busy');
                            } catch (e) {
                                logger.warn('Profile verification failed', { error: e.message });
                            }
                        }
                        throw launchError;
                    }),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error(`Launch timeout after ${serverErrorCount >= 3 ? 180 : 120} seconds`)), 
                        serverErrorCount >= 3 ? 180000 : 120000)
                    )
                ]);
                
                browser = launchResult?.browser;
                
                // Verify browser connection is actually working
                if (browser) {
                    try {
                        // Test connection by getting pages (this will fail if connection is bad)
                        const pages = await Promise.race([
                            browser.pages(),
                            new Promise((_, reject) => 
                                setTimeout(() => reject(new Error('Browser connection test timeout')), 10000)
                            )
                        ]);
                        logger.info('Browser started successfully (Remote Mode)', { 
                            profileId: profile.id,
                            pagesCount: pages.length 
                        });
                        break;
                    } catch (connectionError) {
                        // Browser object exists but connection is bad
                        lastError = new Error(`Browser connection failed: ${connectionError.message}`);
                        logger.warn('Browser connection test failed', { 
                            error: connectionError.message,
                            attempt 
                        });
                        // Close bad connection
                        try {
                            await browser.close();
                        } catch (e) {
                            // Ignore close errors
                        }
                        browser = null;
                    }
                } else {
                    lastError = new Error('Browser launch returned null');
                }
                
                if (!browser && attempt < retries) {
                    const waitTime = Math.min(attempt * 10000, 30000);
                    logger.warn(`Attempt ${attempt} failed, retrying in ${waitTime/1000}s...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            } catch (e) {
                lastError = e;
                const isServerError = e.message.includes('500') || 
                                    e.message.includes('502') || 
                                    e.message.includes('503') ||
                                    e.message.includes('504') ||
                                    e.message.includes('Unexpected server response') ||
                                    e.message.includes('ECONNREFUSED') ||
                                    e.message.includes('socket hang up');
                const isTimeout = e.message.includes('timeout') || 
                                 e.message.includes('disconnected') || 
                                 e.message.includes('TLS') ||
                                 e.message.includes('ECONNRESET');
                
                if (isServerError) {
                    serverErrorCount++;
                }
                
                logger.warn(`GoLogin start attempt ${attempt} failed`, { 
                    error: e.message,
                    isServerError,
                    isTimeout,
                    serverErrorCount,
                    profileId: profile.id,
                    // إضافة معلومات إضافية للأخطاء المتكررة
                    suggestion: isServerError && serverErrorCount >= 3 
                        ? 'خادم GoLogin يواجه مشاكل. جرب لاحقاً أو تحقق من حالة الخدمة.'
                        : undefined,
                    stack: (isServerError || isTimeout) ? undefined : e.stack
                });
                
                if (attempt < retries) {
                    // زيادة وقت الانتظار للأخطاء المتكررة من الخادم
                    // Use exponential backoff with jitter for better distribution
                    let waitTime;
                    if (isServerError) {
                        // Exponential backoff: 15s, 30s, 60s, 90s, 120s
                        const baseWait = Math.min(15000 * Math.pow(2, Math.min(serverErrorCount - 1, 3)), 120000);
                        // Add jitter (±20%) to avoid thundering herd
                        const jitter = baseWait * 0.2 * (Math.random() * 2 - 1);
                        waitTime = Math.max(10000, baseWait + jitter);
                    } else {
                        waitTime = Math.min(attempt * 10000, 30000); // 10s, 20s, 30s, 30s
                    }
                    
                    logger.info(`Waiting ${Math.round(waitTime/1000)}s before retry (${isServerError ? `Server error (${serverErrorCount} times)` : 'Remote servers may be slow'})...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            }
        }
        
        if (!browser) {
            logger.error('GoLogin start failed after all retries', { 
                error: lastError?.message
            });
            throw new Error(`Failed to start GoLogin profile: ${lastError?.message || 'Unknown error'}`);
        }

        // Browser is already connected via Remote Mode
        const page = await browser.newPage();
        
        const profileManager = new GoLoginProfile(profile.id, gologinApi);
        profileManager.browser = browser;
        profileManager.page = page;
        
        logger.info('Profile created and started (Remote Mode)', { profileId: profile.id, name });
        return profileManager;
    } catch (error) {
        logger.error('Failed to create and start profile', { error: error.message });
        throw error;
    }
}

export default GoLoginProfile;

