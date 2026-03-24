/**
 * Gmail Account Creator
 * منشئ حسابات Gmail
 */

import logger from '../utils/logger.js';
import { detectGmailPage, waitForElement, elementExists } from './page-detector.js';
import { setupOMOCaptchaExtension } from '../captcha/omo-handler.js';
// Use unified SMS provider wrapper (supports multiple providers via SMS_PROVIDER env var)
import * as smsApi from '../providers/sms-provider.js';
import { SMS_VERIFY_COUNTRIES } from '../providers/sms-provider.js';
import config from '../config.js';
import humanBehavior from '../utils/human-behavior.js';

// Destructure human behavior functions for easier use
// استخراج دوال السلوك البشري لاستخدام أسهل
const {
    humanSleep,
    humanClick,
    humanMouseMove,
    humanScroll,
    humanScrollToElement,
    humanType,
    humanWait,
    explorePageRandomly,
    idleMouseMovement,
    simulateReading,
    performRandomAction,
    getHumanDelay,
    randomDelay
} = humanBehavior;

/**
 * Get country selection based on config
 * الحصول على اختيار الدولة بناءً على الإعدادات
 */
function getCountrySelection() {
    // Check which SMS provider is being used
    const smsProvider = (process.env.SMS_PROVIDER || 'sms-verification').toLowerCase().trim();
    
    // If using 5SIM Legacy, use FIVESIM_COUNTRY from .env directly
    // إذا كان يستخدم 5SIM Legacy، استخدم FIVESIM_COUNTRY من .env مباشرة
    if (smsProvider === 'fivesim-legacy' || smsProvider === '5sim-legacy') {
        const fivesimCountry = process.env.FIVESIM_COUNTRY || 'england';
        const selectedCountry = {
            code: fivesimCountry, // Use country name directly for 5SIM Legacy
            name: fivesimCountry.charAt(0).toUpperCase() + fivesimCountry.slice(1)
        };
        const countries = [selectedCountry];
        
        logger.info('Using 5SIM Legacy - Country from .env (FIVESIM_COUNTRY)', { 
            country: selectedCountry.name,
            countryParam: fivesimCountry
        });
        
        return {
            countries,
            selectedCountry
        };
    }
    
    // For SMS Verification, use country selection from config
    // لـ SMS Verification، استخدم اختيار الدولة من الإعدادات
    const countryCodes = config.smsVerify.countries || [53, 95]; // Default: Saudi Arabia and UAE
    
    // Map country codes to names using SMS_VERIFY_COUNTRIES
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
        [SMS_VERIFY_COUNTRIES.LEBANON]: 'Lebanon',
        // Add more as needed
    };
    
    const countries = countryCodes.map(code => ({
        code: code,
        name: countryMap[code] || `Country ${code}`
    }));
    
    // Select random country from configured list
    const selectedCountry = countries[Math.floor(Math.random() * countries.length)];
    
    logger.info('Available countries from config', { 
        countries: countries.map(c => `${c.name} (${c.code})`).join(', '),
        selected: `${selectedCountry.name} (${selectedCountry.code})`
    });
    
    return {
        countries,
        selectedCountry
    };
}

const GMAIL_URL = 'https://gmail.com';
const GMAIL_SIGNUP_URL = 'https://accounts.google.com/signup';

/**
 * Human-like typing with random delays, occasional mistakes, and natural pauses
 * كتابة شبيهة بالإنسان مع تأخير عشوائي، أخطاء محتملة، وتوقفات طبيعية
 * @param {Object} page - Puppeteer page object
 * @param {Object} input - Puppeteer element handle
 * @param {string} text - Text to type
 * @param {Object} options - Options for typing behavior
 * @param {number} options.minDelay - Minimum delay between characters (default: 30)
 * @param {number} options.maxDelay - Maximum delay between characters (default: 120)
 * @param {number} options.mistakeChance - Chance of making a mistake (0-1, default: 0.1)
 * @param {number} options.pauseChance - Chance of pausing mid-typing (0-1, default: 0.15)
 */
async function humanLikeType(page, input, text, options = {}) {
    const {
        minDelay = 30,
        maxDelay = 120,
        mistakeChance = 0.1,
        pauseChance = 0.15
    } = options;

    try {
        logger.debug('Starting human-like typing', { textLength: text.length, text: text.substring(0, 20) + '...' });
        
        // Focus the input first
        await input.focus();
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 100));

        // Clear existing content - try multiple methods
        try {
            await input.click({ clickCount: 3 });
            await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 50));
            await page.keyboard.press('Delete');
            await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 50));
            
            // Also try clearing via JavaScript
            await input.evaluate(el => {
                el.value = '';
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            });
            await new Promise(resolve => setTimeout(resolve, 50));
        } catch (clearError) {
            logger.debug('Error clearing input, continuing anyway', { error: clearError.message });
        }

        // Type each character with human-like behavior
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            
            // Occasional mistake: type wrong character then delete and retype
            if (Math.random() < mistakeChance && i > 0 && i < text.length - 1) {
                // Type a wrong character
                const wrongChars = 'abcdefghijklmnopqrstuvwxyz0123456789';
                const wrongChar = wrongChars[Math.floor(Math.random() * wrongChars.length)];
                await input.type(wrongChar, { delay: 50 + Math.random() * 50 });
                await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 100));
                
                // Realize mistake and delete
                await page.keyboard.press('Backspace');
                await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 100));
            }
            
            // Type the correct character
            const delay = minDelay + Math.random() * (maxDelay - minDelay);
            await input.type(char, { delay: delay });
            
            // Occasional pause (like human thinking or looking at keyboard)
            if (Math.random() < pauseChance) {
                const pauseDuration = 200 + Math.random() * 300; // 200-500ms pause
                await new Promise(resolve => setTimeout(resolve, pauseDuration));
            }
            
            // Longer pause after space or special characters
            if (char === ' ' || char === '.' || char === '@') {
                await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 100));
            }
        }
        
        // Final small delay to simulate human finishing typing
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
        
        // Verify the text was entered
        const enteredValue = await input.evaluate(el => el.value);
        logger.debug('Human-like typing completed', { 
            expected: text, 
            entered: enteredValue,
            match: enteredValue === text 
        });
        
        // If text doesn't match, try to fix it
        if (enteredValue !== text) {
            logger.warn('Text mismatch after typing, attempting to fix', { 
                expected: text, 
                entered: enteredValue 
            });
            // Clear and retry once
            await input.click({ clickCount: 3 });
            await page.keyboard.press('Delete');
            await new Promise(resolve => setTimeout(resolve, 100));
            await input.type(text, { delay: minDelay });
        }
    } catch (error) {
        // Fallback to simple typing if human-like typing fails
        logger.warn('Human-like typing failed, falling back to simple typing', { 
            error: error.message,
            textLength: text.length 
        });
        try {
            await input.focus();
            await input.click({ clickCount: 3 });
            await new Promise(resolve => setTimeout(resolve, 100));
            await page.keyboard.press('Delete');
            await new Promise(resolve => setTimeout(resolve, 100));
            await input.type(text, { delay: 50 });
            
            // Verify fallback worked
            const enteredValue = await input.evaluate(el => el.value);
            if (enteredValue !== text) {
                logger.error('Fallback typing failed to enter correct text', { 
                    expected: text, 
                    entered: enteredValue 
                });
            }
        } catch (fallbackError) {
            logger.error('Fallback typing also failed', { error: fallbackError.message });
            throw fallbackError;
        }
    }
}

/**
 * Check if page is still open and throw error if closed
 * التحقق من أن الصفحة لا تزال مفتوحة
 */
function ensurePageOpen(page, operation = 'operation') {
    if (page.isClosed()) {
        throw new Error(`Page was closed during ${operation}. This may happen with Remote Mode if connection is lost.`);
    }
}

/**
 * Create Gmail account
 * إنشاء حساب Gmail
 */
export async function createGmailAccount(page, accountData) {
    try {
        logger.info('Starting Gmail account creation', { email: accountData.email });

        // Human behavior: Initial page exploration before starting
        // سلوك بشري: استكشاف أولي للصفحة قبل البدء
        logger.info('Performing initial human-like behavior...');
        await humanSleep(1000, 30);
        await idleMouseMovement(page, { movements: 2 + Math.floor(Math.random() * 3) });

        // Step 1: Navigate to Gmail page and click "Create account" from dropdown
        // الخطوة 1: الانتقال إلى صفحة Gmail والنقر على "إنشاء حساب" من القائمة المنسدلة
        await navigateToSignUp(page);

        await page.waitForTimeout(1000);
        
        // Click on the dropdown button using XPath
        // النقر على زر القائمة المنسدلة باستخدام XPath
        const dropdownXPath = '/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[3]/div/div[2]/div/div';
        try {
            await page.waitForXPath(dropdownXPath, { timeout: 10000 });
            const dropdownElements = await page.$x(dropdownXPath);
            if (dropdownElements.length > 0) {
                await dropdownElements[0].click();
                logger.info('Clicked on dropdown menu');
                await page.waitForTimeout(1000); // Wait for dropdown to open
            }
        } catch (e) {
            logger.warn('Could not find dropdown by XPath, trying CSS selector', { error: e.message });
            // Fallback to CSS selector
            try {
                const dropdown = await page.$('div[role="button"]');
                if (dropdown) {
                    await dropdown.click();
                    logger.info('Clicked on dropdown (CSS selector)');
                    await page.waitForTimeout(1000);
                }
            } catch (e2) {
                logger.warn('Could not click dropdown', { error: e2.message });
            }
        }
        
        await page.waitForTimeout(1000);
        
        // Click on "Create account" link (first option in dropdown menu)
        // النقر على رابط "إنشاء حساب" (الخيار الأول في القائمة المنسدلة)
        const createAccountXPath = '/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[3]/div/div[2]/div/div/div[2]/div/ul/li[1]';
        try {
            await page.waitForXPath(createAccountXPath, { timeout: 5000 });
            const createAccountElements = await page.$x(createAccountXPath);
            if (createAccountElements.length > 0) {
                // Check if element is visible and clickable
                const isVisible = await createAccountElements[0].evaluate(el => {
                    return el.offsetParent !== null && window.getComputedStyle(el).display !== 'none';
                });
                
                if (isVisible) {
                    await createAccountElements[0].click();
                    logger.info('Clicked on Create account link');
                } else {
                    logger.warn('Create account link found but not visible');
                    // Try clicking the link inside the li element
                    const link = await createAccountElements[0].$('a');
                    if (link) {
                        await link.click();
                        logger.info('Clicked on Create account link (inside li)');
                    }
                }
            }
        } catch (e) {
            logger.warn('Could not find Create account link by XPath, trying alternatives', { error: e.message });
            // Fallback: try to find by text
            try {
                const createBtn = await page.evaluateHandle(() => {
                    // Try to find in the dropdown menu
                    const menu = document.querySelector('ul[role="menu"]');
                    if (menu) {
                        const items = Array.from(menu.querySelectorAll('li'));
                        return items.find(item => {
                            const text = item.textContent.toLowerCase();
                            return text.includes('create account') || text.includes('إنشاء حساب') || text.includes('create an account');
                        });
                    }
                    // Fallback: search all links
                    const links = Array.from(document.querySelectorAll('a'));
                    return links.find(link => {
                        const text = link.textContent.toLowerCase();
                        return text.includes('create account') || text.includes('إنشاء حساب') || text.includes('create an account');
                    });
                });
                if (createBtn && createBtn.asElement()) {
                    await createBtn.asElement().click();
                    logger.info('Clicked on Create account link (text search)');
                }
            } catch (e2) {
                logger.warn('Could not click Create account link', { error: e2.message });
            }
        }
        
        await page.waitForTimeout(2000);
        
        // Human behavior: Explore page after navigation
        // سلوك بشري: استكشاف الصفحة بعد التنقل
        await performRandomAction(page);

        // Step 2: Setup OMO Captcha extension
        await setupOMOCaptchaExtension(page);

        // Note: We now navigate directly to signup page from gmail.com dropdown,
        // so we skip the "Create account" button and "Select account type" steps

        // Step 4: Fill sign up form (first name, last name)
        await fillSignUpForm(page, accountData);

        // Step 4.5: Detect current page and handle accordingly
        await page.waitForTimeout(2000);
        
        // Check for birthday/gender fields directly (more reliable than page detection)
        const hasBirthdayFields = await page.evaluate(() => {
            return !!(
                document.querySelector('input[name="day"], input[aria-label*="day" i]') &&
                (document.querySelector('div[jsname="O1htCb"]') || document.querySelector('#month, select[name="month"]')) &&
                document.querySelector('input[name="year"], input[aria-label*="year" i]') &&
                (document.querySelector('div[jsname="ZU2VHd"]') || document.querySelector('#gender, select[name="gender"]'))
            );
        });

        if (hasBirthdayFields) {
            logger.info('Birthday/Gender fields detected after name form, filling form...');
            await fillBirthdayAndGenderForm(page, accountData);
            await page.waitForTimeout(3000);
        }

        let pageAfterName = await detectGmailPage(page);
        if (pageAfterName) {
            logger.info('Page detected after name form', { 
                type: pageAfterName.type, 
                method: pageAfterName.method || 'unknown',
                url: page.url() 
            });

            // Handle birthday/gender page - MUST be filled before username/password
            if (pageAfterName.type === 'BIRTHDAY_GENDER') {
                logger.info('Birthday/Gender page detected, filling form...');
                await fillBirthdayAndGenderForm(page, accountData);
                // Re-detect page after filling birthday/gender
                await page.waitForTimeout(3000);
                pageAfterName = await detectGmailPage(page);
                if (pageAfterName) {
                    logger.info('Page after birthday/gender', { 
                        type: pageAfterName.type,
                        method: pageAfterName.method || 'unknown',
                        url: page.url()
                    });
                }
            }

            // Handle suggested emails page
            if (pageAfterName && pageAfterName.type === 'SUGGESTED_EMAILS') {
                logger.info('Suggested emails page detected');
                // fillUsernameAndPassword will handle this
            }

            // Handle username input page
            if (pageAfterName && pageAfterName.type === 'USERNAME_INPUT') {
                logger.info('Username input page detected');
                // fillUsernameAndPassword will handle this
            }
        }

        // Step 4.6: Fill username and password (will check for birthday/gender again if needed)
        await fillUsernameAndPassword(page, accountData);

        // // Step 5: Handle reCAPTCHA (extension should solve it automatically)
        // await waitForRecaptcha(page);

        // Step 5.5: Wait for phone verification page to appear after password step
        logger.info('Waiting for phone verification page after password step...');
        let phonePageDetected = false;
        let passwordPageHandled = false;
        
        for (let i = 0; i < 15; i++) {
            const currentUrl = page.url();
            const pageInfo = await detectGmailPage(page);
            
            // Check if we're still on password page - if so, fill password and click Next
            // التحقق من أننا ما زلنا في صفحة كلمة المرور - إذا كان الأمر كذلك، املأ كلمة المرور واضغط Next
            if ((currentUrl.includes('/password') || 
                 (pageInfo && pageInfo.type === 'PASSWORD_INPUT')) && 
                !passwordPageHandled) {
                logger.info('Still on password page, filling password and clicking Next', { 
                    url: currentUrl,
                    pageType: pageInfo?.type 
                });
                
                try {
                    // Check if password fields exist and are empty
                    const passwordFields = await page.$$('input[type="password"]');
                    if (passwordFields.length > 0) {
                        // Fill password fields
                        for (let j = 0; j < Math.min(passwordFields.length, 2); j++) {
                            try {
                                const input = passwordFields[j];
                                const isVisible = await page.evaluate((element) => {
                                    if (!element) return false;
                                    const style = window.getComputedStyle(element);
                                    return style.display !== 'none' && 
                                           style.visibility !== 'hidden' && 
                                           element.offsetParent !== null &&
                                           !element.disabled;
                                }, input);
                                
                                if (isVisible) {
                                    const currentValue = await input.evaluate(el => el.value);
                                    if (!currentValue || currentValue.trim() === '') {
                                        await humanLikeType(page, input, accountData.password, {
                                            minDelay: 50,
                                            maxDelay: 150,
                                            mistakeChance: 0.15,
                                            pauseChance: 0.20
                                        });
                                        logger.info(`Password field ${j + 1} filled`);
                                    }
                                }
                            } catch (e) {
                                logger.debug(`Error filling password field ${j + 1}`, { error: e.message });
                            }
                        }
                        
                        // Click Next button
                        await page.waitForTimeout(1000);
                        const nextClicked = await clickNextButton(page);
                        if (nextClicked) {
                            logger.info('Next button clicked on password page');
                            passwordPageHandled = true;
                            await page.waitForTimeout(2000); // Wait for navigation
                            continue; // Check again after clicking Next
                        }
                    }
                } catch (passwordError) {
                    logger.warn('Error handling password page', { error: passwordError.message });
                }
            }
            
            // Check if we're on phone verification page
            if (currentUrl.includes('/collectemailphone') || 
                currentUrl.includes('/challenge/phone') || 
                currentUrl.includes('/verification/phone') ||
                currentUrl.includes('/challenge/sms') ||
                currentUrl.includes('/verification/sms') ||
                (pageInfo && (pageInfo.type === 'PHONE_VERIFICATION' || pageInfo.type === 'VERIFICATION_CODE'))) {
                logger.info('Phone verification page detected', { 
                    type: pageInfo?.type, 
                    method: pageInfo?.method || 'unknown',
                    url: currentUrl 
                });
                phonePageDetected = true;
                break;
            }
            
            // Check for phone input field directly
            const hasPhoneInput = await page.evaluate(() => {
                return !!(
                    document.querySelector('input[type="tel"]') ||
                    document.querySelector('input[name="phoneNumberId"]') ||
                    document.querySelector('input[aria-label*="phone" i]') ||
                    document.querySelector('input[aria-label*="Phone" i]')
                );
            });
            
            if (hasPhoneInput) {
                logger.info('Phone input field detected on page');
                phonePageDetected = true;
                break;
            }
            
            await page.waitForTimeout(1000);
        }
        
        if (!phonePageDetected) {
            logger.warn('Phone verification page not detected, but attempting phone verification anyway', { url: page.url() });
        }

        // Step 6: Handle phone verification (pass accountData for password handling if needed)
        const phoneData = await handlePhoneVerification(page, accountData);

        // Step 7: Complete account creation
        await completeAccountCreation(page, accountData);

        logger.info('Gmail account created successfully', { email: accountData.email });
        return {
            success: true,
            email: accountData.email,
            password: accountData.password,
            phone: phoneData.phone,
            phoneCode: phoneData.code,
            orderId: phoneData.orderId,
            firstName: accountData.firstName,
            lastName: accountData.lastName,
            fullName: accountData.fullName,
            username: accountData.username
        };
    } catch (error) {
        logger.error('Failed to create Gmail account', { error: error.message, email: accountData.email });
        throw error;
    }
}

