/**
 * GPM Login Profile Manager
 * إدارة بروفايلات GPM Login
 */

import puppeteer from 'puppeteer-core';
import axios from 'axios';
import logger from '../utils/logger.js';
import gpmClient from './client.js';

class GPMLoginProfile {
    constructor(profileId, remoteDebuggingAddress = null) {
        this.profileId = profileId;
        this.browser = null;
        this.page = null;
        this.remoteDebuggingAddress = remoteDebuggingAddress;
    }

    /**
     * Start profile and get browser instance
     * بدء البروفايل والحصول على متصفح
     */
    async start() {
        try {
            logger.info('Starting GPM profile', { profileId: this.profileId });

            if (!this.remoteDebuggingAddress) {
                // Start profile to get remote debugging address
                const startData = await gpmClient.startProfile(this.profileId);
                this.remoteDebuggingAddress = startData.remote_debugging_address;
            }

            if (!this.remoteDebuggingAddress) {
                throw new Error('Failed to get remote debugging address from GPM');
            }

            // Connect to browser using remote debugging address
            // GPM returns address like "127.0.0.1:9222" or "http://127.0.0.1:9222"
            let wsEndpoint = this.remoteDebuggingAddress;
            
            // Remove http:// or https:// or ws:// or wss:// if present
            const cleanAddress = wsEndpoint.replace(/^(https?|ws|wss):\/\//, '');
            
            // Wait a bit for browser to fully start
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Try multiple methods to get WebSocket endpoint
            let foundEndpoint = false;
            
            // Method 1: Try /json/version endpoint
            try {
                const browserInfo = await axios.get(`http://${cleanAddress}/json/version`, {
                    timeout: 5000
                });
                if (browserInfo.data && browserInfo.data.webSocketDebuggerUrl) {
                    wsEndpoint = browserInfo.data.webSocketDebuggerUrl;
                    foundEndpoint = true;
                    logger.info('Got WebSocket endpoint from /json/version', { wsEndpoint });
                }
            } catch (e) {
                logger.debug('Could not get endpoint from /json/version', { error: e.message });
            }
            
            // Method 2: Try /json endpoint to get browser WebSocket
            if (!foundEndpoint) {
                try {
                    const pagesInfo = await axios.get(`http://${cleanAddress}/json`, {
                        timeout: 5000
                    });
                    if (pagesInfo.data && Array.isArray(pagesInfo.data) && pagesInfo.data.length > 0) {
                        // Try to find browser target
                        const browserTarget = pagesInfo.data.find(p => p.type === 'browser');
                        if (browserTarget && browserTarget.webSocketDebuggerUrl) {
                            wsEndpoint = browserTarget.webSocketDebuggerUrl;
                            foundEndpoint = true;
                            logger.info('Got WebSocket endpoint from /json (browser target)', { wsEndpoint });
                        } else if (pagesInfo.data[0] && pagesInfo.data[0].webSocketDebuggerUrl) {
                            // Use first page's WebSocket and extract browser endpoint
                            const pageWs = pagesInfo.data[0].webSocketDebuggerUrl;
                            // Convert page WebSocket to browser WebSocket
                            wsEndpoint = pageWs.replace(/\/devtools\/page\/[^/]+$/, '/devtools/browser');
                            foundEndpoint = true;
                            logger.info('Got WebSocket endpoint from /json (converted from page)', { wsEndpoint });
                        }
                    }
                } catch (e) {
                    logger.debug('Could not get endpoint from /json', { error: e.message });
                }
            }
            
            // Method 2.5: Try /json/list endpoint (alternative)
            if (!foundEndpoint) {
                try {
                    const listInfo = await axios.get(`http://${cleanAddress}/json/list`, {
                        timeout: 5000
                    });
                    if (listInfo.data && Array.isArray(listInfo.data) && listInfo.data.length > 0) {
                        const browserTarget = listInfo.data.find(p => p.type === 'browser');
                        if (browserTarget && browserTarget.webSocketDebuggerUrl) {
                            wsEndpoint = browserTarget.webSocketDebuggerUrl;
                            foundEndpoint = true;
                            logger.info('Got WebSocket endpoint from /json/list', { wsEndpoint });
                        }
                    }
                } catch (e) {
                    logger.debug('Could not get endpoint from /json/list', { error: e.message });
                }
            }
            
            // Method 3: Fallback - construct WebSocket URL manually
            if (!foundEndpoint) {
                wsEndpoint = `ws://${cleanAddress}/devtools/browser`;
                logger.warn('Using fallback WebSocket endpoint', { wsEndpoint });
            }

            logger.info('Connecting to browser', { 
                profileId: this.profileId,
                wsEndpoint: wsEndpoint 
            });

            // Retry logic for connection with endpoint refresh
            let browser;
            let retries = 8; // Increased retries
            let lastError;
            let currentWsEndpoint = wsEndpoint;

            for (let attempt = 1; attempt <= retries; attempt++) {
                try {
                    logger.info(`Browser connection attempt ${attempt}/${retries}...`);
                    
                    // Try to refresh WebSocket endpoint on retries (after first attempt)
                    if (attempt > 1 && attempt % 2 === 0) {
                        let refreshed = false;
                        
                        // Try /json/version first
                        try {
                            const browserInfo = await axios.get(`http://${cleanAddress}/json/version`, {
                                timeout: 3000
                            });
                            if (browserInfo.data && browserInfo.data.webSocketDebuggerUrl) {
                                currentWsEndpoint = browserInfo.data.webSocketDebuggerUrl;
                                refreshed = true;
                                logger.info('Refreshed WebSocket endpoint from /json/version', { wsEndpoint: currentWsEndpoint });
                            }
                        } catch (e) {
                            // Try /json as fallback
                            try {
                                const pagesInfo = await axios.get(`http://${cleanAddress}/json`, {
                                    timeout: 3000
                                });
                                if (pagesInfo.data && Array.isArray(pagesInfo.data) && pagesInfo.data.length > 0) {
                                    const browserTarget = pagesInfo.data.find(p => p.type === 'browser');
                                    if (browserTarget && browserTarget.webSocketDebuggerUrl) {
                                        currentWsEndpoint = browserTarget.webSocketDebuggerUrl;
                                        refreshed = true;
                                        logger.info('Refreshed WebSocket endpoint from /json', { wsEndpoint: currentWsEndpoint });
                                    } else if (pagesInfo.data[0] && pagesInfo.data[0].webSocketDebuggerUrl) {
                                        const pageWs = pagesInfo.data[0].webSocketDebuggerUrl;
                                        currentWsEndpoint = pageWs.replace(/\/devtools\/page\/[^/]+$/, '/devtools/browser');
                                        refreshed = true;
                                        logger.info('Refreshed WebSocket endpoint from /json (converted)', { wsEndpoint: currentWsEndpoint });
                                    }
                                }
                            } catch (e2) {
                                // Keep using previous endpoint
                                logger.debug('Could not refresh endpoint, using previous', { error: e2.message });
                            }
                        }
                        
                        if (!refreshed) {
                            logger.debug('Using previous WebSocket endpoint for retry');
                        }
                    }
                    
                    browser = await puppeteer.connect({
                        browserWSEndpoint: currentWsEndpoint,
                        ignoreHTTPSErrors: true,
                        defaultViewport: null // Don't override viewport - GPM handles it
                    });

                    // Test connection
                    const pages = await browser.pages();
                    logger.info('Browser connected successfully', { 
                        profileId: this.profileId,
                        pagesCount: pages.length,
                        wsEndpoint: currentWsEndpoint
                    });
                    break;
                } catch (e) {
                    lastError = e;
                    logger.warn(`Browser connection attempt ${attempt} failed`, { 
                        error: e.message,
                        profileId: this.profileId,
                        wsEndpoint: currentWsEndpoint
                    });
                    
                    if (attempt < retries) {
                        // Progressive wait time: 2s, 3s, 4s, 5s, etc.
                        const waitTime = Math.min(2000 + (attempt * 1000), 8000);
                        logger.info(`Waiting ${waitTime/1000}s before retry...`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                    }
                }
            }

            if (!browser) {
                throw new Error(`Failed to connect to browser: ${lastError?.message || 'Unknown error'}`);
            }

            this.browser = browser;
            this.page = await this.browser.newPage();

            // Inject anti-detection scripts to hide automation traces
            // حقن نصوص إخفاء علامات automation
            await this.injectAntiDetectionScripts(this.page);

            logger.info('Profile started successfully', { profileId: this.profileId });
            return this;
        } catch (error) {
            logger.error('Failed to start profile', { 
                profileId: this.profileId, 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Inject anti-detection scripts to hide automation traces
     * حقن نصوص إخفاء علامات automation
     */
    async injectAntiDetectionScripts(page) {
        try {
            await page.evaluateOnNewDocument(() => {
                // Enhanced WebDriver hiding - multiple methods
                // إخفاء محسّن لـ WebDriver - طرق متعددة
                try {
                    // Method 1: Delete property
                    if (navigator.hasOwnProperty('webdriver')) {
                        delete navigator.webdriver;
                    }
                    
                    // Method 2: Override getter
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => undefined,
                        configurable: true,
                        enumerable: false
                    });
                } catch (e) {
                    // Method 3: Direct value override
                    try {
                        Object.defineProperty(navigator, 'webdriver', {
                            value: undefined,
                            writable: false,
                            configurable: true
                        });
                    } catch (e2) {
                        // Method 4: Prototype manipulation
                        try {
                            Object.defineProperty(Object.getPrototypeOf(navigator), 'webdriver', {
                                get: () => undefined,
                                configurable: true
                            });
                        } catch (e3) {
                            // Ignore if all methods fail
                        }
                    }
                }
                
                // Hide automation flags from window object
                // إخفاء علامات الأتمتة من كائن window
                const automationFlags = [
                    '__selenium_unwrapped',
                    '__webdriver_evaluate',
                    '__driver_evaluate',
                    '__selenium_evaluate',
                    '__fxdriver_evaluate',
                    '__driver_unwrapped',
                    '__webdriver_script_fn',
                    '__webdriver_script_func',
                    '__webdriver_script_fn',
                    '__selenium_unwrapped',
                    '__fxdriver_unwrapped',
                    '__driver_evaluate',
                    '__webdriver_evaluate',
                    '__selenium_evaluate',
                    '__fxdriver_evaluate',
                    '__webdriver_script_function',
                    '__webdriver_script_func',
                    '__webdriver_script_fn',
                    '__$webdriverAsyncExecutor',
                    '__lastWatirAlert',
                    '__lastWatirConfirm',
                    '__lastWatirPrompt',
                    'webdriver',
                    '__driver_evaluate',
                    '__webdriver_evaluate',
                    '__selenium_evaluate',
                    '__fxdriver_evaluate',
                    '_selenium',
                    'calledSelenium',
                    '_Selenium_IDE_Recorder',
                    '_selenium',
                    'calledSelenium',
                    '_Selenium_IDE_Recorder',
                    '_selenium',
                    'calledSelenium',
                    '_Selenium_IDE_Recorder',
                    '__selenium_unwrapped',
                    '__fxdriver_unwrapped',
                    '__driver_unwrapped',
                    '__webdriver_unwrapped',
                    '__selenium_evaluate',
                    '__webdriver_evaluate',
                    '__driver_evaluate',
                    '__fxdriver_evaluate',
                    '__selenium_unwrapped',
                    '__fxdriver_unwrapped',
                    '__driver_unwrapped',
                    '__webdriver_unwrapped',
                    '__selenium_evaluate',
                    '__webdriver_evaluate',
                    '__driver_evaluate',
                    '__fxdriver_evaluate'
                ];
                
                automationFlags.forEach(flag => {
                    try {
                        delete window[flag];
                        delete document[flag];
                    } catch (e) {
                        // Ignore
                    }
                });

                // Override permissions API
                try {
                    const originalQuery = window.navigator.permissions?.query;
                    if (originalQuery) {
                        window.navigator.permissions.query = (parameters) => (
                            parameters.name === 'notifications' ?
                                Promise.resolve({ state: Notification.permission }) :
                                originalQuery(parameters)
                        );
                    }
                } catch (e) {
                    // Ignore if permissions API is not available
                }

                // Mock plugins
                try {
                    if (!navigator.plugins || navigator.plugins.length === 0) {
                        Object.defineProperty(navigator, 'plugins', {
                            get: () => [1, 2, 3, 4, 5],
                            configurable: true
                        });
                    }
                } catch (e) {
                    // Ignore if plugins can't be redefined
                }

                // Mock languages
                try {
                    Object.defineProperty(navigator, 'languages', {
                        get: () => ['en-US', 'en'],
                        configurable: true
                    });
                } catch (e) {
                    // Ignore if languages can't be redefined
                }

                // Enhanced Chrome runtime override
                // تحسين إعادة تعريف Chrome runtime
                if (!window.chrome) {
                    window.chrome = {};
                }
                if (!window.chrome.runtime) {
                    window.chrome.runtime = {};
                }
                
                // Add more Chrome properties to look realistic
                window.chrome.runtime.onConnect = undefined;
                window.chrome.runtime.onMessage = undefined;
                
                // Ensure window.chrome exists and is not undefined
                Object.defineProperty(window, 'chrome', {
                    get: () => ({
                        runtime: {},
                        loadTimes: function() {},
                        csi: function() {},
                        app: {}
                    }),
                    configurable: true
                });

                // Remove all Chrome DevTools Protocol (CDP) automation indicators
                // إزالة جميع علامات Chrome DevTools Protocol (CDP)
                const cdpPatterns = [
                    'cdc_',
                    '__$webdriver',
                    '__driver_',
                    '__selenium_',
                    '__webdriver_',
                    '__fxdriver_',
                    'webdriver',
                    'driver',
                    'selenium',
                    'Selenium',
                    'selenium',
                    'webdriver',
                    '__selenium',
                    '__webdriver',
                    '__driver',
                    '__fxdriver',
                    'domAutomation',
                    'domAutomationController',
                    '_selenium',
                    'calledSelenium',
                    '_Selenium_IDE_Recorder',
                    '_selenium',
                    'calledSelenium',
                    '_Selenium_IDE_Recorder',
                    '__$cdc_',
                    '__$wdc_',
                    '__$wd_'
                ];
                
                // Remove all properties matching patterns
                Object.getOwnPropertyNames(window).forEach(prop => {
                    cdpPatterns.forEach(pattern => {
                        if (prop.includes(pattern)) {
                            try {
                                delete window[prop];
                            } catch (e) {
                                // Ignore
                            }
                        }
                    });
                });
                
                // Specific known CDP properties
                const knownCdpProps = [
                    'cdc_adoQpoasnfa76pfcZLmcfl_Array',
                    'cdc_adoQpoasnfa76pfcZLmcfl_Promise',
                    'cdc_adoQpoasnfa76pfcZLmcfl_Symbol',
                    'cdc_adoQpoasnfa76pfcZLmcfl_JSON',
                    'cdc_adoQpoasnfa76pfcZLmcfl_Object',
                    'cdc_adoQpoasnfa76pfcZLmcfl_Proxy',
                    'cdc_adoQpoasnfa76pfcZLmcfl_Array',
                    'cdc_adoQpoasnfa76pfcZLmcfl_Promise',
                    'cdc_adoQpoasnfa76pfcZLmcfl_Symbol',
                    'cdc_adoQpoasnfa76pfcZLmcfl_JSON',
                    'cdc_adoQpoasnfa76pfcZLmcfl_Object',
                    'cdc_adoQpoasnfa76pfcZLmcfl_Proxy'
                ];
                
                knownCdpProps.forEach(prop => {
                    try {
                        delete window[prop];
                        delete document[prop];
                    } catch (e) {
                        // Ignore
                    }
                });

                // Override WebGL to prevent fingerprinting - only if WebGL exists
                try {
                    if (typeof WebGLRenderingContext !== 'undefined') {
                        const getParameter = WebGLRenderingContext.prototype.getParameter;
                        WebGLRenderingContext.prototype.getParameter = function(parameter) {
                            if (parameter === 37445) {
                                return 'Intel Inc.';
                            }
                            if (parameter === 37446) {
                                return 'Intel Iris OpenGL Engine';
                            }
                            return getParameter.call(this, parameter);
                        };
                    }
                } catch (e) {
                    // Ignore if WebGL is not available
                }

                // Add noise to canvas to prevent fingerprinting - only if Canvas exists
                try {
                    if (typeof HTMLCanvasElement !== 'undefined') {
                        const toBlob = HTMLCanvasElement.prototype.toBlob;
                        const toDataURL = HTMLCanvasElement.prototype.toDataURL;
                        
                        HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) {
                            try {
                                const canvas = this;
                                const context = canvas.getContext('2d');
                                if (context) {
                                    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                                    for (let i = 0; i < imageData.data.length; i += 4) {
                                        if (Math.random() < 0.01) {
                                            imageData.data[i] = Math.min(255, imageData.data[i] + Math.floor(Math.random() * 10) - 5);
                                        }
                                    }
                                    context.putImageData(imageData, 0, 0);
                                }
                            } catch (e) {
                                // Ignore canvas errors
                            }
                            return toBlob.call(this, callback, type, quality);
                        };

                        HTMLCanvasElement.prototype.toDataURL = function(type, quality) {
                            try {
                                const canvas = this;
                                const context = canvas.getContext('2d');
                                if (context) {
                                    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                                    for (let i = 0; i < imageData.data.length; i += 4) {
                                        if (Math.random() < 0.01) {
                                            imageData.data[i] = Math.min(255, imageData.data[i] + Math.floor(Math.random() * 10) - 5);
                                        }
                                    }
                                    context.putImageData(imageData, 0, 0);
                                }
                            } catch (e) {
                                // Ignore canvas errors
                            }
                            return toDataURL.call(this, type, quality);
                        };
                    }
                } catch (e) {
                    // Ignore if Canvas is not available
                }

                // Enhanced battery API mock
                // محاكاة محسّنة لـ Battery API
                try {
                    if (navigator.getBattery) {
                        navigator.getBattery = () => Promise.resolve({
                            charging: Math.random() > 0.3, // 70% chance of charging
                            chargingTime: Math.random() > 0.3 ? Math.floor(Math.random() * 3600) : 0,
                            dischargingTime: Math.random() > 0.3 ? Infinity : Math.floor(Math.random() * 7200),
                            level: 0.5 + Math.random() * 0.5 // 50-100% battery
                        });
                    }
                } catch (e) {
                    // Ignore if battery API can't be overridden
                }
                
                // Override Notification permission
                // إعادة تعريف صلاحيات الإشعارات
                try {
                    const originalNotification = window.Notification;
                    if (originalNotification) {
                        Object.defineProperty(originalNotification, 'permission', {
                            get: () => 'default',
                            configurable: true
                        });
                    }
                } catch (e) {
                    // Ignore
                }
                
                // Add realistic connection type
                // إضافة نوع اتصال واقعي
                try {
                    if (navigator.connection || navigator.mozConnection || navigator.webkitConnection) {
                        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
                        if (connection) {
                            Object.defineProperty(connection, 'effectiveType', {
                                get: () => {
                                    const types = ['4g', '3g'];
                                    return types[Math.floor(Math.random() * types.length)];
                                },
                                configurable: true
                            });
                        }
                    }
                } catch (e) {
                    // Ignore
                }
                
                // Override permissions.query to prevent detection
                // إعادة تعريف permissions.query لمنع الاكتشاف
                try {
                    const originalQuery = window.navigator.permissions?.query;
                    if (originalQuery) {
                        window.navigator.permissions.query = function(parameters) {
                            // Return realistic permission states
                            if (parameters.name === 'notifications') {
                                return Promise.resolve({ state: 'default' });
                            }
                            if (parameters.name === 'geolocation') {
                                return Promise.resolve({ state: 'prompt' });
                            }
                            return originalQuery.call(this, parameters);
                        };
                    }
                } catch (e) {
                    // Ignore
                }
                
                // Add realistic device memory (if not already set)
                // إضافة ذاكرة جهاز واقعية (إذا لم يتم تعيينها)
                try {
                    if (!navigator.deviceMemory) {
                        const memoryValues = [2, 4, 8, 16];
                        Object.defineProperty(navigator, 'deviceMemory', {
                            get: () => memoryValues[Math.floor(Math.random() * memoryValues.length)],
                            configurable: true
                        });
                    }
                } catch (e) {
                    // Ignore
                }
                
                // Add realistic hardware concurrency (if not already set)
                // إضافة عدد المعالجات الواقعي (إذا لم يتم تعيينه)
                try {
                    if (!navigator.hardwareConcurrency || navigator.hardwareConcurrency < 2) {
                        const cores = [2, 4, 6, 8];
                        Object.defineProperty(navigator, 'hardwareConcurrency', {
                            get: () => cores[Math.floor(Math.random() * cores.length)],
                            configurable: true
                        });
                    }
                } catch (e) {
                    // Ignore
                }
            });

            logger.info('Anti-detection scripts injected successfully');
        } catch (error) {
            logger.warn('Failed to inject anti-detection scripts', { error: error.message });
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

            await gpmClient.stopProfile(this.profileId);
            logger.info('Profile stopped', { profileId: this.profileId });
            return true;
        } catch (error) {
            logger.warn('Error stopping profile', { 
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
            await gpmClient.deleteProfile(this.profileId);
            logger.info('Profile deleted', { profileId: this.profileId });
            return true;
        } catch (error) {
            logger.error('Failed to delete profile', { 
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
        // Check GPM connection first
        const isConnected = await gpmClient.checkGPMConnection();
        if (!isConnected) {
            throw new Error('GPM API is not available. Please make sure GPM Login is running.');
        }

        // Create profile
        logger.info('Creating GPM profile...');
        const profile = await gpmClient.createProfile(name, proxy);
        
        if (!profile.id) {
            throw new Error('Failed to create profile: No profile ID returned');
        }

        logger.info('Profile created', { 
            profileId: profile.id, 
            name: profile.profile_name || name,
            userAgent: profile.userAgent?.substring(0, 50) + '...' || 'N/A'
        });

        // Wait a bit for profile to be ready
        logger.info('Waiting for profile initialization...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Start profile
        logger.info('Starting GPM profile...');
        const startData = await gpmClient.startProfile(profile.id);
        
        if (!startData.remote_debugging_address) {
            throw new Error('Failed to start profile: No remote debugging address returned');
        }

        // Connect to browser
        const profileManager = new GPMLoginProfile(profile.id, startData.remote_debugging_address);
        await profileManager.start();

        logger.info('Profile created and started', { 
            profileId: profile.id, 
            name: profile.profile_name || name 
        });
        
        return profileManager;
    } catch (error) {
        logger.error('Failed to create and start profile', { error: error.message });
        throw error;
    }
}

export default GPMLoginProfile;

