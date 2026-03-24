/**
 * Setup OMO Captcha Extension
 * Adds the extension, opens it, and enters the API key
 */

const OMOCAPTCHA_EXTENSION_ID = 'dfjghhjachoacpgpkmbpdlpppeagojhe';
const OMOCAPTCHA_KEY = process.env.OMOCAPTCHA_KEY || '';

/**
 * Check if reCAPTCHA extension is installed and accessible in the browser
 * التحقق من وجود extension لفك reCAPTCHA في المتصفح
 * @param {Browser} browser - Puppeteer browser object
 * @returns {Promise<{installed: boolean, enabled: boolean, error?: string}>} Extension status
 */
export async function checkRecaptchaExtension(browser) {
    try {
        console.log('\n=== Checking reCAPTCHA Extension ===');
        console.log(`Extension ID: ${OMOCAPTCHA_EXTENSION_ID}`);
        
        // Create a temporary page to check extension
        const tempPage = await browser.newPage();
        
        try {
            // Try to navigate to extension URL
            const extensionUrl = `chrome-extension://${OMOCAPTCHA_EXTENSION_ID}/index.html`;
            
            try {
                await tempPage.goto(extensionUrl, { 
                    waitUntil: 'domcontentloaded', 
                    timeout: 5000 
                });
                
                const currentUrl = tempPage.url();
                
                // Check if we successfully navigated to extension
                if (currentUrl.includes('chrome-extension://') && currentUrl.includes(OMOCAPTCHA_EXTENSION_ID)) {
                    console.log('✓ reCAPTCHA extension is installed and accessible');
                    
                    // Try to check if extension is enabled by looking for extension content
                    const hasExtensionContent = await tempPage.evaluate(() => {
                        // Check for common extension elements
                        return document.body && document.body.innerHTML.length > 0;
                    });
                    
                    await tempPage.close();
                    
                    return {
                        installed: true,
                        enabled: hasExtensionContent,
                        error: null
                    };
                } else {
                    console.log(`⚠ Extension URL mismatch. Got: ${currentUrl}`);
                    await tempPage.close();
                    return {
                        installed: false,
                        enabled: false,
                        error: 'Extension URL mismatch'
                    };
                }
            } catch (navError) {
                // If navigation fails, extension might not be installed
                console.log(`⚠ Could not navigate to extension: ${navError.message}`);
                await tempPage.close();
                
                // Try alternative check using chrome.runtime
                try {
                    const altPage = await browser.newPage();
                    await altPage.goto('about:blank');
                    
                    const extensionCheck = await altPage.evaluate((extId) => {
                        try {
                            // Try to check if extension exists via chrome.runtime
                            if (typeof chrome !== 'undefined' && chrome.runtime) {
                                return chrome.runtime.getURL ? true : false;
                            }
                            return false;
                        } catch (e) {
                            return false;
                        }
                    }, OMOCAPTCHA_EXTENSION_ID);
                    
                    await altPage.close();
                    
                    if (!extensionCheck) {
                        return {
                            installed: false,
                            enabled: false,
                            error: 'Extension not found in browser'
                        };
                    }
                } catch (altError) {
                    return {
                        installed: false,
                        enabled: false,
                        error: `Extension check failed: ${navError.message}`
                    };
                }
                
                return {
                    installed: false,
                    enabled: false,
                    error: `Navigation failed: ${navError.message}`
                };
            }
        } catch (error) {
            await tempPage.close().catch(() => {});
            return {
                installed: false,
                enabled: false,
                error: error.message
            };
        }
    } catch (error) {
        console.error('✗ Error checking reCAPTCHA extension:', error.message);
        return {
            installed: false,
            enabled: false,
            error: error.message
        };
    }
}

/**
 * Open OMO Captcha extension page in a NEW tab/window
 * Opens extension in a new page instead of using the current page
 * @param {Page} page - Puppeteer page object (used to get browser context)
 * @returns {Promise<{page: Page, opened: boolean}>} New page object and success status
 */
