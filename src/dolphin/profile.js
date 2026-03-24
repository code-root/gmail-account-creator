/**
 * Dolphin Anty Profile Manager
 * إدارة بروفايلات Dolphin Anty
 */

import puppeteer from 'puppeteer-core';
import axios from 'axios';
import logger from '../utils/logger.js';
import dolphinClient from './client.js';

class DolphinProfile {
    constructor(profileId, webSocketUrl = null) {
        this.profileId = profileId;
        this.browser = null;
        this.page = null;
        this.webSocketUrl = webSocketUrl;
    }

    /**
     * Start profile and get browser instance
     * بدء البروفايل والحصول على متصفح
     */
    async start() {
        try {
            logger.info('Starting Dolphin Anty profile', { profileId: this.profileId });

            if (!this.webSocketUrl) {
                // Start profile to get WebSocket URL
                const startData = await dolphinClient.startProfile(this.profileId);
                this.webSocketUrl = startData.ws || startData.webSocketDebuggerUrl;
            }

            if (!this.webSocketUrl) {
                throw new Error('Failed to get WebSocket URL from Dolphin Anty');
            }

            // Wait a bit for browser to fully start
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Connect to browser using WebSocket URL
            let wsEndpoint = this.webSocketUrl;
            
            // Ensure WebSocket URL is properly formatted
            if (!wsEndpoint.startsWith('ws://') && !wsEndpoint.startsWith('wss://')) {
                wsEndpoint = `ws://${wsEndpoint.replace(/^(https?):\/\//, '')}`;
            }

            // Retry connection with multiple attempts
            let browser = null;
            let lastError = null;
            const retries = 5;
            
            for (let attempt = 1; attempt <= retries; attempt++) {
                try {
                    logger.info(`Connecting to Dolphin Anty browser (attempt ${attempt}/${retries})...`);
                    
                    browser = await puppeteer.connect({
                        browserWSEndpoint: wsEndpoint,
                        ignoreHTTPSErrors: true,
                        defaultViewport: null // Don't override viewport - Dolphin handles it
                    });

                    // Test connection
                    const pages = await browser.pages();
                    logger.info('Dolphin Anty browser connected successfully', { 
                        profileId: this.profileId,
                        pagesCount: pages.length,
                        wsEndpoint: wsEndpoint
                    });
                    break;
                } catch (e) {
                    lastError = e;
                    logger.warn(`Dolphin Anty browser connection attempt ${attempt} failed`, { 
                        error: e.message,
                        profileId: this.profileId,
                        wsEndpoint: wsEndpoint
                    });
                    
                    if (attempt < retries) {
                        // Progressive wait time: 2s, 3s, 4s, 5s
                        const waitTime = Math.min(2000 + (attempt * 1000), 8000);
                        logger.info(`Waiting ${waitTime/1000}s before retry...`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        
                        // Try to refresh WebSocket URL
                        try {
                            const startData = await dolphinClient.startProfile(this.profileId);
                            if (startData.ws || startData.webSocketDebuggerUrl) {
                                wsEndpoint = startData.ws || startData.webSocketDebuggerUrl;
                                if (!wsEndpoint.startsWith('ws://') && !wsEndpoint.startsWith('wss://')) {
                                    wsEndpoint = `ws://${wsEndpoint.replace(/^(https?):\/\//, '')}`;
                                }
                                logger.info('Refreshed WebSocket endpoint', { wsEndpoint });
                            }
                        } catch (refreshError) {
                            logger.debug('Could not refresh endpoint, using previous', { error: refreshError.message });
                        }
                    }
                }
            }

            if (!browser) {
                throw new Error(`Failed to connect to Dolphin Anty browser: ${lastError?.message || 'Unknown error'}`);
            }

            this.browser = browser;
            
            // Always create a new clean page for stability
            // دائماً إنشاء صفحة نظيفة جديدة للاستقرار
            this.page = await browser.newPage();
            logger.info('Created new clean page');
            
            // Wait for page to be fully ready before proceeding
            // انتظار حتى تكون الصفحة جاهزة بالكامل قبل المتابعة
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Ensure page is still accessible
            try {
                const pageUrl = await this.page.url();
                logger.info('Page is ready', { url: pageUrl || 'about:blank' });
            } catch (urlError) {
                logger.warn('Could not get page URL, but continuing', { error: urlError.message });
            }

            logger.info('Dolphin Anty profile started successfully', { profileId: this.profileId });
            return this;
        } catch (error) {
            logger.error('Failed to start Dolphin Anty profile', { 
                profileId: this.profileId, 
                error: error.message 
            });
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
                try {
                    await this.browser.disconnect();
                } catch (e) {
                    // Ignore disconnect errors
                }
                this.browser = null;
                this.page = null;
            }

            await dolphinClient.stopProfile(this.profileId);
            logger.info('Dolphin Anty profile stopped', { profileId: this.profileId });
            return true;
        } catch (error) {
            logger.warn('Error stopping Dolphin Anty profile', { 
                profileId: this.profileId, 
                error: error.message 
            });
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
            await dolphinClient.deleteProfile(this.profileId);
            logger.info('Dolphin Anty profile deleted', { profileId: this.profileId });
            return true;
        } catch (error) {
            logger.error('Failed to delete Dolphin Anty profile', { 
                profileId: this.profileId, 
                error: error.message 
            });
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
        // Check Dolphin connection first
        const isConnected = await dolphinClient.checkDolphinConnection();
        if (!isConnected) {
            throw new Error('Dolphin Anty API is not available. Please make sure Dolphin Anty is running and DOLPHIN_API_KEY is set correctly.');
        }

        // Create profile
        logger.info('Creating Dolphin Anty profile...');
        const profile = await dolphinClient.createProfile(name, proxy);
        
        if (!profile.id) {
            throw new Error('Failed to create profile: No profile ID returned');
        }

        logger.info('Dolphin Anty profile created', { 
            profileId: profile.id, 
            name: profile.title || name
        });

        // Wait a bit for profile to be ready
        logger.info('Waiting for profile initialization...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Start profile
        logger.info('Starting Dolphin Anty profile...');
        const startData = await dolphinClient.startProfile(profile.id);
        
        if (!startData.ws && !startData.webSocketDebuggerUrl) {
            throw new Error('Failed to start profile: No WebSocket URL returned');
        }

        // Create profile manager
        const profileManager = new DolphinProfile(profile.id, startData.ws || startData.webSocketDebuggerUrl);
        await profileManager.start();

        logger.info('Dolphin Anty profile created and started', { 
            profileId: profile.id, 
            name: profile.title || name 
        });
        
        return profileManager;
    } catch (error) {
        logger.error('Failed to create and start Dolphin Anty profile', { error: error.message });
        throw error;
    }
}

export default DolphinProfile;

