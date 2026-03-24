/**
 * OMO Captcha Extension Handler
 * معالج OMO Captcha Extension (نسخة محسنة)
 */

import logger from '../utils/logger.js';
import config from '../config.js';

const OMOCAPTCHA_EXTENSION_ID = 'dfjghhjachoacpgpkmbpdlpppeagojhe';
const OMOCAPTCHA_KEY = process.env.OMOCAPTCHA_KEY || 'OMO_ENXZJL877JRCK52ZB2L6FNQFRIOIMEXAUKBZ0V2HOQGCMYQ5N1AV9KRY2ZTOSP1765618401';
const OMO_CAPTCHA_ENABLED = config.omocaptcha.enabled !== false; // Default: true

// Flag to prevent multiple simultaneous setup attempts
let omoSetupInProgress = false;

/**
 * Check if reCAPTCHA extension is installed
 * التحقق من وجود extension
 */
export async function checkRecaptchaExtension(browser) {
    try {
        logger.info('Checking reCAPTCHA Extension', { extensionId: OMOCAPTCHA_EXTENSION_ID });
        
        const tempPage = await browser.newPage();
        try {
            const extensionUrl = `chrome-extension://${OMOCAPTCHA_EXTENSION_ID}/index.html`;
            await tempPage.goto(extensionUrl, { waitUntil: 'domcontentloaded', timeout: 5000 });
            
            const currentUrl = tempPage.url();
            const isInstalled = currentUrl.includes('chrome-extension://') && currentUrl.includes(OMOCAPTCHA_EXTENSION_ID);
            
            await tempPage.close();
            
            if (isInstalled) {
                logger.info('reCAPTCHA extension is installed and accessible');
                return { installed: true, enabled: true, error: null };
            }
            
            return { installed: false, enabled: false, error: 'Extension URL mismatch' };
        } catch (navError) {
            await tempPage.close();
            return { installed: false, enabled: false, error: navError.message };
        }
    } catch (error) {
        logger.error('Error checking reCAPTCHA extension', { error: error.message });
        return { installed: false, enabled: false, error: error.message };
    }
}

/**
 * Open OMO Captcha extension in new tab
 * فتح الإكستنشن في تبويب جديد
 */
export async function openOMOCaptchaExtension(page) {
    let newPage = null;
    try {
        logger.info('Opening OMO Captcha Extension in new tab');
        
        const browser = page.browser();
        if (!browser) {
            throw new Error('Browser context not available');
        }
        
        newPage = await browser.newPage();
        
        const possibleUrls = [
            `chrome-extension://${OMOCAPTCHA_EXTENSION_ID}/index.html`,
            `chrome-extension://${OMOCAPTCHA_EXTENSION_ID}/popup.html`,
            `chrome-extension://${OMOCAPTCHA_EXTENSION_ID}/options.html`,
            `chrome-extension://${OMOCAPTCHA_EXTENSION_ID}/options/index.html`,
            `chrome-extension://${OMOCAPTCHA_EXTENSION_ID}/`
        ];
        
        for (const extensionUrl of possibleUrls) {
            try {
                await newPage.goto(extensionUrl, { waitUntil: 'domcontentloaded', timeout: 6000 });
                await newPage.waitForTimeout(1000);
                
                const currentUrl = newPage.url();
                
                // Check if blocked by error page
                const pageContent = await newPage.content();
                const isBlocked = pageContent.includes('ERR_BLOCKED') || 
                                 pageContent.includes('blocked') ||
                                 pageContent.includes('MostLogin') ||
                                 !currentUrl.includes(OMOCAPTCHA_EXTENSION_ID);
                
                if (isBlocked) {
                    logger.warn('OMO Captcha extension is blocked or not accessible', { 
                        url: currentUrl,
                        reason: 'Extension may be blocked by browser or extension manager'
                    });
                    continue;
                }
                
                if (currentUrl.includes('chrome-extension://') && currentUrl.includes(OMOCAPTCHA_EXTENSION_ID)) {
                    logger.info('OMO Captcha extension opened successfully');
                    return { page: newPage, opened: true };
                }
            } catch (navError) {
                // Check if error is due to blocking
                const errorMsg = navError.message.toLowerCase();
                if (errorMsg.includes('blocked') || errorMsg.includes('net::err_blocked')) {
                    logger.warn('OMO Captcha extension access blocked', { 
                        error: navError.message,
                        hint: 'Extension may not be installed or is blocked by browser security'
                    });
                }
                continue;
            }
        }
        
        if (newPage) {
            await newPage.close().catch(() => {});
        }
        logger.warn('Failed to open OMO Captcha extension');
        return { page: null, opened: false };
    } catch (error) {
        logger.error('Error opening OMO Captcha extension', { error: error.message });
        if (newPage) {
            await newPage.close().catch(() => {});
        }
        return { page: null, opened: false };
    }
}