/**
 * Navigate to Gmail sign up page
 * الانتقال إلى صفحة إنشاء حساب Gmail عبر gmail.com
 */
async function navigateToSignUp(page) {
    try {
        logger.info('Navigating to Gmail signin page first');
        
        // Step 1: Navigate directly to Gmail signin page (where Create account button is)
        // Try with different wait strategies if proxy auth fails
        // محاولة باستراتيجيات انتظار مختلفة إذا فشلت مصادقة البروكسي
        try {
            await page.goto(GMAIL_URL, { 
                waitUntil: 'networkidle2', 
                timeout: 60000 
            });
        } catch (gotoError) {
            // If proxy auth error, try with domcontentloaded (faster, less strict)
            // إذا كان خطأ مصادقة البروكسي، جرب مع domcontentloaded (أسرع، أقل صرامة)
            if (gotoError.message.includes('ERR_UNEXPECTED_PROXY_AUTH') || 
                gotoError.message.includes('PROXY_AUTH')) {
                logger.warn('Proxy auth error detected, retrying with domcontentloaded', { 
                    error: gotoError.message 
                });
                await page.goto(GMAIL_URL, { 
                    waitUntil: 'domcontentloaded', 
                    timeout: 30000 
                });
                // Wait a bit for page to load
                await page.waitForTimeout(3000);
            } else {
                throw gotoError;
            }
        }
        
        logger.info('Navigated to Gmail signin page');
   
    } catch (error) {
        logger.error('Failed to navigate to sign up page', { 
            error: error.message,
            errorType: error.name,
            stack: error.stack?.substring(0, 500)
        });
        
        // If it's a proxy auth error, provide helpful message
        // إذا كان خطأ مصادقة البروكسي، قدم رسالة مفيدة
        if (error.message.includes('ERR_UNEXPECTED_PROXY_AUTH') || 
            error.message.includes('PROXY_AUTH')) {
            throw new Error(`Proxy authentication failed. Please check your proxy credentials in config/proxies.txt. Format: ip:port:username:password`);
        }
        
        throw error;
    }
}


/**
 * Fill sign up form
 * ملء نموذج التسجيل
 */
async function fillSignUpForm(page, accountData) {
    try {
        logger.info('Filling sign up form', { name: accountData.fullName });

        // Human behavior: Simulate reading the form before filling
        // سلوك بشري: محاكاة قراءة النموذج قبل الملء
        await humanSleep(1500, 40);
        await simulateReading(page, { duration: 1500 + Math.random() * 1000, scrollWhileReading: false });
        
        // Random mouse movement to look at form
        await idleMouseMovement(page, { movements: 1 + Math.floor(Math.random() * 2) });

        // Fill first name
        const firstNameSelectors = [
            'input[name="firstName"]',
            '#firstName',
            'input[aria-label*="First name" i]',
            'input[type="text"][autocomplete="given-name"]'
        ];

        let firstNameFilled = false;
        for (const selector of firstNameSelectors) {
            try {
                const input = await waitForElement(page, selector, 3000);
                if (input) {
                    logger.info('First name input field found', { selector });
                    
                    // Human behavior: Scroll to element and move mouse to it
                    // سلوك بشري: التمرير إلى العنصر وتحريك الماوس إليه
                    await humanScrollToElement(page, input);
                    await humanClick(page, input, { preClickDelay: true, postClickDelay: false });
                    
                    await humanType(page, input, accountData.firstName, {
                        minDelay: 40,
                        maxDelay: 150,
                        mistakeChance: 0.08,
                        pauseChance: 0.12
                    });
                    
                    // Verify that the text was entered
                    const enteredValue = await input.evaluate(el => el.value);
                    if (enteredValue && enteredValue.trim() === accountData.firstName.trim()) {
                        logger.info('First name entered and verified', { 
                            expected: accountData.firstName, 
                            entered: enteredValue 
                        });
                        firstNameFilled = true;
                        break;
                    } else {
                        logger.warn('First name verification failed', { 
                            expected: accountData.firstName, 
                            entered: enteredValue 
                        });
                    }
                }
            } catch (e) {
                logger.debug('Error filling first name', { selector, error: e.message });
                continue;
            }
        }
        
        if (!firstNameFilled) {
            logger.warn('Failed to fill first name with all selectors');
        }

        // Human behavior: Pause between fields (like looking at next field)
        // سلوك بشري: توقف بين الحقول (مثل النظر للحقل التالي)
        await humanSleep(getHumanDelay('betweenActions'));

        // Fill last name
        const lastNameSelectors = [
            'input[name="lastName"]',
            '#lastName',
            'input[aria-label*="Last name" i]',
            'input[type="text"][autocomplete="family-name"]'
        ];

        let lastNameFilled = false;
        for (const selector of lastNameSelectors) {
            try {
                const input = await waitForElement(page, selector, 3000);
                if (input) {
                    logger.info('Last name input field found', { selector });
                    
                    // Human behavior: Click on input with mouse movement
                    // سلوك بشري: النقر على الحقل مع حركة الماوس
                    await humanClick(page, input, { preClickDelay: true, postClickDelay: false });
                    
                    await humanType(page, input, accountData.lastName, {
                        minDelay: 40,
                        maxDelay: 150,
                        mistakeChance: 0.08,
                        pauseChance: 0.12
                    });
                    
                    // Verify that the text was entered
                    const enteredValue = await input.evaluate(el => el.value);
                    if (enteredValue && enteredValue.trim() === accountData.lastName.trim()) {
                        logger.info('Last name entered and verified', { 
                            expected: accountData.lastName, 
                            entered: enteredValue 
                        });
                        lastNameFilled = true;
                        break;
                    } else {
                        logger.warn('Last name verification failed', { 
                            expected: accountData.lastName, 
                            entered: enteredValue 
                        });
                    }
                }
            } catch (e) {
                logger.debug('Error filling last name', { selector, error: e.message });
                continue;
            }
        }
        
        if (!lastNameFilled) {
            logger.warn('Failed to fill last name with all selectors');
        }

        // Human behavior: Think before clicking Next (verify form)
        // سلوك بشري: التفكير قبل النقر على التالي (التحقق من النموذج)
        await humanSleep(getHumanDelay('thinking'));
        await performRandomAction(page);

        // Click Next button
        await clickNextButton(page);

        // Human behavior: Wait for page transition
        await humanSleep(getHumanDelay('pageLoad'));
    } catch (error) {
        logger.error('Failed to fill sign up form', { error: error.message });
        throw error;
    }
}

/**
 * Select a random suggested email option
 * اختيار أحد الاقتراحات عشوائياً
 */
async function selectRandomSuggestedEmail(page) {
    try {
        logger.info('Selecting a random suggested email option');
        await page.waitForTimeout(2000);

        // Find all suggested email radio buttons (excluding "Create your own" option)
        const suggestedEmails = await page.evaluate(() => {
            const radioButtons = Array.from(document.querySelectorAll('input[type="radio"][name="usernameRadio"]'));
            const suggestions = [];
            
            radioButtons.forEach(radio => {
                // Skip the "custom" option (Create your own Gmail address)
                if (radio.value !== 'custom' && radio.value) {
                    // Find the email text associated with this radio button
                    const radioId = radio.getAttribute('aria-labelledby');
                    if (radioId) {
                        const emailElement = document.getElementById(radioId);
                        if (emailElement) {
                            const emailText = emailElement.textContent.trim();
                            if (emailText && emailText.includes('@gmail.com')) {
                                suggestions.push({
                                    value: radio.value,
                                    email: emailText,
                                    element: radio
                                });
                            }
                        }
                    }
                }
            });
            
            return suggestions;
        });

        if (suggestedEmails.length === 0) {
            logger.warn('No suggested emails found, falling back to "Create your own"');
            return false;
        }

        // Select a random suggestion
        const randomIndex = Math.floor(Math.random() * suggestedEmails.length);
        const selectedEmail = suggestedEmails[randomIndex];
        
        logger.info('Selected random suggested email', { 
            email: selectedEmail.email, 
            value: selectedEmail.value,
            totalOptions: suggestedEmails.length
        });

        // Click on the selected radio button
        const radioXPath = `//input[@type="radio"][@name="usernameRadio"][@value="${selectedEmail.value}"]`;
        let clicked = false;

        try {
            await page.waitForXPath(radioXPath, { timeout: 5000 });
            const radioButtons = await page.$x(radioXPath);
            if (radioButtons.length > 0) {
                const radioButton = radioButtons[0];
                const isVisible = await page.evaluate(el => {
                    const style = window.getComputedStyle(el);
                    return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
                }, radioButton);

                if (isVisible) {
                    await radioButton.click();
                    logger.info('Selected suggested email radio button', { email: selectedEmail.email });
                    clicked = true;
                    await page.waitForTimeout(1000);
                }
            }
        } catch (e) {
            logger.debug('XPath method failed, trying alternative', { error: e.message });
        }

        // Fallback: try clicking by value using CSS selector
        if (!clicked) {
            try {
                const radioSelector = `input[type="radio"][name="usernameRadio"][value="${selectedEmail.value}"]`;
                const radioButton = await waitForElement(page, radioSelector, 3000);
                if (radioButton) {
                    await radioButton.click();
                    logger.info('Selected suggested email radio button (CSS)', { email: selectedEmail.email });
                    clicked = true;
                    await page.waitForTimeout(1000);
                }
            } catch (e) {
                logger.debug('CSS selector method failed', { error: e.message });
            }
        }

        // Return selected email info if successful
        if (clicked && selectedEmail.email) {
            return {
                success: true,
                email: selectedEmail.email,
                username: selectedEmail.email.split('@')[0]
            };
        }

        return { success: false };
    } catch (error) {
        logger.warn('Error selecting random suggested email', { error: error.message });
        return false;
    }
}

/**
 * Click "Create your own Gmail address" if suggested emails are shown
 * النقر على "إنشاء عنوان Gmail الخاص بك" إذا ظهرت اقتراحات البريد الإلكتروني
 */
async function clickCreateOwnGmailAddress(page) {
    try {
        logger.info('Checking for suggested emails page');
        await page.waitForTimeout(2000);

        // Check if we're on the suggested emails page by looking for the link/button
        const createOwnSelectors = [
            '//button[contains(text(), "Create your own Gmail address")]',
            '//a[contains(text(), "Create your own Gmail address")]',
            '//span[contains(text(), "Create your own Gmail address")]',
            'button:has-text("Create your own Gmail address")',
            'a:has-text("Create your own Gmail address")',
            '[aria-label*="Create your own Gmail address" i]'
        ];

        let clicked = false;
        for (const selector of createOwnSelectors) {
            try {
                if (selector.startsWith('//')) {
                    // XPath selector
                    const elements = await page.$x(selector);
                    if (elements.length > 0) {
                        const element = elements[0];
                        const isVisible = await page.evaluate(el => {
                            const style = window.getComputedStyle(el);
                            return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
                        }, element);
                        
                        if (isVisible) {
                            await element.click();
                            logger.info('Clicked "Create your own Gmail address" (XPath)');
                            clicked = true;
                            await page.waitForTimeout(2000);
                            break;
                        }
                    }
                } else {
                    // CSS selector
                    const element = await waitForElement(page, selector, 3000);
                    if (element) {
                        const isVisible = await page.evaluate(el => {
                            const style = window.getComputedStyle(el);
                            return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
                        }, element);
                        
                        if (isVisible) {
                            await element.click();
                            logger.info('Clicked "Create your own Gmail address" (CSS)');
                            clicked = true;
                            await page.waitForTimeout(2000);
                            break;
                        }
                    }
                }
            } catch (e) {
                logger.debug(`Create own Gmail selector failed: ${selector}`, { error: e.message });
                continue;
            }
        }

        // Try finding by text content as fallback
        if (!clicked) {
            try {
                const button = await page.evaluateHandle(() => {
                    const buttons = Array.from(document.querySelectorAll('button, a, span, div'));
                    return buttons.find(btn => {
                        const text = btn.textContent.toLowerCase();
                        return (text.includes('create your own') && text.includes('gmail address')) ||
                               (text.includes('create') && text.includes('own') && text.includes('email'));
                    });
                });

                if (button && button.asElement()) {
                    const isVisible = await page.evaluate(el => {
                        const style = window.getComputedStyle(el);
                        return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
                    }, button.asElement());
                    
                    if (isVisible) {
                        await button.asElement().click();
                        logger.info('Clicked "Create your own Gmail address" (text search)');
                        clicked = true;
                        await page.waitForTimeout(2000);
                    }
                }
            } catch (e) {
                logger.debug('Could not find "Create your own Gmail address" by text', { error: e.message });
            }
        }

        if (!clicked) {
            logger.info('No suggested emails page detected, proceeding to username input');
        }
    } catch (error) {
        logger.warn('Error checking for suggested emails page', { error: error.message });
        // Continue anyway - might already be on username input page
    }
}