export async function openOMOCaptchaExtension(page) {
    let newPage = null;
    try {
        console.log('\n=== Opening OMO Captcha Extension in NEW Tab ===');
        console.log(`Extension ID: ${OMOCAPTCHA_EXTENSION_ID}`);
        
        // Get browser from current page to create new page
        const browser = page.browser();
        if (!browser) {
            throw new Error('Browser context not available');
        }
        
        // Create a NEW page/tab for OMO extension
        console.log('Creating new tab for OMO Captcha extension...');
        newPage = await browser.newPage();
        
        // Try multiple possible extension URLs
        const possibleUrls = [
            `chrome-extension://${OMOCAPTCHA_EXTENSION_ID}/index.html`,
            `chrome-extension://${OMOCAPTCHA_EXTENSION_ID}/popup.html`,
            `chrome-extension://${OMOCAPTCHA_EXTENSION_ID}/options.html`,
            `chrome-extension://${OMOCAPTCHA_EXTENSION_ID}/options/index.html`,
            `chrome-extension://${OMOCAPTCHA_EXTENSION_ID}/`
        ];
        
        let opened = false;
        for (let i = 0; i < possibleUrls.length; i++) {
            const extensionUrl = possibleUrls[i];
            try {
                console.log(`[${i + 1}/${possibleUrls.length}] Trying to navigate to: ${extensionUrl}`);
                await newPage.goto(extensionUrl, { 
                    waitUntil: 'domcontentloaded', 
                    timeout: 8000 
                });
                
                // Wait a bit for page to load
                await newPage.waitForTimeout(1500);
                
                const currentUrl = newPage.url();
                console.log(`Current URL after navigation: ${currentUrl}`);
                
                if (currentUrl.includes('chrome-extension://') && currentUrl.includes(OMOCAPTCHA_EXTENSION_ID)) {
                    console.log('✓ OMO Captcha extension opened successfully in new tab');
                    opened = true;
                    break;
                } else {
                    console.log(`⚠ URL mismatch. Expected extension URL, got: ${currentUrl}`);
                }
            } catch (navError) {
                console.log(`⚠ Navigation failed for ${extensionUrl}: ${navError.message}`);
                // Try next URL
                continue;
            }
        }
        
        if (!opened) {
            console.error('✗ Failed to open OMO Captcha extension with all methods');
            console.log('⚠ Make sure the extension is installed in the GPM profile');
            // Close the new page if we failed
            if (newPage) {
                await newPage.close().catch(() => {});
                newPage = null;
            }
        }
        
        return { page: newPage, opened: opened };
    } catch (error) {
        console.error('✗ Error opening OMO Captcha extension:', error.message);
        // Close the new page if there was an error
        if (newPage) {
            await newPage.close().catch(() => {});
        }
        return { page: null, opened: false };
    }
}

/**
 * Enter API key into OMO Captcha extension
 * @param {Page} page - Puppeteer page object
 * @returns {Promise<boolean>} True if key entered successfully
 */