/**
 * Try to set API key using Chrome Extension API (without opening extension page)
 * محاولة تعيين API key باستخدام Chrome Extension API بدون فتح صفحة الإكستنشن
 */
export async function setOMOCaptchaKeyViaAPI(page) {
    try {
        logger.info('Attempting to set OMO Captcha API key via Chrome Extension API');
        
        // Navigate to a regular page to access Chrome APIs
        await page.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 5000 });
        await page.waitForTimeout(500);
        
        const result = await Promise.race([
            page.evaluate((extId, apiKey) => {
                return new Promise((resolve) => {
                    try {
                        // Method 1: Try to send message to extension (most reliable)
                        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                            chrome.runtime.sendMessage(extId, { 
                                type: 'setApiKey', 
                                apiKey: apiKey,
                                key: apiKey 
                            }, (response) => {
                                if (chrome.runtime.lastError) {
                                    // Try chrome.storage as fallback
                                    if (typeof chrome.storage !== 'undefined' && chrome.storage.local) {
                                        chrome.storage.local.set({ apiKey: apiKey, key: apiKey, omocaptcha_key: apiKey }, () => {
                                            if (chrome.runtime.lastError) {
                                                resolve({ success: false, error: chrome.runtime.lastError.message });
                                            } else {
                                                resolve({ method: 'chrome.storage', success: true });
                                            }
                                        });
                                    } else {
                                        resolve({ success: false, error: chrome.runtime.lastError.message });
                                    }
                                } else {
                                    resolve({ method: 'chrome.runtime.sendMessage', success: true, response: response });
                                }
                            });
                            return;
                        }
                        
                        // Method 2: Try chrome.storage API directly
                        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                            chrome.storage.local.set({ apiKey: apiKey, key: apiKey, omocaptcha_key: apiKey }, () => {
                                if (chrome.runtime.lastError) {
                                    resolve({ success: false, error: chrome.runtime.lastError.message });
                                } else {
                                    resolve({ method: 'chrome.storage', success: true });
                                }
                            });
                            return;
                        }
                        
                        resolve({ success: false, error: 'Chrome APIs not available' });
                    } catch (error) {
                        resolve({ success: false, error: error.message });
                    }
                });
            }, OMOCAPTCHA_EXTENSION_ID, OMOCAPTCHA_KEY),
            new Promise((resolve) => setTimeout(() => resolve({ success: false, error: 'Timeout' }), 3000))
        ]);
        
        if (result && result.success) {
            logger.info('OMO Captcha API key set successfully via Chrome Extension API', { method: result.method });
            return true;
        }
        
        logger.debug('Failed to set API key via Chrome Extension API');
        return false;
    } catch (error) {
        logger.debug('Error setting API key via Chrome Extension API', { error: error.message });
        return false;
    }
}

/**
 * Enter API key into OMO Captcha extension
 * إدخال API key في الإكستنشن
 */