/**
 * Fill username (email) and password
 * ملء اسم المستخدم (البريد الإلكتروني) وكلمة المرور
 */
async function fillUsernameAndPassword(page, accountData) {
    try {
        logger.info('Filling username and password');
        
        // Human behavior: Wait and explore page before filling
        // سلوك بشري: الانتظار واستكشاف الصفحة قبل الملء
        await humanSleep(getHumanDelay('pageLoad'));
        await idleMouseMovement(page, { movements: 2 });

        // Detect current page type - check multiple times to ensure we're on the right page
        let currentPage = await detectGmailPage(page);
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
            if (currentPage) {
                logger.info('Page detected before username/password', { 
                    type: currentPage.type,
                    method: currentPage.method || 'unknown',
                    url: page.url(),
                    retry: retryCount
                });

                // If we're on birthday/gender page, fill it first
                if (currentPage.type === 'BIRTHDAY_GENDER') {
                    logger.info('Detected Birthday/Gender page, filling form first...');
                    await fillBirthdayAndGenderForm(page, accountData);
                    // Wait and re-detect page after filling birthday/gender
                    await page.waitForTimeout(3000);
                    currentPage = await detectGmailPage(page);
                    retryCount++;
                    continue; // Check again after filling birthday/gender
                }

  

                // Check if we're actually on birthday/gender page (even if detected as SIGN_UP_FORM)
                const hasBirthdayFields = await page.evaluate(() => {
                    return !!(
                        document.querySelector('input[name="day"], input[aria-label*="day" i]') &&
                        (document.querySelector('div[jsname="O1htCb"]') || document.querySelector('#month, select[name="month"]')) &&
                        document.querySelector('input[name="year"], input[aria-label*="year" i]') &&
                        (document.querySelector('div[jsname="ZU2VHd"]') || document.querySelector('#gender, select[name="gender"]'))
                    );
                });

                if (hasBirthdayFields) {
                    logger.info('Birthday/Gender fields detected on page, filling form first...');
                    await fillBirthdayAndGenderForm(page, accountData);
                    await page.waitForTimeout(3000);
                    currentPage = await detectGmailPage(page);
                    retryCount++;
                    continue;
                }

                    // If we're on suggested emails page, select a random suggestion
                if (currentPage.type === 'SUGGESTED_EMAILS') {
                    logger.info('Detected suggested emails page, selecting a random suggestion');
                    const selected = await selectRandomSuggestedEmail(page);
                    if (selected && selected.success) {
                        // Update accountData with selected email
                        accountData.email = selected.email;
                        accountData.username = selected.username;
                        logger.info('Updated accountData with selected email', { 
                            email: selected.email, 
                            username: selected.username 
                        });
                        
                        // Click Next button after selecting
                        await page.waitForTimeout(1000);
                        await clickNextButton(page);
                        await page.waitForTimeout(2000);
                        currentPage = await detectGmailPage(page);
                        retryCount++;
                        continue; // Check again after selecting
                    } else {
                        // Fallback to "Create your own" if selection failed
                        logger.info('Failed to select suggested email, falling back to "Create your own"');
                        await clickCreateOwnGmailAddress(page);
                        await page.waitForTimeout(2000);
                        currentPage = await detectGmailPage(page);
                        retryCount++;
                        continue;
                    }
                }
                
                // If we're on username input page, break and proceed
                if (currentPage.type === 'USERNAME_INPUT') {
                    logger.info('On correct page for username input, proceeding...');
                    break;
                }

                // If detected as SIGN_UP_FORM but no birthday fields, might be username page
                if (currentPage.type === 'SIGN_UP_FORM' && !hasBirthdayFields) {
                    logger.info('SIGN_UP_FORM detected but no birthday fields, checking for username input...');
                    // Check if username input exists (more comprehensive check)
                    const hasUsernameInput = await page.evaluate(() => {
                        return !!(
                            document.querySelector('input[aria-label*="Gmail address" i]') ||
                            document.querySelector('input[aria-label*="email address" i]') ||
                            document.querySelector('input[aria-label*="username" i]') ||
                            document.querySelector('input[type="email"]') ||
                            document.querySelector('input[name="Username"]') ||
                            document.querySelector('input[name="username"]') ||
                            document.querySelector('input[autocomplete="username"]') ||
                            // Check for username input by placeholder or label
                            Array.from(document.querySelectorAll('input')).some(input => {
                                const label = input.getAttribute('aria-label') || input.getAttribute('placeholder') || '';
                                return label.toLowerCase().includes('gmail') || 
                                       label.toLowerCase().includes('email') ||
                                       label.toLowerCase().includes('username');
                            })
                        );
                    });
                    
                    // Also check if URL suggests we're past the name page
                    const currentUrl = page.url();
                    const isPastNamePage = currentUrl.includes('/username') || 
                                          currentUrl.includes('/email') ||
                                          (!currentUrl.includes('/name') && !currentUrl.includes('/signup/name'));
                    
                    if (hasUsernameInput || isPastNamePage) {
                        logger.info('Username input found or past name page, proceeding...', { 
                            hasUsernameInput, 
                            isPastNamePage,
                            url: currentUrl 
                        });
                        break;
                    }
                    
                    // If we're still on name page and no username input, wait more
                    if (currentUrl.includes('/name') || currentUrl.includes('/signup/name')) {
                        logger.info('Still on name page, waiting for navigation to username page...');
                        await page.waitForTimeout(3000);
                        currentPage = await detectGmailPage(page);
                        retryCount++;
                        continue;
                    }
                }

                // If page type is unknown or unexpected, wait and retry
                if (currentPage.type === 'UNKNOWN' || retryCount < maxRetries - 1) {
                    logger.info('Page type not ready yet, waiting and retrying...', { type: currentPage.type });
                    await page.waitForTimeout(2000);
                    currentPage = await detectGmailPage(page);
                    retryCount++;
                    continue;
                }
            } else {
                // If page detection failed, wait and retry
                if (retryCount < maxRetries - 1) {
                    logger.warn('Page detection failed, retrying...', { retry: retryCount });
                    await page.waitForTimeout(2000);
                    currentPage = await detectGmailPage(page);
                    retryCount++;
                    continue;
                }
            }
            break;
        }

        // Final check: if still on birthday/gender page, fill it
        const finalPageCheck = await detectGmailPage(page);
        if (finalPageCheck && finalPageCheck.type === 'BIRTHDAY_GENDER') {
            logger.warn('Still on Birthday/Gender page after retries, filling form now...');
            await fillBirthdayAndGenderForm(page, accountData);
            await page.waitForTimeout(3000);
        }

        // Always check for suggested emails page by checking for radio buttons directly
        // This is more reliable than page detection since the URL might contain /username
        logger.info('Checking for suggested emails page by looking for radio buttons...');
        const hasSuggestedEmails = await page.evaluate(() => {
            const radioButtons = document.querySelectorAll('input[type="radio"][name="usernameRadio"]');
            const hasCustomOption = Array.from(radioButtons).some(radio => radio.value === 'custom');
            const hasNonCustomOptions = Array.from(radioButtons).some(radio => radio.value !== 'custom' && radio.value);
            
            return radioButtons.length > 0 && hasCustomOption && hasNonCustomOptions;
        });
        
        if (hasSuggestedEmails) {
            logger.info('Detected suggested emails page by radio buttons, selecting random suggestion');
            const selected = await selectRandomSuggestedEmail(page);
            if (selected && selected.success) {
                // Update accountData with selected email
                accountData.email = selected.email;
                accountData.username = selected.username;
                logger.info('Updated accountData with selected email', { 
                    email: selected.email, 
                    username: selected.username 
                });
                
                // Click Next button after selecting
                await page.waitForTimeout(1000);
                await clickNextButton(page);
                await page.waitForTimeout(2000);
                
                // Re-check after clicking Next to see if we need to continue
                const pageAfterSelection = await detectGmailPage(page);
                if (pageAfterSelection && pageAfterSelection.type === 'USERNAME_INPUT') {
                    logger.info('Still on username input page after selecting suggested email, continuing...');
                    // Continue to fill username if needed
                } else {
                    logger.info('Navigated away from suggested emails page after selection');
                    // The selected email was accepted, we can skip username input
                    return;
                }
            } else {
                // Fallback to "Create your own" if selection failed
                logger.info('Failed to select suggested email, falling back to "Create your own"');
                await clickCreateOwnGmailAddress(page);
                await page.waitForTimeout(2000);
            }
        } else {
            // Check page detection as fallback
            const pageBeforeUsername = await detectGmailPage(page);
            if (pageBeforeUsername && pageBeforeUsername.type === 'SUGGESTED_EMAILS') {
                logger.info('Detected suggested emails page by page detection, selecting random suggestion');
                const selected = await selectRandomSuggestedEmail(page);
                if (selected && selected.success) {
                    accountData.email = selected.email;
                    accountData.username = selected.username;
                    logger.info('Updated accountData with selected email', { 
                        email: selected.email, 
                        username: selected.username 
                    });
                    
                    await page.waitForTimeout(1000);
                    await clickNextButton(page);
                    await page.waitForTimeout(2000);
                    
                    const pageAfterSelection = await detectGmailPage(page);
                    if (pageAfterSelection && pageAfterSelection.type === 'USERNAME_INPUT') {
                        logger.info('Still on username input page after selecting suggested email, continuing...');
                    } else {
                        logger.info('Navigated away from suggested emails page after selection');
                        return;
                    }
                } else {
                    logger.info('Failed to select suggested email, falling back to "Create your own"');
                    await clickCreateOwnGmailAddress(page);
                }
            } else if (!pageBeforeUsername || pageBeforeUsername.type !== 'USERNAME_INPUT') {
                // Fallback: try to click "Create your own Gmail address" anyway
                logger.info('Trying fallback: click "Create your own Gmail address"');
                await clickCreateOwnGmailAddress(page);
            }
        }

        // Wait for username input field to appear (after clicking "Create your own Gmail address")
        // Wait more if we're still on name page
        const currentUrlAfterClick = page.url();
        if (currentUrlAfterClick.includes('/name') || currentUrlAfterClick.includes('/signup/name')) {
            logger.info('Still on name page after clicking, waiting for navigation to username page...');
            for (let waitAttempt = 0; waitAttempt < 10; waitAttempt++) {
                await page.waitForTimeout(2000);
                const newUrl = page.url();
                logger.info('Waiting for navigation...', { attempt: waitAttempt + 1, url: newUrl });
                if (!newUrl.includes('/name') && !newUrl.includes('/signup/name')) {
                    logger.info('Navigation completed to username/email page');
                    break;
                }
            }
        } else {
            await page.waitForTimeout(2000);
        }

        // Generate a longer username by appending random characters
        const originalUsername = accountData.username;
        const makeLongUsername = (baseUsername) => {
            const randomChars = 'abcdefghijklmnopqrstuvwxyz0123456789';
            let longUsername = baseUsername;
            // Add 10-15 more random characters to make it longer
            const additionalLength = 10 + Math.floor(Math.random() * 6);
            for (let i = 0; i < additionalLength; i++) {
                longUsername += randomChars[Math.floor(Math.random() * randomChars.length)];
            }
            return longUsername;
        };

        const longUsername = makeLongUsername(originalUsername);
        // Update accountData to use the long username
        accountData.username = longUsername;
        accountData.email = `${longUsername}@gmail.com`;
        logger.info('Generated long username', { originalLength: originalUsername.length, newLength: longUsername.length, username: longUsername });

        // Fill username (email) - wait for field to be ready and visible
        logger.info('Waiting for username input field to appear and be visible...');
        let usernameFieldReady = false;
        for (let waitAttempt = 0; waitAttempt < 15; waitAttempt++) {
            const usernameFieldInfo = await page.evaluate(() => {
                const selectors = [
                    'input[aria-label*="Gmail address" i]',
                    'input[aria-label*="email address" i]',
                    'input[aria-label*="username" i]',
                    'input[type="email"]',
                    'input[name="Username"]',
                    'input[name="username"]',
                    'input[autocomplete="username"]'
                ];
                
                for (const selector of selectors) {
                    const input = document.querySelector(selector);
                    if (input) {
                        const style = window.getComputedStyle(input);
                        const isVisible = style.display !== 'none' && 
                                         style.visibility !== 'hidden' && 
                                         input.offsetParent !== null &&
                                         !input.disabled;
                        if (isVisible) {
                            return { found: true, selector: selector, value: input.value };
                        }
                    }
                }
                return { found: false };
            });
            
            if (usernameFieldInfo.found) {
                logger.info('Username input field found and visible', { 
                    selector: usernameFieldInfo.selector,
                    currentValue: usernameFieldInfo.value 
                });
                usernameFieldReady = true;
                break;
            }
            
            if (waitAttempt < 14) {
                logger.info('Username input field not found yet, waiting...', { attempt: waitAttempt + 1 });
                await page.waitForTimeout(2000);
            }
        }
        
        if (!usernameFieldReady) {
            logger.warn('Username input field not found after waiting, but will try to fill anyway');
        }

        const usernameSelectors = [
            '/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[2]/div/div/div/form/span/section/div/div/div[2]/div[1]/div[1]/div[1]/div/div[1]/input', // User-provided XPath (after clicking "Create your own Gmail address")
            '/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[2]/div/div/div/form/span/section/div/div/div/div[1]/div[1]/div[1]/div/div[1]/input', // Fallback XPath
            'input[name="Username"]',
            'input[aria-label="Create a Gmail address"]',
            'input[aria-label*="Gmail address" i]',
            '#username',
            'input[type="email"]',
            'input[aria-label*="username" i]'
        ];

        let usernameFilled = false;
        for (const selector of usernameSelectors) {
            try {
                let input;
                if (selector.startsWith('/html') || selector.startsWith('//')) {
                    // XPath selector
                    await page.waitForXPath(selector, { timeout: 5000 });
                    const elements = await page.$x(selector);
                    if (elements.length > 0) {
                        input = elements[0];
                    }
                } else {
                    // CSS selector
                    input = await waitForElement(page, selector, 3000);
                }

                if (input) {
                    await humanLikeType(page, input, longUsername, {
                        minDelay: 35,
                        maxDelay: 100,
                        mistakeChance: 0.12,
                        pauseChance: 0.18
                    });
                    logger.info('Long username entered', { username: longUsername, selector: selector.substring(0, 50) + '...' });
                    usernameFilled = true;
                    break;
                }
            } catch (e) {
                logger.debug(`Username selector failed: ${selector.substring(0, 50)}`, { error: e.message });
                continue;
            }
        }

        if (!usernameFilled) {
            logger.warn('Could not find username input field');
        }

        await page.waitForTimeout(500);
        await clickNextButton(page);
        await page.waitForTimeout(3000);

        // Fill password fields (handles pages that require password entered twice)
        logger.info('Filling password fields');
        
        // Wait for password page to load and loading screen to disappear
        await page.waitForTimeout(500);
        
        // Wait for loading screen to disappear
        logger.info('Waiting for loading screen to disappear...');
        for (let waitCount = 0; waitCount < 15; waitCount++) {
            const hasLoadingScreen = await page.evaluate(() => {
                const loadingIndicators = [
                    document.querySelector('.sZwd7c'), // Loading spinner
                    document.querySelector('[role="progressbar"]'), // Progress bar
                    document.querySelector('.Ih3FE'), // Loading overlay
                    document.querySelector('.B6Vhqe') // Loading class
                ];
                return loadingIndicators.some(el => el && el.offsetParent !== null);
            });
            
            if (!hasLoadingScreen) {
                logger.info('Loading screen disappeared');
                break;
            }
            await page.waitForTimeout(1000);
        }
        
        await page.waitForTimeout(3000);
        
        // Use specific XPath directly - guaranteed method
        const specificPasswordXPaths = [
            '/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[2]/div/div/div/form/span/section/div/div/div/div[1]/div/div/div[1]/div/div[1]/div/div[1]/input',
            '/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[2]/div/div/div/form/span/section/div/div/div/div[1]/div/div/div[2]/div/div[1]/div/div[1]/input'
        ];
        
        let passwordFieldsFilled = false;
        let passwordRetryCount = 0;
        const maxPasswordRetries = 20;
        
        while (passwordRetryCount < maxPasswordRetries && !passwordFieldsFilled) {
            await page.waitForTimeout(2000);
            
            // Try to fill password fields using specific XPath directly
            let fieldsFound = 0;
            let fieldsFilled = 0;
            
            for (let i = 0; i < specificPasswordXPaths.length; i++) {
                try {
                    const xpathInputs = await page.$x(specificPasswordXPaths[i]);
                    if (xpathInputs.length > 0) {
                        const input = xpathInputs[0];
                        
                        // Check if visible
                        const isVisible = await page.evaluate((element) => {
                            if (!element) return false;
                            const style = window.getComputedStyle(element);
                            return style.display !== 'none' && 
                                   style.visibility !== 'hidden' && 
                                   element.offsetParent !== null &&
                                   !element.disabled;
                        }, input);
                        
                        if (isVisible) {
                            fieldsFound++;
                            try {
                                // Clear and fill the field
                                await humanLikeType(page, input, accountData.password, {
                                    minDelay: 50,
                                    maxDelay: 150,
                                    mistakeChance: 0.15,
                                    pauseChance: 0.20
                                });
                                logger.info(`Password field ${i + 1} filled using XPath`);
                                fieldsFilled++;
                            } catch (fillError) {
                                logger.warn(`Failed to fill password field ${i + 1}`, { error: fillError.message });
                            }
                        }
                    }
                } catch (e) {
                    logger.debug(`XPath ${i + 1} not found, trying next...`);
                }
            }
            
            // If we found and filled at least one field, or if no fields are visible yet, continue
            if (fieldsFilled > 0) {
                logger.info(`Successfully filled ${fieldsFilled} password field(s) out of ${fieldsFound} found`);
                passwordFieldsFilled = true;
                break;
            } else if (fieldsFound === 0) {
                // Try fallback methods if specific XPath didn't work
                const allPasswordInputs = await page.$$('input[type="password"]');
                if (allPasswordInputs.length > 0) {
                    logger.info(`Found ${allPasswordInputs.length} password field(s) using CSS selector, filling...`);
                    for (let i = 0; i < Math.min(allPasswordInputs.length, 2); i++) {
                        try {
                            const input = allPasswordInputs[i];
                            const isVisible = await page.evaluate((element) => {
                                if (!element) return false;
                                const style = window.getComputedStyle(element);
                                return style.display !== 'none' && 
                                       style.visibility !== 'hidden' && 
                                       element.offsetParent !== null &&
                                       !element.disabled;
                            }, input);
                            
                            if (isVisible) {
                                await humanLikeType(page, input, accountData.password, {
                                    minDelay: 50,
                                    maxDelay: 150,
                                    mistakeChance: 0.15,
                                    pauseChance: 0.20
                                });
                                logger.info(`Password field ${i + 1} filled using CSS selector`);
                                fieldsFilled++;
                            }
                        } catch (e) {
                            logger.debug(`Failed to fill password field ${i + 1}`, { error: e.message });
                        }
                    }
                    if (fieldsFilled > 0) {
                        passwordFieldsFilled = true;
                        break;
                    }
                }
            }
            
            passwordRetryCount++;
            if (passwordRetryCount < maxPasswordRetries) {
                logger.debug(`Password fields not ready yet, retry ${passwordRetryCount}/${maxPasswordRetries}`);
            }
        }
        
        if (!passwordFieldsFilled) {
            throw new Error(`Failed to fill password fields after ${maxPasswordRetries} attempts`);
        }
        
        logger.info('Password fields filled successfully, clicking Next button...');
        await page.waitForTimeout(1500);
        
        // Click Next button after filling password
        const nextClicked = await clickNextButton(page);
        if (!nextClicked) {
            throw new Error('Could not click Next button after filling password');
        }
        
        logger.info('Next button clicked after filling password');
        
        // Wait for page to navigate after clicking Next on password page
        logger.info('Waiting for page navigation after password submission...');
        await page.waitForTimeout(3000);
        
        // Wait for navigation to phone verification page or next step
        let navigationComplete = false;
        for (let i = 0; i < 10; i++) {
            const currentUrl = page.url();
            const pageInfo = await detectGmailPage(page);
            
            // Check if we're on phone verification page
            if (currentUrl.includes('/collectemailphone') || 
                currentUrl.includes('/challenge/phone') || 
                currentUrl.includes('/verification/phone') ||
                currentUrl.includes('/challenge/sms') ||
                currentUrl.includes('/verification/sms') ||
                (pageInfo && (pageInfo.type === 'PHONE_VERIFICATION' || pageInfo.type === 'VERIFICATION_CODE'))) {
                logger.info('Phone verification page detected after password step');
                navigationComplete = true;
                break;
            }
            
            // Check if page has changed (navigation occurred)
            if (i === 0) {
                const initialUrl = currentUrl;
                await page.waitForTimeout(1000);
                const newUrl = page.url();
                if (newUrl !== initialUrl) {
                    logger.info('Page navigation detected', { from: initialUrl, to: newUrl });
                    navigationComplete = true;
                    break;
                }
            }
            
            await page.waitForTimeout(1000);
        }
        
        if (!navigationComplete) {
            logger.warn('Page navigation timeout, but continuing anyway');
        }
        
        logger.info('Password step completed, ready for next step');
    } catch (error) {
        logger.error('Failed to fill username and password form', { error: error.message });
        throw error;
    }
}