export async function enterOMOCaptchaKey(page) {
    try {
        console.log('\n=== Entering OMO Captcha API Key ===');
        console.log(`Key: ${OMOCAPTCHA_KEY.substring(0, 20)}...`);
        
        // Wait for the input field to be available
        // Using XPath: /html/body/div[1]/div/div[1]/div[2]/div[4]/input
        const xpath = '/html/body/div[1]/div/div[1]/div[2]/div[4]/input';
        
        console.log(`Waiting for input field with XPath: ${xpath}...`);
        
        try {
            // Wait for the element using XPath
            await page.waitForXPath(xpath, { timeout: 10000 });
            console.log('✓ Input field found using XPath');
            
            // Get the element using XPath
            const inputElements = await page.$x(xpath);
            
            if (!inputElements || inputElements.length === 0) {
                throw new Error('Input element not found with XPath');
            }
            
            const inputElement = inputElements[0];
            
            // Scroll element into view
            await page.evaluate((el) => {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, inputElement);
            
            await page.waitForTimeout(200);
            
            // Focus and clear the field first
            await inputElement.focus();
            await page.waitForTimeout(100);
            await inputElement.click({ clickCount: 3 });
            await page.waitForTimeout(200);
            
            // Clear using keyboard
            await page.keyboard.press('Backspace');
            await page.waitForTimeout(100);
            
            // Use clipboard to paste the key (much faster than typing)
            await page.evaluate((key) => {
                // Copy to clipboard
                navigator.clipboard.writeText(key).catch(() => {
                    // Fallback: use execCommand
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
            
            await page.waitForTimeout(300);
            
            // Paste using Ctrl+V
            await page.keyboard.down('Control');
            await page.keyboard.press('v');
            await page.keyboard.up('Control');
            
            console.log('✓ API key pasted');
            
            // Wait a bit to ensure it's saved
            await page.waitForTimeout(600);
            
            // Verify the key was entered
            const enteredValue = await page.evaluate((el) => {
                return el.value || el.textContent || '';
            }, inputElement);
            
            if (enteredValue === OMOCAPTCHA_KEY || enteredValue.includes(OMOCAPTCHA_KEY.substring(0, 20))) {
                console.log('✓ API key verified');
                return true;
            } else {
                console.log(`⚠ Key verification failed. Expected: ${OMOCAPTCHA_KEY.substring(0, 20)}..., Got: ${enteredValue.substring(0, 20)}...`);
                console.log('⚠ Continuing anyway...');
                return true;
            }
        } catch (xpathError) {
            console.log('⚠ XPath method failed, trying alternative selectors...');
            
            // Try alternative: find input by various methods
            const selectors = [
                'input[type="text"]',
                'input[placeholder*="key"]',
                'input[placeholder*="Key"]',
                'input[placeholder*="API"]',
                'input',
                'div input',
                'form input'
            ];
            
            let inputFound = false;
            for (const selector of selectors) {
                try {
                    await page.waitForSelector(selector, { timeout: 2000 });
                    const input = await page.$(selector);
                    if (input) {
                        await input.click({ clickCount: 3 });
                        await page.waitForTimeout(200);
                        
                        // Use clipboard paste instead of type
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
                        
                        await page.waitForTimeout(300);
                        await page.keyboard.down('Control');
                        await page.keyboard.press('v');
                        await page.keyboard.up('Control');
                        
                        console.log(`✓ API key pasted using selector: ${selector}`);
                        inputFound = true;
                        break;
                    }
                } catch (e) {
                    // Try next selector
                    continue;
                }
            }
            
            if (!inputFound) {
                console.log('⚠ Could not find input field, but continuing...');
                return false;
            }
            
            return true;
        }
    } catch (error) {
        console.error('✗ Error entering OMO Captcha key:', error.message);
        return false;
    }
}

/**
 * Click the refresh/reload button in OMO Captcha extension
 * الضغط على زر التشغيل في extension reCAPTCHA
 * @param {Page} page - Puppeteer page object
 * @returns {Promise<boolean>} True if button was clicked successfully
 */
export async function clickRecaptchaRefreshButton(page) {
    try {
        console.log('\n=== Clicking reCAPTCHA Refresh Button ===');
        
        // Try multiple selectors to find the refresh button
        const selectors = [
            'button.chakra-button', // Main button class
            'button[type="button"]', // Button type
            'button svg[viewBox="0 0 512 512"]', // Button with specific SVG
            'button:has(svg[viewBox="0 0 512 512"])', // Button containing specific SVG
            'div.css-ls19pz button', // Button in specific container
            'button:has(path[d*="M400 54.1"])' // Button with specific path
        ];
        
        let buttonFound = false;
        for (const selector of selectors) {
            try {
                // Wait for button to be available
                await page.waitForSelector(selector, { timeout: 7000 });
                const button = await page.$(selector);
                
                if (button) {
                    // Verify it's the refresh button by checking for SVG with refresh icon
                    const isRefreshButton = await page.evaluate((btn) => {
                        const svg = btn.querySelector('svg');
                        if (!svg) return false;
                        
                        // Check for refresh icon path (circular arrow)
                        const path = svg.querySelector('path');
                        if (path && path.getAttribute('d') && path.getAttribute('d').includes('M400 54.1')) {
                            return true;
                        }
                        
                        // Alternative: check for viewBox="0 0 512 512" which is refresh icon
                        if (svg.getAttribute('viewBox') === '0 0 512 512') {
                            return true;
                        }
                        
                        return false;
                    }, button);
                    
                    if (isRefreshButton) {
                        console.log(`✓ Found refresh button using selector: ${selector}`);
                        
                        // Scroll button into view
                        await page.evaluate((btn) => {
                            btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }, button);
                        
                        await page.waitForTimeout(200);
                        
                        // Click the button first time
                        await button.click();
                        console.log('✓ Refresh button clicked (first time)');
                        
                        // Wait a bit before second click
                        await page.waitForTimeout(900);
                        
                        // Click the button second time
                        await button.click();
                        console.log('✓ Refresh button clicked (second time)');
                        
                        buttonFound = true;
                        break;
                    }
                }
            } catch (e) {
                // Try next selector
                continue;
            }
        }
        
        // Alternative: Try XPath to find button with refresh SVG
        if (!buttonFound) {
            try {
                console.log('Trying XPath to find refresh button...');
                const xpath = '//button[.//svg[@viewBox="0 0 512 512"]]';
                await page.waitForXPath(xpath, { timeout: 7000 });
                const buttonElements = await page.$x(xpath);
                
                if (buttonElements && buttonElements.length > 0) {
                    const button = buttonElements[0];
                    
                    // Scroll button into view
                    await page.evaluate((btn) => {
                        btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, button);
                    
                    await page.waitForTimeout(200);
                    
                    // Click the button first time
                    await button.click();
                    console.log('✓ Refresh button clicked using XPath (first time)');
                    
                    // Wait a bit before second click
                    await page.waitForTimeout(500);
                    
                    // Click the button second time
                    await button.click();
                    console.log('✓ Refresh button clicked using XPath (second time)');
                    buttonFound = true;
                }
            } catch (xpathError) {
                console.log(`⚠ XPath method failed: ${xpathError.message}`);
            }
        }
        
        // Last resort: Try clicking any button in the header area
        if (!buttonFound) {
            try {
                console.log('Trying to find button in header area...');
                const headerButton = await page.evaluate(() => {
                    // Find the header div
                    const header = document.querySelector('.css-ls19pz') || document.querySelector('div[class*="css-"]');
                    if (!header) return null;
                    
                    // Find button in header
                    const button = header.querySelector('button');
                    if (button) {
                        // Check if it has refresh icon
                        const svg = button.querySelector('svg');
                        if (svg && (svg.getAttribute('viewBox') === '0 0 512 512' || svg.querySelector('path[d*="M400"]'))) {
                            return true;
                        }
                    }
                    return false;
                });
                
                if (headerButton) {
                    // First click
                    await page.evaluate(() => {
                        const header = document.querySelector('.css-ls19pz') || document.querySelector('div[class*="css-"]');
                        const button = header?.querySelector('button');
                        if (button) {
                            button.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            button.click();
                        }
                    });
                    console.log('✓ Refresh button clicked in header area (first time)');
                    
                    // Wait a bit before second click
                    await page.waitForTimeout(900);
                    
                    // Second click
                    await page.evaluate(() => {
                        const header = document.querySelector('.css-ls19pz') || document.querySelector('div[class*="css-"]');
                        const button = header?.querySelector('button');
                        if (button) {
                            button.click();
                        }
                    });
                    console.log('✓ Refresh button clicked in header area (second time)');
                    buttonFound = true;
                }
            } catch (headerError) {
                console.log(`⚠ Header button method failed: ${headerError.message}`);
            }
        }
        
        if (!buttonFound) {
            console.log('⚠ Could not find refresh button, but continuing...');
            return false;
        }
        
        // Wait 0.5 second after clicking refresh button (second time) for extension to activate
        console.log('Waiting 0.5 second for extension to activate after second click...');
        await page.waitForTimeout(900);
        
        console.log('✓ Refresh button clicked twice and extension activated');
        return true;
    } catch (error) {
        console.error('✗ Error clicking refresh button:', error.message);
        return false;
    }
}

// Flag to prevent multiple simultaneous OMO setup attempts
let omoSetupInProgress = false;

/**
 * Complete setup of OMO Captcha extension
 * Opens extension in NEW tab and enters API key, then closes the tab
 * @param {Page} page - Puppeteer page object (used to get browser context)
 * @returns {Promise<boolean>} True if setup completed successfully
 */
export async function setupOMOCaptchaExtension(page) {
    // Prevent multiple simultaneous setup attempts
    if (omoSetupInProgress) {
        console.log('⚠ OMO Captcha extension setup already in progress, skipping...');
        return true;
    }
    
    let omoPage = null;
    try {
        omoSetupInProgress = true;
        console.log('\n=== Setting up OMO Captcha Extension ===');
        console.log(`API Key: ${OMOCAPTCHA_KEY.substring(0, 30)}...`);
        
        // Step 1: Open extension in NEW tab
        console.log('\n[Step 1/3] Opening OMO Captcha extension in new tab...');
        const { page: newPage, opened } = await openOMOCaptchaExtension(page);
        omoPage = newPage;
        
        if (!opened || !omoPage) {
            console.error('✗ Failed to open OMO Captcha extension');
            console.log('⚠ Please make sure the extension is installed in the GPM profile');
            console.log('⚠ Extension ID should be: dfjghhjachoacpgpkmbpdlpppeagojhe');
            omoSetupInProgress = false;
            return false;
        }
        
        // Wait a bit for extension to load completely
        console.log('Waiting for extension to load...');
        await omoPage.waitForTimeout(1000);
        
        // Step 2: Enter API key
        console.log('\n[Step 2/3] Entering OMO Captcha API key...');
        const keyEntered = await enterOMOCaptchaKey(omoPage);
        if (!keyEntered) {
            console.error('✗ Failed to enter OMO Captcha key');
            console.log('⚠ Please check the API key format and extension interface');
            // Close the OMO page before returning
            await omoPage.close().catch(() => {});
            omoPage = null;
            omoSetupInProgress = false;
            return false;
        }
        
        // Wait a bit after entering key to ensure it's saved
        await omoPage.waitForTimeout(600);
        
        // Step 3: Click refresh button to activate extension
        console.log('\n[Step 3/3] Clicking refresh button to activate extension...');
      //  const refreshClicked = await clickRecaptchaRefreshButton(omoPage);
        if (!refreshClicked) {
            console.log('⚠ Could not click refresh button, but continuing...');
        }
        
        // Wait 3 seconds after clicking refresh to ensure extension is activated
        console.log('Waiting 3 seconds for extension to activate...');
        await omoPage.waitForTimeout(3000);
        
        // Close the OMO extension tab after setup is complete
        console.log('Closing OMO Captcha extension tab...');
        try {
            if (omoPage && !omoPage.isClosed()) {
                await omoPage.close();
            }
        } catch (closeError) {
            console.log(`⚠ Error closing OMO tab: ${closeError.message}`);
        }
        omoPage = null;
        
        console.log('\n✓ OMO Captcha extension setup completed successfully');
        console.log('✓ Extension is ready to solve CAPTCHAs\n');
        omoSetupInProgress = false;
        return true;
    } catch (error) {
        console.error('✗ Error setting up OMO Captcha extension:', error.message);
        console.error('Stack:', error.stack);
        // Make sure to close the OMO page if there was an error
        if (omoPage) {
            try {
                if (!omoPage.isClosed()) {
                    await omoPage.close();
                }
            } catch (closeError) {
                // Ignore close errors
            }
        }
        omoSetupInProgress = false;
        return false;
    }
}