export async function enterOMOCaptchaKey(page) {
    try {
        logger.info('Entering OMO Captcha API Key');
        
        const xpath = '/html/body/div[1]/div/div[1]/div[2]/div[4]/input';
        
        try {
            await page.waitForXPath(xpath, { timeout: 8000 });
            const inputElements = await page.$x(xpath);
            
            if (!inputElements || inputElements.length === 0) {
                throw new Error('Input element not found with XPath');
            }
            
            const inputElement = inputElements[0];
            
            await page.evaluate((el) => {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, inputElement);
            
            await page.waitForTimeout(200);
            
            await inputElement.focus();
            await page.waitForTimeout(100);
            await inputElement.click({ clickCount: 3 });
            await page.waitForTimeout(200);
            await page.keyboard.press('Backspace');
            await page.waitForTimeout(100);
            
            // Use clipboard for faster paste
            await page.evaluate((key) => {
                navigator.clipboard.writeText(key).catch(() => {
                    const textArea = document.createElement('textarea');
                    textArea.value = key;
                    textArea.style.position = 'fixed';
                    textArea.style.opacity = '0';
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                });
            }, OMOCAPTCHA_KEY);
            
            await page.waitForTimeout(200);
            await page.keyboard.down('Control');
            await page.keyboard.press('v');
            await page.keyboard.up('Control');
            
            await page.waitForTimeout(500);
            
            const enteredValue = await page.evaluate((el) => el.value || el.textContent || '', inputElement);
            
            if (enteredValue === OMOCAPTCHA_KEY || enteredValue.includes(OMOCAPTCHA_KEY.substring(0, 20))) {
                logger.info('API key verified');
                return true;
            }
            
            logger.warn('Key verification failed, but continuing');
            return true;
        } catch (xpathError) {
            logger.debug('XPath method failed, trying alternative selectors');
            
            const selectors = [
                'input[type="text"]',
                'input[placeholder*="key" i]',
                'input[placeholder*="API" i]',
                'input'
            ];
            
            for (const selector of selectors) {
                try {
                    await page.waitForSelector(selector, { timeout: 2000 });
                    const input = await page.$(selector);
                    if (input) {
                        await input.click({ clickCount: 3 });
                        await page.waitForTimeout(200);
                        
                        await page.evaluate((key) => {
                            navigator.clipboard.writeText(key).catch(() => {
                                const textArea = document.createElement('textarea');
                                textArea.value = key;
                                textArea.style.position = 'fixed';
                                textArea.style.opacity = '0';
                                document.body.appendChild(textArea);
                                textArea.select();
                                document.execCommand('copy');
                                document.body.removeChild(textArea);
                            });
                        }, OMOCAPTCHA_KEY);
                        
                        await page.waitForTimeout(200);
                        await page.keyboard.down('Control');
                        await page.keyboard.press('v');
                        await page.keyboard.up('Control');
                        
                        logger.info(`API key pasted using selector: ${selector}`);
                        return true;
                    }
                } catch (e) {
                    continue;
                }
            }
            
            logger.warn('Could not find input field');
            return false;
        }
    } catch (error) {
        logger.error('Error entering OMO Captcha key', { error: error.message });
        return false;
    }
}

/**
 * Click refresh button to activate extension
 * الضغط على زر التحديث لتفعيل الإكستنشن
 */
export async function clickRecaptchaRefreshButton(page) {
    try {
        logger.info('Clicking reCAPTCHA Refresh Button');
        
        const selectors = [
            'button.chakra-button',
            'button[type="button"]',
            'div.css-ls19pz button'
        ];
        
        for (const selector of selectors) {
            try {
                await page.waitForSelector(selector, { timeout: 5000 });
                const button = await page.$(selector);
                
                if (button) {
                    const isRefreshButton = await page.evaluate((btn) => {
                        const svg = btn.querySelector('svg');
                        if (!svg) return false;
                        return svg.getAttribute('viewBox') === '0 0 512 512' || 
                               svg.querySelector('path[d*="M400"]');
                    }, button);
                    
                    if (isRefreshButton) {
                        await page.evaluate((btn) => {
                            btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }, button);
                        
                        await page.waitForTimeout(200);
                        await button.click();
                        logger.info('Refresh button clicked (first time)');
                        
                        await page.waitForTimeout(800);
                        await button.click();
                        logger.info('Refresh button clicked (second time)');
                        
                        await page.waitForTimeout(800);
                        return true;
                    }
                }
            } catch (e) {
                continue;
            }
        }
        
        // Try XPath
        try {
            const xpath = '//button[.//svg[@viewBox="0 0 512 512"]]';
            await page.waitForXPath(xpath, { timeout: 5000 });
            const buttonElements = await page.$x(xpath);
            
            if (buttonElements && buttonElements.length > 0) {
                const button = buttonElements[0];
                await page.evaluate((btn) => {
                    btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, button);
                
                await page.waitForTimeout(200);
                await button.click();
                await page.waitForTimeout(500);
                await button.click();
                logger.info('Refresh button clicked using XPath');
                return true;
            }
        } catch (xpathError) {
            logger.debug('XPath method failed', { error: xpathError.message });
        }
        
        logger.warn('Could not find refresh button');
        return false;
    } catch (error) {
        logger.error('Error clicking refresh button', { error: error.message });
        return false;
    }
}

/**
 * Complete setup of OMO Captcha extension
 * إعداد كامل للإكستنشن
 */
export async function setupOMOCaptchaExtension(page) {
    // Check if OMO Captcha setup is disabled via environment variable
    if (!OMO_CAPTCHA_ENABLED) {
        logger.info('OMO Captcha extension setup is disabled (SETUP_OMO_CAPTCHA=false) - skipping');
        return true;
    }
    
    if (omoSetupInProgress) {
        logger.warn('OMO Captcha extension setup already in progress');
        return true;
    }
    
    let omoPage = null;
    try {
        omoSetupInProgress = true;
        logger.info('Setting up OMO Captcha Extension');
        
        // Try Method 1: Set API key via Chrome Extension API (without opening extension page)
        logger.info('Attempting to set API key via Chrome Extension API...');
        const apiKeySet = await setOMOCaptchaKeyViaAPI(page);
        
        if (apiKeySet) {
            logger.info('OMO Captcha API key set successfully via Chrome Extension API - no need to open extension page');
            omoSetupInProgress = false;
            return true;
        }
        
        logger.debug('Chrome Extension API method failed, trying to open extension page...');
        
        // Method 2: Open extension page and enter key manually
        const { page: newPage, opened } = await openOMOCaptchaExtension(page);
        omoPage = newPage;
        
        if (!opened || !omoPage) {
            logger.warn('Failed to open OMO Captcha extension - continuing without it', {
                hint: 'Extension may be blocked or not installed. Account creation will continue without OMO Captcha.'
            });
            omoSetupInProgress = false;
            // Return true to allow continuing without OMO extension
            return true;
        }
        
        await omoPage.waitForTimeout(1000);
        
        // Step 2: Enter API key
        const keyEntered = await enterOMOCaptchaKey(omoPage);
        if (!keyEntered) {
            logger.warn('Failed to enter OMO Captcha key - continuing without it', {
                hint: 'Account creation will continue, but reCAPTCHA may require manual solving'
            });
            try {
                if (omoPage && !omoPage.isClosed()) {
                    await omoPage.close();
                }
            } catch (closeError) {
                // Ignore close errors
            }
            omoSetupInProgress = false;
            // Return true to allow continuing without OMO extension
            return true;
        }
        
        await omoPage.waitForTimeout(500);
        
        // Step 3: Click refresh button (FIXED: removed comment and properly call function)
        const refreshClicked = await clickRecaptchaRefreshButton(omoPage);
        if (!refreshClicked) {
            logger.warn('Could not click refresh button, but continuing');
        }
        
        await omoPage.waitForTimeout(2000);
        
        // Close extension tab
        try {
            if (omoPage && !omoPage.isClosed()) {
                await omoPage.close();
            }
        } catch (closeError) {
            logger.warn('Error closing OMO tab', { error: closeError.message });
        }
        
        logger.info('OMO Captcha extension setup completed successfully');
        omoSetupInProgress = false;
        return true;
    } catch (error) {
        logger.error('Error setting up OMO Captcha extension', { error: error.message });
        if (omoPage) {
            try {
                if (!omoPage.isClosed()) {
                    await omoPage.close();
                }
            } catch (closeError) {
                // Ignore
            }
        }
        omoSetupInProgress = false;
        return false;
    }
}