/**
 * Fill birthday and gender form
 * ملء نموذج تاريخ الميلاد والجنس
 */
async function fillBirthdayAndGenderForm(page, accountData) {
    try {
        logger.info('Filling birthday and gender form');

        // Human behavior: Wait and read the form before filling
        // سلوك بشري: الانتظار وقراءة النموذج قبل الملء
        await humanSleep(getHumanDelay('pageLoad'));
        await simulateReading(page, { duration: 1000 + Math.random() * 500, scrollWhileReading: false });
        await idleMouseMovement(page, { movements: 1 + Math.floor(Math.random() * 2) });

        // Generate random birthday (age between 18-65)
        const currentYear = new Date().getFullYear();
        const age = 18 + Math.floor(Math.random() * 47); // 18-65 years old
        const birthYear = currentYear - age;
        const birthMonth = Math.floor(Math.random() * 12) + 1; // 1-12
        const birthDay = Math.floor(Math.random() * 28) + 1; // 1-28 (safe for all months)

        // Fill day
        const daySelectors = [
            'input[name="day"]',
            'input[aria-label*="day" i]',
            'input[type="number"][aria-label*="day" i]'
        ];

        let dayFilled = false;
        for (const selector of daySelectors) {
            try {
                const input = await waitForElement(page, selector, 3000);
                if (input) {
                    // Human behavior: Scroll to element and click naturally
                    // سلوك بشري: التمرير إلى العنصر والنقر بشكل طبيعي
                    await humanScrollToElement(page, input);
                    await humanClick(page, input, { preClickDelay: true, postClickDelay: false, doubleClick: true });
                    
                    await humanType(page, input, birthDay.toString(), {
                        minDelay: 60,
                        maxDelay: 120,
                        mistakeChance: 0.05,
                        pauseChance: 0.10
                    });
                    logger.info('Day entered', { day: birthDay });
                    dayFilled = true;
                    break;
                }
            } catch (e) {
                continue;
            }
        }

        if (!dayFilled) {
            logger.warn('Could not find day input field');
        }

        // Human behavior: Pause between fields
        await humanSleep(getHumanDelay('betweenActions'));

        // Fill month (custom dropdown - click to open, then select option)
        const monthXPath = '/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[2]/div/div/div/form/span/section/div/div/div[1]/div[1]/div[2]/div/div[1]';
        let monthFilled = false;

        try {
            // Click on month dropdown to open it
            await page.waitForXPath(monthXPath, { timeout: 5000 });
            const monthDropdowns = await page.$x(monthXPath);
            if (monthDropdowns.length > 0) {
                await monthDropdowns[0].click();
                logger.info('Month dropdown opened');
                await page.waitForTimeout(1000); // Wait for dropdown menu to appear

                // Select month option by data-value (1-12)
                const monthOptionXPath = `//li[@role="option"][@data-value="${birthMonth}"]`;
                await page.waitForXPath(monthOptionXPath, { timeout: 3000 });
                const monthOptions = await page.$x(monthOptionXPath);
                if (monthOptions.length > 0) {
                    await monthOptions[0].click();
                    logger.info('Month selected', { month: birthMonth });
                    monthFilled = true;
                } else {
                    // Fallback: try to find by text
                    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
                    const monthName = monthNames[birthMonth - 1];
                    const monthTextXPath = `//li[@role="option"]//span[contains(text(), "${monthName}")]`;
                    const monthTextOptions = await page.$x(monthTextXPath);
                    if (monthTextOptions.length > 0) {
                        await monthTextOptions[0].click();
                        logger.info('Month selected by text', { month: monthName });
                        monthFilled = true;
                    }
                }
            }
        } catch (e) {
            logger.debug('Month XPath method failed, trying fallback', { error: e.message });
        }

        // Fallback to old method if XPath failed
        if (!monthFilled) {
            const monthSelectors = [
                '#month',
                'select[name="month"]',
                'select[aria-label*="month" i]'
            ];

            for (const selector of monthSelectors) {
                try {
                    const select = await waitForElement(page, selector, 3000);
                    if (select) {
                        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                            'July', 'August', 'September', 'October', 'November', 'December'];
                        const monthName = monthNames[birthMonth - 1];
                        await select.select({ label: monthName });
                        logger.info('Month selected by fallback method', { month: monthName });
                        monthFilled = true;
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }
        }

        if (!monthFilled) {
            logger.warn('Could not find month select field');
        }

        await page.waitForTimeout(500);

        // Fill year
        const yearSelectors = [
            'input[name="year"]',
            'input[aria-label*="year" i]',
            'input[type="number"][aria-label*="year" i]'
        ];

        let yearFilled = false;
        for (const selector of yearSelectors) {
            try {
                const input = await waitForElement(page, selector, 3000);
                if (input) {
                    await input.click({ clickCount: 3 });
                    await page.waitForTimeout(200);
                    await humanLikeType(page, input, birthYear.toString(), {
                        minDelay: 60,
                        maxDelay: 120,
                        mistakeChance: 0.05,
                        pauseChance: 0.10
                    });
                    logger.info('Year entered', { year: birthYear });
                    yearFilled = true;
                    break;
                }
            } catch (e) {
                continue;
            }
        }

        if (!yearFilled) {
            logger.warn('Could not find year input field');
        }

        await page.waitForTimeout(500);

        // Select gender (custom dropdown - click to open, then select option)
        const genderXPath = '/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[2]/div/div/div/form/span/section/div/div/div[2]/div[1]/div[1]';
        
        // User-provided XPath selectors for gender options
        const genderOptionXPaths = {
            'male': '/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[2]/div/div/div/form/span/section/div/div/div[2]/div[1]/div[1]/div/div[2]/ul/li[1]', // رجل
            'female': '/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[2]/div/div/div/form/span/section/div/div/div[2]/div[1]/div[1]/div/div[2]/ul/li[2]' // بنت
        };

        const genderTextMap = {
            'male': 'Male',
            'female': 'Female'
        };
        const genderText = genderTextMap[accountData.gender] || 'Male'; // Default to Male
        const selectedGender = accountData.gender || 'male';

        let genderFilled = false;

        try {
            // Click on gender dropdown to open it
            await page.waitForXPath(genderXPath, { timeout: 5000 });
            const genderDropdowns = await page.$x(genderXPath);
            if (genderDropdowns.length > 0) {
                await genderDropdowns[0].click();
                logger.info('Gender dropdown opened');
                await page.waitForTimeout(1500); // Wait for dropdown menu to appear

                // Try user-provided XPath first (most reliable)
                const userProvidedXPath = genderOptionXPaths[selectedGender];
                if (userProvidedXPath) {
                    try {
                        await page.waitForXPath(userProvidedXPath, { timeout: 3000 });
                        const genderOptions = await page.$x(userProvidedXPath);
                        if (genderOptions.length > 0) {
                            // Check if element is visible
                            const isVisible = await page.evaluate(el => {
                                const style = window.getComputedStyle(el);
                                return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
                            }, genderOptions[0]);

                            if (isVisible) {
                                await genderOptions[0].click();
                                logger.info('Gender selected by user-provided XPath', { gender: genderText, xpath: userProvidedXPath });
                                genderFilled = true;
                            }
                        }
                    } catch (e) {
                        logger.debug('User-provided XPath failed, trying fallback methods', { error: e.message });
                    }
                }

                // Fallback: try by data-value if user-provided XPath failed
                if (!genderFilled) {
                    const genderValueMap = {
                        'male': '1',
                        'female': '2'
                    };
                    const genderDataValue = genderValueMap[selectedGender] || '1';
                    const genderOptionXPath = `//li[@role="option"][@data-value="${genderDataValue}"]`;
                    try {
                        await page.waitForXPath(genderOptionXPath, { timeout: 3000 });
                        const genderOptions = await page.$x(genderOptionXPath);
                        if (genderOptions.length > 0) {
                            await genderOptions[0].click();
                            logger.info('Gender selected by data-value', { gender: genderText, dataValue: genderDataValue });
                            genderFilled = true;
                        }
                    } catch (e) {
                        logger.debug('Data-value method failed, trying text search', { error: e.message });
                    }
                }

                // Fallback: try to find by text
                if (!genderFilled) {
                    const genderTextXPath = `//li[@role="option"]//span[contains(text(), "${genderText}")]`;
                    try {
                        const genderTextOptions = await page.$x(genderTextXPath);
                        if (genderTextOptions.length > 0) {
                            await genderTextOptions[0].click();
                            logger.info('Gender selected by text', { gender: genderText });
                            genderFilled = true;
                        }
                    } catch (e) {
                        logger.debug('Text search method failed', { error: e.message });
                    }
                }
            }
        } catch (e) {
            logger.debug('Gender dropdown click failed, trying fallback', { error: e.message });
        }

        // Final fallback: try CSS selectors
        if (!genderFilled) {
            const genderSelectors = [
                '#gender',
                'select[name="gender"]',
                'select[aria-label*="gender" i]'
            ];

            for (const selector of genderSelectors) {
                try {
                    const select = await waitForElement(page, selector, 3000);
                    if (select) {
                        await select.select(genderText);
                        logger.info('Gender selected by CSS selector fallback', { gender: genderText });
                        genderFilled = true;
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }
        }

        if (!genderFilled) {
            logger.warn('Could not find gender select field');
            // Try one more time with a different approach
            try {
                // Try clicking the dropdown again and using the direct XPath
                const genderDropdownXPath = '/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[2]/div/div/div/form/span/section/div/div/div[2]/div[1]/div[1]';
                const dropdowns = await page.$x(genderDropdownXPath);
                if (dropdowns.length > 0) {
                    await dropdowns[0].click();
                    await page.waitForTimeout(1500);
                    
                    const directGenderXPath = genderOptionXPaths[selectedGender];
                    if (directGenderXPath) {
                        const options = await page.$x(directGenderXPath);
                        if (options.length > 0) {
                            await options[0].click();
                            logger.info('Gender selected on retry', { gender: genderText });
                            genderFilled = true;
                        }
                    }
                }
            } catch (e) {
                logger.warn('Retry gender selection failed', { error: e.message });
            }
        }

        // Wait for gender dropdown to close after selection
        if (genderFilled) {
            await page.waitForTimeout(1000);
            logger.info('Gender selection completed, waiting for dropdown to close');
        }

        await page.waitForTimeout(500);

        // Verify all fields were filled before clicking Next
        const allFieldsFilled = dayFilled && monthFilled && yearFilled && genderFilled;
        if (!allFieldsFilled) {
            logger.warn('Not all birthday/gender fields were filled', {
                dayFilled,
                monthFilled,
                yearFilled,
                genderFilled
            });
            // Continue anyway - might still work
        } else {
            logger.info('All birthday/gender fields filled successfully');
        }

        // Click Next button - use specific XPath for birthday/gender page
        const birthdayNextButtonXPath = '/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[3]/div/div/div/div/button';
        let nextClicked = false;

        // Try specific XPath for birthday/gender page first
        try {
            await page.waitForXPath(birthdayNextButtonXPath, { timeout: 5000 });
            const nextButtons = await page.$x(birthdayNextButtonXPath);
            if (nextButtons.length > 0) {
                const button = nextButtons[0];
                const isVisible = await page.evaluate(el => {
                    const style = window.getComputedStyle(el);
                    return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
                }, button);
                const isDisabled = await page.evaluate(el => el.disabled, button);

                if (isVisible && !isDisabled) {
                    await button.click();
                    logger.info('Next button clicked (Birthday/Gender page specific XPath)');
                    nextClicked = true;
                } else {
                    logger.debug('Next button found but not clickable', { isVisible, isDisabled });
                }
            }
        } catch (e) {
            logger.debug('Birthday/Gender specific XPath failed, trying general method', { error: e.message });
        }

        // Fallback to general clickNextButton function
        if (!nextClicked) {
            nextClicked = await clickNextButton(page);
        }

        if (!nextClicked) {
            throw new Error('Could not click Next button after filling birthday and gender');
        }

        // Wait for page to navigate after clicking Next
        await page.waitForTimeout(3000);

        // Verify we're no longer on the birthday/gender page
        const pageAfterNext = await detectGmailPage(page);
        if (pageAfterNext && pageAfterNext.type === 'BIRTHDAY_GENDER') {
            logger.warn('Still on Birthday/Gender page after clicking Next, waiting longer...');
            await page.waitForTimeout(3000);
            const pageAfterWait = await detectGmailPage(page);
            if (pageAfterWait) {
                logger.info('Page after additional wait', {
                    type: pageAfterWait.type,
                    method: pageAfterWait.method || 'unknown',
                    url: page.url()
                });
            }
        } else if (pageAfterNext) {
            logger.info('Successfully navigated away from Birthday/Gender page', {
                newPageType: pageAfterNext.type,
                method: pageAfterNext.method || 'unknown',
                url: page.url()
            });
        }

        logger.info('Birthday and gender form filled successfully');
    } catch (error) {
        logger.error('Failed to fill birthday and gender form', { error: error.message });
        throw error;
    }
}

/**
 * Wait for reCAPTCHA to be solved
 * انتظار حل reCAPTCHA
 */
async function waitForRecaptcha(page) {
    try {
        logger.info('Waiting for reCAPTCHA to be solved...');

        // Wait for reCAPTCHA iframe to appear
        let recaptchaFound = false;
        for (let i = 0; i < 30; i++) {
            const iframe = await page.$('iframe[src*="recaptcha"]');
            if (iframe) {
                recaptchaFound = true;
                logger.info('reCAPTCHA iframe found, waiting for solution...');
                break;
            }
            await page.waitForTimeout(1000);
        }

        if (recaptchaFound) {
            // Wait for reCAPTCHA to be solved (extension should handle it)
            // Check if reCAPTCHA is solved by looking for success indicators
            for (let i = 0; i < 60; i++) {
                const isSolved = await page.evaluate(() => {
                    // Check for reCAPTCHA success indicators
                    const iframe = document.querySelector('iframe[src*="recaptcha"]');
                    if (!iframe) return true; // No reCAPTCHA means it's passed

                    // Check if form can proceed (Next button enabled)
                    const nextButton = Array.from(document.querySelectorAll('button')).find(btn =>
                        btn.textContent.includes('Next') || btn.textContent.includes('التالي')
                    );
                    return nextButton && !nextButton.disabled;
                });

                if (isSolved) {
                    logger.info('reCAPTCHA appears to be solved');
                    break;
                }

                await page.waitForTimeout(1000);
            }
        }

        await page.waitForTimeout(2000);
    } catch (error) {
        logger.warn('Error waiting for reCAPTCHA', { error: error.message });
        // Continue anyway
    }
}

/**
 * Handle phone verification
 * التعامل مع التحقق من الهاتف
 */
async function handlePhoneVerification(page, accountData = null) {
    let phoneOrder = null; // Initialize phoneOrder to null to avoid undefined errors
    try {
        logger.info('Handling phone verification');

        // Human behavior: Wait and explore page before phone verification
        // سلوك بشري: الانتظار واستكشاف الصفحة قبل التحقق من الهاتف
        await humanSleep(getHumanDelay('pageLoad'));
        await simulateReading(page, { duration: 1500 + Math.random() * 1000, scrollWhileReading: false });

        // Wait for phone verification page to appear (if not already there)
        logger.info('Waiting for phone verification page to load...');
        let phonePageReady = false;
        for (let i = 0; i < 10; i++) {
            const currentUrl = page.url();
            const pageInfo = await detectGmailPage(page);
            
            // Check if we're still on password page - if so, fill password and click Next
            // التحقق من أننا ما زلنا في صفحة كلمة المرور - إذا كان الأمر كذلك، املأ كلمة المرور واضغط Next
            if ((currentUrl.includes('/password') || (pageInfo && pageInfo.type === 'PASSWORD_INPUT')) && accountData) {
                logger.info('Still on password page in handlePhoneVerification, filling password and clicking Next', { 
                    url: currentUrl,
                    pageType: pageInfo?.type 
                });
                
                try {
                    // Fill password fields
                    const passwordFields = await page.$$('input[type="password"]');
                    if (passwordFields.length > 0) {
                        for (let j = 0; j < Math.min(passwordFields.length, 2); j++) {
                            try {
                                const input = passwordFields[j];
                                const isVisible = await page.evaluate((element) => {
                                    if (!element) return false;
                                    const style = window.getComputedStyle(element);
                                    return style.display !== 'none' && 
                                           style.visibility !== 'hidden' && 
                                           element.offsetParent !== null &&
                                           !element.disabled;
                                }, input);
                                
                                if (isVisible) {
                                    const currentValue = await input.evaluate(el => el.value);
                                    if (!currentValue || currentValue.trim() === '') {
                                        await input.click({ clickCount: 3 });
                                        await page.waitForTimeout(200);
                                        await page.keyboard.press('Delete');
                                        await page.waitForTimeout(200);
                                        await input.type(accountData.password, { delay: 50 });
                                        logger.info(`Password field ${j + 1} filled in handlePhoneVerification`);
                                    }
                                }
                            } catch (e) {
                                logger.debug(`Error filling password field ${j + 1}`, { error: e.message });
                            }
                        }
                        
                        // Click Next button
                        await page.waitForTimeout(1000);
                        const nextClicked = await clickNextButton(page);
                        if (nextClicked) {
                            logger.info('Next button clicked on password page in handlePhoneVerification');
                            await page.waitForTimeout(3000); // Wait for navigation
                            // Continue to check for phone page
                            continue;
                        }
                    }
                } catch (passwordError) {
                    logger.warn('Error handling password page in handlePhoneVerification', { error: passwordError.message });
                }
            }
            
            // Check if we're on phone verification page by URL
            const isPhonePageByUrl = currentUrl.includes('/collectemailphone') || 
                                     currentUrl.includes('/challenge/phone') || 
                                     currentUrl.includes('/verification/phone') ||
                                     currentUrl.includes('/challenge/sms') ||
                                     currentUrl.includes('/verification/sms');
            
            // Check if we're on phone verification page by page detection
            const isPhonePageByType = pageInfo && (pageInfo.type === 'PHONE_VERIFICATION' || pageInfo.type === 'VERIFICATION_CODE');
            
            // Check for phone input field directly
            const hasPhoneInput = await page.evaluate(() => {
                return !!(
                    document.querySelector('input[type="tel"]') ||
                    document.querySelector('input[name="phoneNumberId"]') ||
                    document.querySelector('input[aria-label*="phone" i]') ||
                    document.querySelector('input[aria-label*="Phone" i]')
                );
            });
            
            if (isPhonePageByUrl || isPhonePageByType || hasPhoneInput) {
                logger.info('Phone verification page is ready', { 
                    type: pageInfo?.type, 
                    method: pageInfo?.method || 'unknown',
                    url: currentUrl,
                    hasPhoneInput 
                });
                phonePageReady = true;
                break;
            }
            
            await page.waitForTimeout(1000);
        }
        
        if (!phonePageReady) {
            logger.warn('Phone verification page not detected, but attempting anyway', { url: page.url() });
        }

        // Wait for phone input page to load
        await page.waitForTimeout(2000);

        // First, try to check if we can skip phone verification
        logger.info('Checking if phone verification can be skipped...');
        const canSkipPhone = await page.evaluate(() => {
            // Look for Skip button or link
            const skipButtons = Array.from(document.querySelectorAll('button, a, span')).filter(el => {
                const text = el.textContent.toLowerCase().trim();
                return (text.includes('skip') || text.includes('not now') || text.includes('maybe later') || 
                        text.includes('تخطي') || text.includes('لاحقاً')) &&
                       el.offsetParent !== null && !el.disabled;
            });
            
            // Also check if phone field is optional (has skip option nearby)
            const phoneInput = document.querySelector('input[type="tel"], input[name="phoneNumberId"]');
            if (phoneInput) {
                // Check if there's a "Skip" option in the same section
                const parentSection = phoneInput.closest('form, div[role="main"], main');
                if (parentSection) {
                    const skipInSection = parentSection.textContent.toLowerCase().includes('skip') ||
                                        parentSection.textContent.toLowerCase().includes('not now') ||
                                        parentSection.textContent.toLowerCase().includes('تخطي');
                    if (skipInSection) return true;
                }
            }
            
            return skipButtons.length > 0;
        });

        if (canSkipPhone) {
            logger.info('Skip option detected! Attempting to skip phone verification...');
            try {
                // Try to find and click Skip button
                const skipClicked = await page.evaluate(() => {
                    const buttons = Array.from(document.querySelectorAll('button, a, span'));
                    const skipButton = buttons.find(btn => {
                        const text = btn.textContent.toLowerCase().trim();
                        return (text.includes('skip') || text.includes('not now') || text.includes('maybe later') || 
                                text.includes('تخطي') || text.includes('لاحقاً')) &&
                               btn.offsetParent !== null && !btn.disabled;
                    });
                    
                    if (skipButton) {
                        skipButton.click();
                        return true;
                    }
                    return false;
                });

                if (skipClicked) {
                    logger.info('Skip button clicked successfully! Phone verification skipped.');
                    await page.waitForTimeout(2000);
                    
                    // Check if we successfully skipped (no phone input on page)
                    const stillHasPhonePage = await page.evaluate(() => {
                        return !!(
                            document.querySelector('input[type="tel"]') ||
                            document.querySelector('input[name="phoneNumberId"]') ||
                            document.querySelector('input[aria-label*="phone" i]')
                        );
                    });

                    if (!stillHasPhonePage) {
                        logger.info('Successfully skipped phone verification, continuing...');
                        // Return empty object to indicate phone verification was skipped
                        return { phone: null, code: null, orderId: null, skipped: true };
                    } else {
                        logger.warn('Skip button clicked but phone page still present, will proceed with phone verification');
                    }
                } else {
                    logger.warn('Skip option detected but button not clickable, will proceed with phone verification');
                }
            } catch (skipError) {
                logger.warn('Error attempting to skip phone verification', { error: skipError.message });
            }
        } else {
            logger.info('No skip option found, phone verification is required');
        }

        // If skip didn't work or wasn't available, proceed with phone verification
        // Buy phone number using countries from config
        // شراء رقم هاتف باستخدام الدول من الإعدادات
        logger.info('Buying phone number from SMS API');
        
        // Get country selection (will use FIVESIM_COUNTRY from .env if using 5SIM Legacy)
        // الحصول على اختيار الدولة (سيستخدم FIVESIM_COUNTRY من .env إذا كان يستخدم 5SIM Legacy)
        const { countries, selectedCountry } = getCountrySelection();
        const maxPrice = 50; // Maximum price in rubles
        
        logger.info('Selected country for phone number', { 
            country: selectedCountry.name, 
            countryCode: selectedCountry.code,
            maxPrice: `${maxPrice} rubles`
        });
        
        // phoneOrder is already initialized at function start
        
        try {
            // Check if API key is configured before attempting to buy
            const apiKey = process.env.SMS_VERIFY_API_KEY || process.env.FIVESIM_API_KEY;
            if (!apiKey) {
                throw new Error('SMS Verification API key is not configured. Please set SMS_VERIFY_API_KEY or FIVESIM_API_KEY in your .env file');
            }
            
            // Use service, country, and operator from .env if using 5SIM Legacy, otherwise use defaults
            // استخدام الخدمة والدولة والمشغل من .env إذا كان يستخدم 5SIM Legacy، وإلا استخدم القيم الافتراضية
            const service = process.env.FIVESIM_SERVICE || 'go'; // 'go' is Google service code
            const operator = process.env.FIVESIM_OPERATOR || 'any';
            
            phoneOrder = await smsApi.buySmsVerifyNumber(service, selectedCountry.code, operator, { maxPrice });
            logger.info('Phone number purchased successfully', { 
                phone: phoneOrder.phone, 
                orderId: phoneOrder.id, 
                country: selectedCountry.name,
                countryCode: selectedCountry.code,
                maxPrice: `${maxPrice} rubles`
            });
        } catch (error) {
            // Handle specific error cases
            if (error.message.includes('BAD_KEY') || error.message.includes('Invalid API key')) {
                logger.error('SMS Verification API key is invalid or expired', { 
                    error: error.message,
                    hint: 'Please check your SMS_VERIFY_API_KEY in .env file and make sure it is correct and active'
                });
                throw new Error('Invalid SMS Verification API key. Please check your SMS_VERIFY_API_KEY in .env file');
            }
            
            if (error.message.includes('not configured') || error.message.includes('not set')) {
                logger.error('SMS Verification API key is not configured', { 
                    error: error.message,
                    hint: 'Please set SMS_VERIFY_API_KEY in your .env file'
                });
                throw new Error('SMS Verification API key is not configured. Please set SMS_VERIFY_API_KEY in .env file');
            }
            
            // If numbers are not available, try the other country
            if (error.message.includes('NO_NUMBERS') || error.message.includes('No numbers available')) {
                logger.warn('Phone numbers not available for selected country, trying other country', { 
                    error: error.message,
                    country: selectedCountry.name,
                    countryCode: selectedCountry.code,
                    service: 'go',
                    maxPrice: `${maxPrice} rubles`
                });
                
                // Try the other country
                const otherCountry = countries.find(c => c.code !== selectedCountry.code);
                if (otherCountry) {
                    logger.info(`Trying ${otherCountry.name} instead...`);
                    try {
                        const service = process.env.FIVESIM_SERVICE || 'go';
                        const operator = process.env.FIVESIM_OPERATOR || 'any';
                        phoneOrder = await smsApi.buySmsVerifyNumber(service, otherCountry.code, operator, { maxPrice });
                        logger.info('Phone number purchased successfully from alternative country', { 
                            phone: phoneOrder.phone, 
                            orderId: phoneOrder.id, 
                            country: otherCountry.name,
                            countryCode: otherCountry.code,
                            maxPrice: `${maxPrice} rubles`
                        });
                    } catch (retryError) {
                        logger.error('Failed to buy phone number from alternative country', { 
                            error: retryError.message,
                            country: otherCountry.name
                        });
                        throw new Error(`Phone numbers not available for both countries: ${error.message}`);
                    }
                } else {
                    throw new Error(`${selectedCountry.name} phone numbers not available: ${error.message}`);
                }
            } else {
                // Re-throw other errors
                logger.error('Failed to buy phone number', { 
                    error: error.message,
                    country: selectedCountry.name,
                    countryCode: selectedCountry.code
                });
                throw error;
            }
        }
        
        // Ensure phoneOrder is defined
        if (!phoneOrder || !phoneOrder.id) {
            throw new Error('Failed to purchase phone number: phoneOrder is not defined');
        }

        // Format phone number with + prefix
        const formattedPhone = phoneOrder.phone.startsWith('+') ? phoneOrder.phone : `+${phoneOrder.phone}`;
        logger.info('Formatted phone number', { original: phoneOrder.phone, formatted: formattedPhone });

        // Enter phone number using specific XPath first, then fallback to other selectors
        const phoneInputXPath = '/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[2]/div/div/div/form/span/section/div/div/div[1]/div[1]/div[1]/div/div[1]/input';
        let phoneEntered = false;

        // Helper function to clear phone input field completely
        // دالة مساعدة لمسح حقل رقم الهاتف بالكامل
        const clearPhoneInput = async (input, selector = null) => {
            try {
                // Method 1: Clear via JavaScript (most reliable)
                if (selector) {
                    await page.evaluate((sel) => {
                        const input = document.querySelector(sel);
                        if (input) {
                            input.value = '';
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                            input.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    }, selector);
                } else {
                    await input.evaluate(el => {
                        el.value = '';
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                    });
                }
                await page.waitForTimeout(100);
                
                // Method 2: Focus and select all, then delete
                await input.focus();
                await page.waitForTimeout(100);
                await page.keyboard.down('Control');
                await page.keyboard.press('a');
                await page.keyboard.up('Control');
                await page.waitForTimeout(100);
                await page.keyboard.press('Delete');
                await page.waitForTimeout(100);
                await page.keyboard.press('Backspace'); // Extra clear
                await page.waitForTimeout(100);
                
                // Method 3: Triple click and delete (fallback)
                await input.click({ clickCount: 3 });
                await page.waitForTimeout(100);
                await page.keyboard.press('Delete');
                await page.waitForTimeout(100);
            } catch (clearError) {
                logger.debug('Error clearing phone input, continuing anyway', { error: clearError.message });
            }
        };

        // Try XPath first (user-provided)
        try {
            await page.waitForXPath(phoneInputXPath, { timeout: 5000 });
            const phoneInputs = await page.$x(phoneInputXPath);
            if (phoneInputs.length > 0) {
                const input = phoneInputs[0];
                await clearPhoneInput(input);
                await input.type(formattedPhone, { delay: 50 });
                const enteredValue = await input.evaluate(el => el.value);
                logger.info('Phone number entered (XPath)', { 
                    phone: formattedPhone, 
                    entered: enteredValue 
                });
                phoneEntered = true;
            }
        } catch (e) {
            logger.debug('XPath phone input not found, trying other selectors', { error: e.message });
        }

        // Fallback to other selectors
        if (!phoneEntered) {
            const phoneSelectors = [
                'input[type="tel"]',
                'input[name="phoneNumberId"]',
                'input[aria-label*="phone" i]',
                'input[aria-label*="Phone" i]'
            ];

            for (const selector of phoneSelectors) {
                try {
                    const input = await waitForElement(page, selector, 3000);
                    if (input) {
                        await clearPhoneInput(input, selector);
                        await input.type(formattedPhone, { delay: 50 });
                        const enteredValue = await input.evaluate(el => el.value);
                        logger.info('Phone number entered', { 
                            selector, 
                            phone: formattedPhone,
                            entered: enteredValue
                        });
                        phoneEntered = true;
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }
        }

        if (!phoneEntered) {
            throw new Error('Could not find phone number input field');
        }

        await page.waitForTimeout(500);

        // Click Next button (using specific XPath for phone page)
        const nextButtonXPath = '/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[3]/div/div/div/div/button';
        let nextClicked = false;

        // Try specific XPath first
        try {
            await page.waitForXPath(nextButtonXPath, { timeout: 5000 });
            const nextButtons = await page.$x(nextButtonXPath);
            if (nextButtons.length > 0) {
                const button = nextButtons[0];
                const isVisible = await button.evaluate(el => el.offsetParent !== null);
                const isDisabled = await button.evaluate(el => el.disabled);
                if (isVisible && !isDisabled) {
                    await button.click();
                    logger.info('Next button clicked (XPath for phone page)');
                    nextClicked = true;
                }
            }
        } catch (e) {
            logger.debug('XPath Next button not found, trying other methods', { error: e.message });
        }

        // Fallback to general clickNextButton function
        if (!nextClicked) {
            nextClicked = await clickNextButton(page);
        }

        if (!nextClicked) {
            throw new Error('Could not click Next button after entering phone number');
        }

        await page.waitForTimeout(2000);

        // Check for error message "This phone number has been used too many times" - retry up to 20 times
        const maxPhoneRetries = 5;
        let phoneRetryCount = 0;
        let phoneErrorResolved = false;

        while (phoneRetryCount < maxPhoneRetries && !phoneErrorResolved) {
            // Check for error message "This phone number has been used too many times"
            const hasPhoneError = await page.evaluate(() => {
                const errorMessages = [
                    'This phone number has been used too many times',
                    'phone number has been used too many times',
                    'used too many times',
                    'هذا الرقم مستخدم كثيراً',
                    'الرقم مستخدم كثيراً'
                ];
                
                // Check for error message in the page
                const pageText = document.body.textContent || document.body.innerText || '';
                const hasErrorText = errorMessages.some(msg => pageText.toLowerCase().includes(msg.toLowerCase()));
                
                // Also check for aria-invalid="true" on phone input
                const phoneInput = document.querySelector('input[type="tel"]#phoneNumberId, input[name="phoneNumberId"]');
                const hasAriaInvalid = phoneInput && phoneInput.getAttribute('aria-invalid') === 'true';
                
                // Check for error div with class containing "error" or "Ekjuhf"
                const errorDiv = document.querySelector('.Ekjuhf, .Jj6Lae, [aria-live="polite"]');
                const hasErrorDiv = errorDiv && (errorDiv.textContent.includes('used too many times') || errorDiv.textContent.includes('phone number'));
                
                return hasErrorText || hasAriaInvalid || hasErrorDiv;
            });

            if (!hasPhoneError) {
                // No error, continue to OTP step
                logger.info('No phone number error detected, proceeding to OTP step');
                phoneErrorResolved = true;
                break;
            }

            phoneRetryCount++;
            logger.warn(`Phone number error detected: "This phone number has been used too many times" (attempt ${phoneRetryCount}/${maxPhoneRetries})`);
            
            // Cancel the current SMS order
            if (phoneOrder && phoneOrder.id) {
                try {
                    logger.info(`Cancelling SMS order ${phoneOrder.id} due to phone number error...`);
                    await smsApi.cancelSmsVerifyOrder(phoneOrder.id);
                    logger.info(`SMS order ${phoneOrder.id} cancelled successfully`);
                } catch (cancelError) {
                    logger.warn(`Failed to cancel SMS order ${phoneOrder.id}`, { error: cancelError.message });
                }
            }

            // Buy new phone number using getCountrySelection() (respects .env settings)
            // شراء رقم هاتف جديد باستخدام getCountrySelection() (يحترم إعدادات .env)
            logger.info(`Buying new phone number due to error - attempt ${phoneRetryCount}/${maxPhoneRetries}...`);
            try {
                // Use getCountrySelection() which handles both 5SIM Legacy and SMS Verification
                const { selectedCountry } = getCountrySelection();
                const maxPrice = 50; // Maximum price in rubles
                
                logger.info('Selected country for new phone number', { 
                    country: selectedCountry.name, 
                    countryCode: selectedCountry.code,
                    maxPrice: `${maxPrice} rubles`
                });
                
                const service = process.env.FIVESIM_SERVICE || 'go';
                const operator = process.env.FIVESIM_OPERATOR || 'any';
                const newPhoneOrder = await smsApi.buySmsVerifyNumber(service, selectedCountry.code, operator, { maxPrice });
                
                // Validate the phone order result
                // التحقق من صحة نتيجة طلب الهاتف
                if (!newPhoneOrder || !newPhoneOrder.phone) {
                    throw new Error('No phone number returned from SMS API (NO_NUMBERS or API error)');
                }
                
                logger.info('New phone number purchased', { 
                    phone: newPhoneOrder.phone, 
                    orderId: newPhoneOrder.id,
                    country: selectedCountry.name,
                    countryCode: selectedCountry.code,
                    maxPrice: `${maxPrice} rubles`
                });

                // Update phoneOrder reference
                phoneOrder = newPhoneOrder;

                // Format phone number with + prefix (ensure full number with country code)
                let newFormattedPhone = newPhoneOrder.phone;
                if (newFormattedPhone && !newFormattedPhone.startsWith('+')) {
                    newFormattedPhone = `+${newFormattedPhone}`;
                }
                logger.info('Formatted new phone number after error', { 
                    original: newPhoneOrder.phone, 
                    formatted: newFormattedPhone,
                    length: newFormattedPhone.length
                });

                // Clear and enter new phone number - clear field completely first
                const phoneInputSelectors = [
                    'input[type="tel"]#phoneNumberId',
                    'input[name="phoneNumberId"]',
                    'input[type="tel"]',
                    'input[aria-label*="phone" i]',
                    'input[aria-label*="Phone" i]'
                ];

                let newPhoneEntered = false;
                for (const selector of phoneInputSelectors) {
                    try {
                        const input = await waitForElement(page, selector, 3000);
                        if (input) {
                            // Clear the field completely using multiple methods
                            // مسح الحقل بالكامل باستخدام طرق متعددة
                            
                            // Method 1: Clear via JavaScript (most reliable)
                            await page.evaluate((sel) => {
                                const input = document.querySelector(sel);
                                if (input) {
                                    input.value = '';
                                    input.dispatchEvent(new Event('input', { bubbles: true }));
                                    input.dispatchEvent(new Event('change', { bubbles: true }));
                                }
                            }, selector);
                            await page.waitForTimeout(100);
                            
                            // Method 2: Focus and select all, then delete
                            await input.focus();
                            await page.waitForTimeout(100);
                            await page.keyboard.down('Control');
                            await page.keyboard.press('a');
                            await page.keyboard.up('Control');
                            await page.waitForTimeout(100);
                            await page.keyboard.press('Delete');
                            await page.waitForTimeout(100);
                            await page.keyboard.press('Backspace'); // Extra clear with Backspace
                            await page.waitForTimeout(100);
                            
                            // Method 3: Triple click and delete (fallback)
                            await input.click({ clickCount: 3 });
                            await page.waitForTimeout(100);
                            await page.keyboard.press('Delete');
                            await page.waitForTimeout(100);
                            
                            // Verify field is empty before typing
                            const fieldValue = await input.evaluate(el => el.value);
                            if (fieldValue && fieldValue.trim() !== '') {
                                logger.warn('Field not empty after clearing, clearing again', { value: fieldValue });
                                await page.evaluate((sel) => {
                                    const input = document.querySelector(sel);
                                    if (input) input.value = '';
                                }, selector);
                                await page.waitForTimeout(100);
                            }
                            
                            // Type the full phone number with +
                            await input.type(newFormattedPhone, { delay: 50 });
                            
                            // Verify the number was entered correctly
                            const enteredValue = await input.evaluate(el => el.value);
                            logger.info('New phone number entered after error', { 
                                selector, 
                                phone: newFormattedPhone,
                                length: newFormattedPhone.length,
                                entered: enteredValue
                            });
                            newPhoneEntered = true;
                            break;
                        }
                    } catch (e) {
                        continue;
                    }
                }

                if (!newPhoneEntered) {
                    throw new Error('Could not find phone input field for new number');
                }

                await page.waitForTimeout(1000);

                // Click Next button again
                nextClicked = false;
                try {
                    await page.waitForXPath(nextButtonXPath, { timeout: 5000 });
                    const nextButtons = await page.$x(nextButtonXPath);
                    if (nextButtons.length > 0) {
                        const button = nextButtons[0];
                        const isVisible = await button.evaluate(el => el.offsetParent !== null);
                        const isDisabled = await button.evaluate(el => el.disabled);
                        if (isVisible && !isDisabled) {
                            await button.click();
                            logger.info('Next button clicked again after entering new phone number');
                            nextClicked = true;
                        }
                    }
                } catch (e) {
                    logger.debug('XPath Next button not found, trying other methods', { error: e.message });
                }

                if (!nextClicked) {
                    nextClicked = await clickNextButton(page);
                }

                if (!nextClicked) {
                    logger.error(`Could not click Next button after entering new phone number (attempt ${phoneRetryCount}/${maxPhoneRetries})`);
                    if (phoneRetryCount < maxPhoneRetries) {
                        await page.waitForTimeout(2000);
                        continue; // Try again with new number
                    } else {
                        throw new Error('Could not click Next button after entering new phone number');
                    }
                }

                await page.waitForTimeout(2000);

                // Check again if error is resolved after clicking Next
                const stillHasError = await page.evaluate(() => {
                    const errorMessages = [
                        'This phone number has been used too many times',
                        'phone number has been used too many times',
                        'used too many times'
                    ];
                    
                    const pageText = document.body.textContent || document.body.innerText || '';
                    const hasErrorText = errorMessages.some(msg => pageText.toLowerCase().includes(msg.toLowerCase()));
                    
                    const phoneInput = document.querySelector('input[type="tel"]#phoneNumberId, input[name="phoneNumberId"]');
                    const hasAriaInvalid = phoneInput && phoneInput.getAttribute('aria-invalid') === 'true';
                    
                    const errorDiv = document.querySelector('.Ekjuhf, .Jj6Lae, [aria-live="polite"]');
                    const hasErrorDiv = errorDiv && (errorDiv.textContent.includes('used too many times') || errorDiv.textContent.includes('phone number'));
                    
                    return hasErrorText || hasAriaInvalid || hasErrorDiv;
                });

                if (!stillHasError) {
                    logger.info(`Phone number error resolved after attempt ${phoneRetryCount}, proceeding to OTP step`);
                    phoneErrorResolved = true;
                    break; // Exit retry loop, continue to OTP step
                } else {
                    logger.warn(`Phone number error still present after attempt ${phoneRetryCount}, will retry...`);
                    await page.waitForTimeout(1000);
                }

            } catch (buyError) {
                logger.error(`Failed to buy new phone number after error (attempt ${phoneRetryCount}/${maxPhoneRetries})`, { error: buyError.message });
                if (phoneRetryCount >= maxPhoneRetries) {
                    throw new Error(`Failed to buy new phone number after ${maxPhoneRetries} attempts: ${buyError.message}`);
                }
                await page.waitForTimeout(1000);
                continue; // Try again
            }
        }

        if (!phoneErrorResolved && phoneRetryCount >= maxPhoneRetries) {
            throw new Error(`Phone number error persisted after ${maxPhoneRetries} attempts`);
        }

        // If error was resolved, continue to OTP step
        if (phoneErrorResolved) {
            await page.waitForTimeout(2000);
        }

        // Retry logic: try up to 3 times to get verification code
        const maxRetries = 3;
        // Ensure phoneOrder is defined (from retry loop or initial purchase)
        if (!phoneOrder) {
            throw new Error('phoneOrder is not defined after phone verification retry loop');
        }
        let lastPhoneOrder = phoneOrder;
        let verificationCode = null;
        let success = false;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            logger.info(`Verification attempt ${attempt}/${maxRetries}`);

            // Wait for verification code page to appear
            logger.info('Waiting for verification code page...');
            let codePageDetected = false;
            for (let i = 0; i < 10; i++) {
                const currentUrl = page.url();
                if (currentUrl.includes('/challenge/phone') || currentUrl.includes('/verification/phone') ||
                    currentUrl.includes('/challenge/sms') || currentUrl.includes('/verification/sms')) {
                    codePageDetected = true;
                    logger.info('Verification code page detected', { url: currentUrl });
                    break;
                }
                await page.waitForTimeout(1000);
            }

            // Wait for verification code (2 minutes timeout)
            const waitTimeout = 120000; // 2 minutes in milliseconds (120 seconds)
            logger.info(`Waiting for verification code from SMS API (timeout: ${waitTimeout / 1000}s, order: ${lastPhoneOrder.id})...`);
            
            try {
                // Use 2 minutes timeout as specified
                verificationCode = await smsApi.waitForSmsVerifyCode(lastPhoneOrder.id, waitTimeout, 3000);
                logger.info('Verification code received', { code: verificationCode, attempt });

                // Enter verification code
                // إدخال رمز التحقق - استخدام محددات متعددة
                const codeSelectors = [
                    'input#code',                           // Direct ID selector (from user's HTML)
                    'input[name="code"]',                   // Name selector
                    'input[type="tel"][name="code"]',       // Tel type with code name
                    'input[type="tel"][id="code"]',         // Tel type with code id
                    'input[type="text"][maxlength="6"]',
                    'input[type="text"][maxlength="8"]',
                    'input[type="tel"][maxlength="6"]',     // Tel type with maxlength
                    'input[aria-label*="code" i]',
                    'input[aria-label*="Code" i]',
                    'input[aria-label*="الرمز" i]',         // Arabic "code"
                    'input[aria-label*="إدخال الرمز" i]',   // Arabic "enter code"
                    'input[aria-label*="verification" i]',
                    'input[aria-label*="Verification" i]'
                ];
                
                // Also try XPath from user's HTML
                // أيضاً جرب XPath من HTML المستخدم
                const codeInputXPath = '/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[2]/div/div/div/form/span/section/div/div/div[2]/div[1]/div[1]/div/div[1]/input';

                let codeEntered = false;
                
                // Try XPath first (most reliable from user's HTML)
                // جرب XPath أولاً (الأكثر موثوقية من HTML المستخدم)
                try {
                    await page.waitForXPath(codeInputXPath, { timeout: 5000 });
                    const codeInputs = await page.$x(codeInputXPath);
                    if (codeInputs.length > 0) {
                        const input = codeInputs[0];
                        await input.click({ clickCount: 3 });
                        await page.waitForTimeout(200);
                        // Type only the 6-digit code (without "G-" prefix if any)
                        const codeToEnter = verificationCode.code || verificationCode;
                        await humanLikeType(page, input, String(codeToEnter), {
                            minDelay: 80,
                            maxDelay: 200,
                            mistakeChance: 0.05,
                            pauseChance: 0.08
                        });
                        logger.info('Verification code entered (XPath)', { code: codeToEnter });
                        codeEntered = true;
                    }
                } catch (e) {
                    logger.debug('XPath code input not found, trying other selectors', { error: e.message });
                }
                
                // Fallback to CSS selectors
                if (!codeEntered) {
                    for (const selector of codeSelectors) {
                        try {
                            const input = await waitForElement(page, selector, 3000);
                            if (input) {
                                await input.click({ clickCount: 3 });
                                await page.waitForTimeout(200);
                                const codeToEnter = verificationCode.code || verificationCode;
                                await humanLikeType(page, input, String(codeToEnter), {
                                    minDelay: 80,
                                    maxDelay: 200,
                                    mistakeChance: 0.05,
                                    pauseChance: 0.08
                                });
                                logger.info('Verification code entered', { selector, code: codeToEnter });
                                codeEntered = true;
                                break;
                            }
                        } catch (e) {
                            continue;
                        }
                    }
                }

                if (!codeEntered) {
                    throw new Error('Could not find verification code input field');
                }

                await page.waitForTimeout(500);

                // Click Next button after entering code
                await clickNextButton(page);
                await page.waitForTimeout(2000);

                // Finish SMS order
                await smsApi.finishSmsVerifyOrder(lastPhoneOrder.id);
                logger.info('SMS order finished successfully');

                success = true;
                break; // Success, exit retry loop

            } catch (error) {
                // Check error type
                const isTimeout = error.message.includes('Timeout') || error.message.includes('timeout');
                const isCodeInputError = error.message.includes('Could not find verification code input');
                const codeWasReceived = verificationCode !== null;
                
                logger.warn(`Verification attempt ${attempt} failed`, { 
                    error: error.message, 
                    isTimeout,
                    isCodeInputError,
                    codeWasReceived,
                    attempt: `${attempt}/${maxRetries}`
                });

                // If code was received but couldn't find input field, retry entering the code
                // إذا تم استلام الكود ولكن لم يتم العثور على حقل الإدخال، أعد محاولة إدخال الكود
                if (codeWasReceived && isCodeInputError) {
                    logger.info('Code was received, retrying to enter it...');
                    
                    // Wait a bit for page to stabilize
                    await page.waitForTimeout(2000);
                    
                    // Retry entering the code without buying a new number
                    for (let retryEnter = 0; retryEnter < 3; retryEnter++) {
                        logger.info(`Retry entering code attempt ${retryEnter + 1}/3`);
                        
                        try {
                            // Try XPath first
                            const codeInputXPath = '/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[2]/div/div/div/form/span/section/div/div/div[2]/div[1]/div[1]/div/div[1]/input';
                            let codeEntered = false;
                            
                            try {
                                await page.waitForXPath(codeInputXPath, { timeout: 5000 });
                                const codeInputs = await page.$x(codeInputXPath);
                                if (codeInputs.length > 0) {
                                    const input = codeInputs[0];
                                    await input.click({ clickCount: 3 });
                                    await page.waitForTimeout(200);
                                    const codeToEnter = verificationCode.code || verificationCode;
                                    await humanLikeType(page, input, String(codeToEnter), {
                                        minDelay: 80,
                                        maxDelay: 200,
                                        mistakeChance: 0.05,
                                        pauseChance: 0.08
                                    });
                                    logger.info('Verification code entered on retry (XPath)', { code: codeToEnter });
                                    codeEntered = true;
                                }
                            } catch (e) {
                                logger.debug('XPath code input not found on retry', { error: e.message });
                            }
                            
                            // Fallback to CSS selectors
                            if (!codeEntered) {
                                const codeSelectors = [
                                    'input#code',
                                    'input[name="code"]',
                                    'input[type="tel"][name="code"]',
                                    'input[type="tel"][id="code"]',
                                    'input[type="text"][maxlength="6"]',
                                    'input[type="tel"][maxlength="6"]',
                                    'input[aria-label*="code" i]',
                                    'input[aria-label*="الرمز" i]'
                                ];
                                
                                for (const selector of codeSelectors) {
                                    try {
                                        const input = await waitForElement(page, selector, 3000);
                                        if (input) {
                                            await input.click({ clickCount: 3 });
                                            await page.waitForTimeout(200);
                                            const codeToEnter = verificationCode.code || verificationCode;
                                            await humanLikeType(page, input, String(codeToEnter), {
                                                minDelay: 80,
                                                maxDelay: 200,
                                                mistakeChance: 0.05,
                                                pauseChance: 0.08
                                            });
                                            logger.info('Verification code entered on retry', { selector, code: codeToEnter });
                                            codeEntered = true;
                                            break;
                                        }
                                    } catch (e) {
                                        continue;
                                    }
                                }
                            }
                            
                            if (codeEntered) {
                                await page.waitForTimeout(500);
                                
                                // Click Next button
                                await clickNextButton(page);
                                await page.waitForTimeout(2000);
                                
                                // Finish SMS order
                                await smsApi.finishSmsVerifyOrder(lastPhoneOrder.id);
                                logger.info('SMS order finished successfully after retry');
                                
                                success = true;
                                break; // Exit retry loop
                            }
                        } catch (retryError) {
                            logger.warn(`Retry entering code failed`, { error: retryError.message, attempt: retryEnter + 1 });
                        }
                        
                        await page.waitForTimeout(1000);
                    }
                    
                    if (success) break; // Exit main retry loop if successful
                }

                // Cancel the SMS order only after timeout (code never received)
                // إلغاء طلب SMS فقط بعد انتهاء المهلة (لم يتم استلام الكود)
                if (isTimeout && lastPhoneOrder && lastPhoneOrder.id) {
                    try {
                        logger.info(`Cancelling SMS order ${lastPhoneOrder.id} after timeout (no code received)...`);
                        await page.waitForTimeout(1000); // Small delay
                        await smsApi.cancelSmsVerifyOrder(lastPhoneOrder.id);
                        logger.info(`SMS order ${lastPhoneOrder.id} cancelled successfully`);
                    } catch (cancelError) {
                        logger.warn(`Failed to cancel SMS order ${lastPhoneOrder.id}`, { 
                            error: cancelError.message,
                            note: 'Order may have already been cancelled or expired'
                        });
                    }
                }

                // If this is not the last attempt, try again with a new number (only if code was not received)
                // إذا لم تكن هذه المحاولة الأخيرة، حاول مرة أخرى برقم جديد (فقط إذا لم يتم استلام الكود)
                if (attempt < maxRetries && isTimeout) {
                    logger.info(`Attempting to get new phone number (attempt ${attempt + 1}/${maxRetries})...`);

                    // Click button to go back to phone input page
                    const backButtonXPath = '/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[3]/div/div[2]/div/div/button';
                    let backButtonClicked = false;

                    try {
                        await page.waitForXPath(backButtonXPath, { timeout: 5000 });
                        const backButtons = await page.$x(backButtonXPath);
                        if (backButtons.length > 0) {
                            const button = backButtons[0];
                            const isVisible = await button.evaluate(el => el.offsetParent !== null);
                            const isDisabled = await button.evaluate(el => el.disabled);
                            if (isVisible && !isDisabled) {
                                await button.click();
                                logger.info('Back button clicked to return to phone input page');
                                backButtonClicked = true;
                                await page.waitForTimeout(2000);
                            }
                        }
                    } catch (e) {
                        logger.debug('Back button XPath not found, trying alternative methods', { error: e.message });
                    }

                    // Fallback: try to find back button by text or other methods
                    if (!backButtonClicked) {
                        try {
                            const backButton = await page.evaluateHandle(() => {
                                const buttons = Array.from(document.querySelectorAll('button'));
                                return buttons.find(btn => {
                                    const text = btn.textContent.toLowerCase().trim();
                                    return (text.includes('change') || text.includes('edit') || text.includes('back') || 
                                            text.includes('تغيير') || text.includes('رجوع')) && 
                                           btn.offsetParent !== null && !btn.disabled;
                                });
                            });

                            if (backButton && backButton.asElement()) {
                                await backButton.asElement().click();
                                logger.info('Back button clicked (text search)');
                                backButtonClicked = true;
                                await page.waitForTimeout(2000);
                            }
                        } catch (e) {
                            logger.debug('Could not find back button', { error: e.message });
                        }
                    }

                    // Wait for phone input page to appear
                    await page.waitForTimeout(2000);

                    // Buy new phone number using getCountrySelection() (respects .env settings)
                    // شراء رقم هاتف جديد باستخدام getCountrySelection() (يحترم إعدادات .env)
                    logger.info('Buying new phone number...');
                    try {
                        // Use getCountrySelection() which handles both 5SIM Legacy and SMS Verification
                        const { selectedCountry } = getCountrySelection();
                        const maxPrice = 50; // Maximum price in rubles
                        
                        logger.info('Selected country for new phone number', { 
                            country: selectedCountry.name, 
                            countryCode: selectedCountry.code,
                            maxPrice: `${maxPrice} rubles`
                        });
                        
                        const service = process.env.FIVESIM_SERVICE || 'go';
                        const operator = process.env.FIVESIM_OPERATOR || 'any';
                        lastPhoneOrder = await smsApi.buySmsVerifyNumber(service, selectedCountry.code, operator, { maxPrice });
                        
                        // Validate the phone order result
                        // التحقق من صحة نتيجة طلب الهاتف
                        if (!lastPhoneOrder || !lastPhoneOrder.phone) {
                            throw new Error('No phone number returned from SMS API (NO_NUMBERS or API error)');
                        }
                        
                        logger.info('New phone number purchased', { 
                            phone: lastPhoneOrder.phone, 
                            orderId: lastPhoneOrder.id,
                            country: selectedCountry.name,
                            countryCode: selectedCountry.code,
                            maxPrice: `${maxPrice} rubles`
                        });

                        // Format phone number with + prefix (ensure full number with country code)
                        let formattedPhone = lastPhoneOrder.phone;
                        if (formattedPhone && !formattedPhone.startsWith('+')) {
                            formattedPhone = `+${formattedPhone}`;
                        }
                        logger.info('Formatted new phone number for retry', { 
                            original: lastPhoneOrder.phone, 
                            formatted: formattedPhone,
                            country: selectedCountry.name
                        });

                        // Enter new phone number - clear field first completely
                        const phoneInputSelectors = [
                            'input[type="tel"]#phoneNumberId',
                            'input[name="phoneNumberId"]',
                            'input[type="tel"]',
                            'input[aria-label*="phone" i]',
                            'input[aria-label*="Phone" i]'
                        ];

                        let newPhoneEntered = false;
                        for (const selector of phoneInputSelectors) {
                            try {
                                const input = await waitForElement(page, selector, 3000);
                                if (input) {
                                    // Clear the field completely using multiple methods
                                    // مسح الحقل بالكامل باستخدام طرق متعددة
                                    
                                    // Method 1: Clear via JavaScript (most reliable)
                                    await page.evaluate((sel) => {
                                        const input = document.querySelector(sel);
                                        if (input) {
                                            input.value = '';
                                            input.dispatchEvent(new Event('input', { bubbles: true }));
                                            input.dispatchEvent(new Event('change', { bubbles: true }));
                                        }
                                    }, selector);
                                    await page.waitForTimeout(100);
                                    
                                    // Method 2: Focus and select all, then delete
                                    await input.focus();
                                    await page.waitForTimeout(100);
                                    await page.keyboard.down('Control');
                                    await page.keyboard.press('a');
                                    await page.keyboard.up('Control');
                                    await page.waitForTimeout(100);
                                    await page.keyboard.press('Delete');
                                    await page.waitForTimeout(100);
                                    await page.keyboard.press('Backspace'); // Extra clear with Backspace
                                    await page.waitForTimeout(100);
                                    
                                    // Method 3: Triple click and delete (fallback)
                                    await input.click({ clickCount: 3 });
                                    await page.waitForTimeout(100);
                                    await page.keyboard.press('Delete');
                                    await page.waitForTimeout(100);
                                    
                                    // Verify field is empty before typing
                                    const fieldValue = await input.evaluate(el => el.value);
                                    if (fieldValue && fieldValue.trim() !== '') {
                                        logger.warn('Field not empty after clearing, clearing again', { value: fieldValue });
                                        await page.evaluate((sel) => {
                                            const input = document.querySelector(sel);
                                            if (input) input.value = '';
                                        }, selector);
                                        await page.waitForTimeout(100);
                                    }
                                    
                                    // Type the full phone number with +
                                    await humanLikeType(page, input, formattedPhone, {
                                minDelay: 60,
                                maxDelay: 180,
                                mistakeChance: 0.12,
                                pauseChance: 0.15
                            });
                                    
                                    // Verify the number was entered correctly
                                    const enteredValue = await input.evaluate(el => el.value);
                                    logger.info('New phone number entered in retry', { 
                                        selector, 
                                        phone: formattedPhone,
                                        length: formattedPhone.length,
                                        entered: enteredValue
                                    });
                                    newPhoneEntered = true;
                                    break;
                                }
                            } catch (e) {
                                continue;
                            }
                        }

                        if (!newPhoneEntered) {
                            throw new Error('Could not find phone input field for new number');
                        }

                        await page.waitForTimeout(500);

                        // Click Next button again
                        const nextButtonXPath = '/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[3]/div/div/div/div/button';
                        let nextClicked = false;

                        try {
                            await page.waitForXPath(nextButtonXPath, { timeout: 5000 });
                            const nextButtons = await page.$x(nextButtonXPath);
                            if (nextButtons.length > 0) {
                                const button = nextButtons[0];
                                const isVisible = await button.evaluate(el => el.offsetParent !== null);
                                const isDisabled = await button.evaluate(el => el.disabled);
                                if (isVisible && !isDisabled) {
                                    await button.click();
                                    logger.info('Next button clicked for new phone number');
                                    nextClicked = true;
                                }
                            }
                        } catch (e) {
                            logger.debug('XPath Next button not found, trying other methods', { error: e.message });
                        }

                        if (!nextClicked) {
                            await clickNextButton(page);
                        }

                        await page.waitForTimeout(3000);
                        // Continue to next iteration of retry loop

                    } catch (buyError) {
                        logger.error('Failed to buy new phone number', { error: buyError.message });
                        throw new Error(`Failed to buy new phone number on attempt ${attempt + 1}: ${buyError.message}`);
                    }
                } else if (!isTimeout && !codeWasReceived) {
                    // Last attempt failed and code was never received
                    throw new Error(`Failed to receive verification code after ${maxRetries} attempts`);
                } else if (codeWasReceived && !success) {
                    // Code was received but couldn't be entered after all retries
                    // الكود وصل لكن لم يتم إدخاله بعد كل المحاولات
                    logger.error('Code was received but could not be entered after all retries');
                    throw new Error(`Verification code received but could not be entered: ${error.message}`);
                }
            }
        }

        if (!success || !verificationCode) {
            // Make sure to cancel any remaining orders
            if (lastPhoneOrder && lastPhoneOrder.id) {
                try {
                    logger.info(`Cancelling remaining SMS order ${lastPhoneOrder.id} after all attempts failed...`);
                    await smsApi.cancelSmsVerifyOrder(lastPhoneOrder.id);
                } catch (cancelError) {
                    logger.warn(`Failed to cancel remaining SMS order`, { error: cancelError.message });
                }
            }
            throw new Error(`Failed to complete phone verification after ${maxRetries} attempts`);
        }

        return {
            phone: lastPhoneOrder.phone,
            code: verificationCode,
            orderId: lastPhoneOrder.id
        };
    } catch (error) {
        // Make sure to cancel any remaining orders on final error
        if (phoneOrder && phoneOrder.id) {
            try {
                logger.info(`Cancelling SMS order ${phoneOrder.id} due to final error...`);
                await smsApi.cancelSmsVerifyOrder(phoneOrder.id);
            } catch (cancelError) {
                logger.warn(`Failed to cancel SMS order on final error`, { error: cancelError.message });
            }
        }
        logger.error('Failed to handle phone verification', { error: error.message });
        throw error;
    }
}

/**
 * Generate random recovery email with specific domain
 * إنشاء بريد إلكتروني عشوائي للاسترداد مع نطاق محدد
 */
function generateRecoveryEmail() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let email = '';
    for (let i = 0; i < 12; i++) {
        email += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${email}@storage-te.com`;
}

/**
 * Complete account creation
 * إكمال إنشاء الحساب
 */
async function completeAccountCreation(page, accountData) {
    try {
        logger.info('Completing account creation');

        // Wait for any final steps
        await page.waitForTimeout(2000);
        
        let currentUrl = page.url();
        logger.info('Current URL after phone verification', { url: currentUrl });

        // Step 1: Handle Recovery Email page
        // الخطوة 1: التعامل مع صفحة البريد الإلكتروني للاسترداد
        if (currentUrl.includes('addrecoveryemail')) {
            logger.info('Recovery email page detected');
            
            // Generate random recovery email
            const recoveryEmail = generateRecoveryEmail();
            logger.info('Generated recovery email', { email: recoveryEmail });
            
            // Find email input field
            const emailSelectors = [
                'input[type="email"]',
                'input[name="recoveryEmail"]',
                'input[aria-label*="email" i]',
                'input[aria-label*="بريد" i]'
            ];
            
            let emailEntered = false;
            for (const selector of emailSelectors) {
                try {
                    const input = await page.$(selector);
                    if (input) {
                        await input.click({ clickCount: 3 });
                        await page.waitForTimeout(200);
                        await input.type(recoveryEmail, { delay: 50 });
                        logger.info('Recovery email entered', { email: recoveryEmail });
                        emailEntered = true;
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }
            
            if (!emailEntered) {
                // Try to skip recovery email if input not found
                logger.warn('Could not find recovery email input, trying to skip...');
            }
            
            // Click Next button
            await page.waitForTimeout(500);
            const nextButtonXPath = '/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[3]/div/div[1]/div/div/button';
            try {
                await page.waitForXPath(nextButtonXPath, { timeout: 5000 });
                const nextButtons = await page.$x(nextButtonXPath);
                if (nextButtons.length > 0) {
                    await nextButtons[0].click();
                    logger.info('Next button clicked on recovery email page');
                    await page.waitForTimeout(2000);
                }
            } catch (e) {
                await clickNextButton(page);
                await page.waitForTimeout(2000);
            }
            
            currentUrl = page.url();
        }

        // Step 2: Handle Confirmation page
        // الخطوة 2: التعامل مع صفحة التأكيد
        if (currentUrl.includes('confirmation')) {
            logger.info('Confirmation page detected');
            
            // Click Next button
            const nextButtonXPath = '/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[3]/div/div[1]/div/div/button';
            try {
                await page.waitForXPath(nextButtonXPath, { timeout: 5000 });
                const nextButtons = await page.$x(nextButtonXPath);
                if (nextButtons.length > 0) {
                    await nextButtons[0].click();
                    logger.info('Next button clicked on confirmation page');
                    await page.waitForTimeout(2000);
                }
            } catch (e) {
                await clickNextButton(page);
                await page.waitForTimeout(2000);
            }
            
            currentUrl = page.url();
        }

        // Step 3: Handle Terms of Service page
        // الخطوة 3: التعامل مع صفحة شروط الخدمة
        if (currentUrl.includes('termsofservice')) {
            logger.info('Terms of service page detected');
            
            // Scroll down to bottom of page
            await page.evaluate(() => {
                window.scrollTo(0, document.body.scrollHeight);
            });
            await page.waitForTimeout(1000);
            
            // Scroll inside any scrollable container
            await page.evaluate(() => {
                const scrollables = document.querySelectorAll('[style*="overflow"]');
                scrollables.forEach(el => {
                    el.scrollTop = el.scrollHeight;
                });
            });
            await page.waitForTimeout(1000);
            
            // Click the "I agree" / "موافق" button
            // XPath from user: /html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[3]/div/div[1]/div/div/button
            const agreeButtonXPath = '/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[3]/div/div[1]/div/div/button';
            try {
                await page.waitForXPath(agreeButtonXPath, { timeout: 5000 });
                const agreeButtons = await page.$x(agreeButtonXPath);
                if (agreeButtons.length > 0) {
                    const isVisible = await agreeButtons[0].evaluate(el => el.offsetParent !== null);
                    const isDisabled = await agreeButtons[0].evaluate(el => el.disabled);
                    if (isVisible && !isDisabled) {
                        await agreeButtons[0].click();
                        logger.info('Agree button clicked on terms of service page');
                        await page.waitForTimeout(3000);
                    }
                }
            } catch (e) {
                logger.warn('Could not find agree button by XPath, trying fallback', { error: e.message });
                // Fallback to clicking any button with "agree" text
                const agreeButton = await page.evaluateHandle(() => {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    return buttons.find(btn => {
                        const text = btn.textContent.toLowerCase();
                        return (text.includes('agree') || text.includes('موافق') || text.includes('i agree') || text.includes('أوافق')) && !btn.disabled;
                    });
                });
                
                if (agreeButton && agreeButton.asElement()) {
                    await agreeButton.asElement().click();
                    logger.info('Agree button clicked (fallback)');
                    await page.waitForTimeout(3000);
                }
            }
            
            currentUrl = page.url();
        }

        // Step 4: Handle confirmidentifier page (after terms of service)
        // الخطوة 4: التعامل مع صفحة confirmidentifier (بعد شروط الخدمة)
        if (currentUrl.includes('confirmidentifier')) {
            logger.info('Confirm identifier page detected');
            
            // Click Next/Continue button
            // XPath from user: /html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[3]/div/div/div/div/button
            const confirmButtonXPath = '/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[3]/div/div/div/div/button';
            try {
                await page.waitForXPath(confirmButtonXPath, { timeout: 5000 });
                const confirmButtons = await page.$x(confirmButtonXPath);
                if (confirmButtons.length > 0) {
                    const isVisible = await confirmButtons[0].evaluate(el => el.offsetParent !== null);
                    const isDisabled = await confirmButtons[0].evaluate(el => el.disabled);
                    if (isVisible && !isDisabled) {
                        await confirmButtons[0].click();
                        logger.info('Confirm button clicked on confirmidentifier page');
                        await page.waitForTimeout(3000);
                    }
                }
            } catch (e) {
                logger.warn('Could not find confirm button by XPath, trying fallback', { error: e.message });
                await clickNextButton(page);
                await page.waitForTimeout(3000);
            }
            
            currentUrl = page.url();
        }

        // Click through any remaining steps (fallback)
        for (let i = 0; i < 3; i++) {
            const nextButton = await page.evaluateHandle(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                return buttons.find(btn => {
                    const text = btn.textContent.toLowerCase();
                    return (text.includes('next') || text.includes('التالي') || text.includes('agree') || text.includes('موافق') || text.includes('continue') || text.includes('متابعة')) && !btn.disabled;
                });
            });

            if (nextButton && nextButton.asElement()) {
                await nextButton.asElement().click();
                await page.waitForTimeout(2000);
            } else {
                break;
            }
        }

        // Verify account was created by checking URL or page content
        currentUrl = page.url();
        if (currentUrl.includes('myaccount.google.com') || currentUrl.includes('accounts.google.com')) {
            logger.info('Account creation appears successful', { url: currentUrl });
            return true;
        }

        logger.warn('Could not verify account creation completion');
        return true; // Assume success
    } catch (error) {
        logger.error('Failed to complete account creation', { error: error.message });
        throw error;
    }
}

/**
 * Click Next button
 * الضغط على زر التالي
 */
async function clickNextButton(page) {
    try {
        // Human behavior: Wait a bit before clicking (like human deciding to click)
        // سلوك بشري: الانتظار قليلاً قبل النقر (مثل قرار الإنسان بالنقر)
        await humanSleep(getHumanDelay('beforeClick'));

        // Try XPath first (most reliable for Google forms)
        const xpathSelectors = [
            '/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[3]/div/div/div/div/button',
            '//button[contains(text(), "Next")]',
            '//button[contains(text(), "التالي")]',
            '//button[@jsname="OCpkoe"]',
            '//button[contains(@class, "VfPpkd-LgbsSe")]',
            '//button[contains(@aria-label, "Next")]'
        ];

        for (const xpath of xpathSelectors) {
            try {
                await page.waitForXPath(xpath, { timeout: 3000 });
                const buttons = await page.$x(xpath);
                if (buttons.length > 0) {
                    // Check if button is enabled
                    const isEnabled = await page.evaluate((btn) => {
                        return !btn.disabled && btn.offsetParent !== null;
                    }, buttons[0]);
                    
                    if (isEnabled) {
                        // Human behavior: Scroll to button and click with mouse movement
                        // سلوك بشري: التمرير إلى الزر والنقر مع حركة الماوس
                        await humanScrollToElement(page, buttons[0]);
                        await humanClick(page, buttons[0], { preClickDelay: true, postClickDelay: true });
                        logger.info('Next button clicked (XPath)', { xpath });
                        return true;
                    }
                }
            } catch (e) {
                continue;
            }
        }

        // Try CSS selectors
        const cssSelectors = [
            'button:has-text("Next")',
            'button:has-text("التالي")',
            '#next',
            'button[type="button"]:has-text("Next")',
            'button.VfPpkd-LgbsSe',
            'button[jsname="OCpkoe"]'
        ];

        for (const selector of cssSelectors) {
            try {
                const button = await waitForElement(page, selector, 2000);
                if (button) {
                    const isEnabled = await page.evaluate((btn) => {
                        return !btn.disabled && btn.offsetParent !== null;
                    }, button);
                    
                    if (isEnabled) {
                        // Human behavior: Click with mouse movement
                        // سلوك بشري: النقر مع حركة الماوس
                        await humanClick(page, button, { preClickDelay: true, postClickDelay: true });
                        logger.info('Next button clicked (CSS)', { selector });
                        return true;
                    }
                }
            } catch (e) {
                continue;
            }
        }

        // Try finding by text content and button attributes
        try {
            const button = await page.evaluateHandle(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                return buttons.find(btn => {
                    const text = btn.textContent.toLowerCase().trim();
                    const isNext = (text === 'next' || text === 'التالي' || text.includes('next'));
                    const isVisible = btn.offsetParent !== null;
                    const isEnabled = !btn.disabled;
                    return isNext && isVisible && isEnabled;
                });
            });

            if (button && button.asElement()) {
                // Human behavior: Click with mouse movement
                await humanClick(page, button.asElement(), { preClickDelay: true, postClickDelay: true });
                logger.info('Next button clicked (text search)');
                return true;
            }
        } catch (e) {
            logger.debug('Could not find Next button by text', { error: e.message });
        }

        // Try finding any enabled button that might be Next
        try {
            const button = await page.evaluateHandle(() => {
                // Look for button in the main form area
                const mainArea = document.querySelector('main') || document.body;
                const buttons = Array.from(mainArea.querySelectorAll('button'));
                return buttons.find(btn => {
                    const text = btn.textContent.toLowerCase().trim();
                    const isNext = text === 'next' || text === 'التالي';
                    const isVisible = btn.offsetParent !== null;
                    const isEnabled = !btn.disabled;
                    const hasNextClass = btn.className.includes('VfPpkd-LgbsSe');
                    return (isNext || hasNextClass) && isVisible && isEnabled;
                });
            });

            if (button && button.asElement()) {
                await button.asElement().click();
                logger.info('Next button clicked (fallback search)');
                await page.waitForTimeout(500);
                return true;
            }
        } catch (e) {
            logger.debug('Could not find Next button by fallback', { error: e.message });
        }

        logger.warn('Could not find Next button');
        return false;
    } catch (error) {
        logger.error('Error clicking Next button', { error: error.message });
        return false;
    }
}

export default {
    createGmailAccount
};

