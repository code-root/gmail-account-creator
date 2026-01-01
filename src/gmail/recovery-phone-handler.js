/**
 * Recovery Phone Handler
 * معالج إضافة رقم هاتف الاسترداد
 * 
 * Adds recovery phone number to account after successful creation
 * إضافة رقم هاتف الاسترداد للحساب بعد الإنشاء الناجح
 */

import logger from '../utils/logger.js';
import * as smsApi from '../sms-provider.js';
import { waitForElement } from './page-detector.js';
import { humanSleep, getHumanDelay, humanClick, humanType } from '../utils/human-behavior.js';

/**
 * Detect current page type in recovery phone flow
 * اكتشاف نوع الصفحة الحالية في تدفق إضافة رقم الاسترداد
 */
async function detectRecoveryPage(page) {
    try {
        const url = page.url();
        const pageInfo = await page.evaluate(() => {
            return {
                url: window.location.href,
                hasPasswordInput: !!(
                    document.querySelector('input[type="password"]') ||
                    document.querySelector('input[name="password"]') ||
                    document.querySelector('input[aria-label*="password" i]')
                ),
                hasCodeInput: !!(
                    document.querySelector('input[type="tel"][name="code"]') ||
                    document.querySelector('input#code') ||
                    document.querySelector('input[aria-label*="code" i]') ||
                    document.querySelector('input[name="pin"]') ||
                    document.querySelector('input#idvPin')
                ),
                hasPhoneInput: !!(
                    document.querySelector('input#phoneNumberId') ||
                    document.querySelector('input[type="tel"][name="phoneNumberId"]') ||
                    document.querySelector('input[type="tel"][aria-label*="phone" i]')
                ),
                hasGetVerificationCodeButton: !!(
                    Array.from(document.querySelectorAll('button')).some(btn => {
                        const text = btn.textContent.toLowerCase();
                        return text.includes('get') || text.includes('verification') || text.includes('send');
                    })
                ),
                hasAddRecoveryPhoneLink: !!(
                    document.querySelector('a[aria-label*="Add recovery phone" i]') ||
                    document.querySelector('a[href*="recoveryoptions" i]') ||
                    document.querySelector('a[href*="collectphone" i]')
                ),
                hasConsentButton: !!(
                    Array.from(document.querySelectorAll('button')).some(btn => {
                        const text = btn.textContent.toLowerCase();
                        return text.includes('allow') || text.includes('موافق') || text.includes('continue') || text.includes('متابعة');
                    })
                )
            };
        });

        // Determine page type based on URL and elements
        if (url.includes('myaccount.google.com') && !url.includes('signinoptions')) {
            return { type: 'MY_ACCOUNT', url };
        }
        
        if (url.includes('confirmidentifier')) {
            return { type: 'CONFIRM_IDENTIFIER', url, ...pageInfo };
        }
        
        if (url.includes('/challenge/pwd') || url.includes('password') || pageInfo.hasPasswordInput) {
            return { type: 'PASSWORD', url, ...pageInfo };
        }
        
        if (url.includes('/challenge/ipp/consent')) {
            return { type: 'CONSENT', url, ...pageInfo };
        }
        
        // Check for reCAPTCHA page
        if (url.includes('/challenge/recaptcha') || url.includes('recaptcha')) {
            return { type: 'RECAPTCHA', url, ...pageInfo };
        }
        
        // Check for phone input page (before code verification)
        if (url.includes('/challenge/iap') && pageInfo.hasPhoneInput && !pageInfo.hasCodeInput) {
            return { type: 'PHONE_INPUT', url, ...pageInfo };
        }
        
        // Check for "Get verification code" page
        if (url.includes('/challenge/iap') && pageInfo.hasGetVerificationCodeButton && !pageInfo.hasCodeInput) {
            return { type: 'GET_VERIFICATION_CODE', url, ...pageInfo };
        }
        
        if (url.includes('/challenge/ipp/verify') || url.includes('/challenge/iap/verify') || pageInfo.hasCodeInput) {
            return { type: 'VERIFY_CODE', url, ...pageInfo };
        }
        
        if (url.includes('recoveryoptions') || url.includes('collectphone')) {
            return { type: 'RECOVERY_OPTIONS', url, ...pageInfo };
        }

        return { type: 'UNKNOWN', url, ...pageInfo };
    } catch (error) {
        logger.error('Error detecting recovery page', { error: error.message });
        return { type: 'UNKNOWN', url: page.url() };
    }
}

/**
 * Click on "Add recovery phone" link
 * النقر على رابط "إضافة رقم هاتف الاسترداد"
 */
async function clickAddRecoveryPhone(page) {
    try {
        logger.info('Looking for "Add recovery phone" link...');
        
        // Wait for page to load
        await page.waitForTimeout(2000);
        
        // Try XPath first (user-specified)
        const addRecoveryPhoneXPath = '/html/body/c-wiz/div[1]/div[2]/div/c-wiz/c-wiz/div/div[2]/div[2]/div[3]/div[1]/div[2]/div[3]/div[2]/div/a';
        try {
            await page.waitForXPath(addRecoveryPhoneXPath, { timeout: 5000 });
            const links = await page.$x(addRecoveryPhoneXPath);
            if (links.length > 0) {
                await humanClick(page, links[0], { preClickDelay: true, postClickDelay: true });
                logger.info('Clicked "Add recovery phone" link (XPath)');
                await page.waitForTimeout(2000);
                return true;
            }
        } catch (e) {
            logger.debug('XPath method failed, trying CSS selectors', { error: e.message });
        }
        
        // Try CSS selectors
        const selectors = [
            'a[aria-label*="Add recovery phone" i]',
            'a[href*="recoveryoptions"]',
            'a[href*="collectphone"]',
            'a[data-rid]'
        ];
        
        for (const selector of selectors) {
            try {
                const link = await waitForElement(page, selector, 3000);
                if (link) {
                    const linkText = await page.evaluate(el => el.textContent || el.getAttribute('aria-label') || '', link);
                    if (linkText.toLowerCase().includes('recovery') || linkText.toLowerCase().includes('phone') || 
                        linkText.toLowerCase().includes('استرداد') || linkText.toLowerCase().includes('هاتف')) {
                        await humanClick(page, link, { preClickDelay: true, postClickDelay: true });
                        logger.info('Clicked "Add recovery phone" link (CSS)', { selector, text: linkText });
                        await page.waitForTimeout(2000);
                        return true;
                    }
                }
            } catch (e) {
                continue;
            }
        }
        
        logger.warn('Could not find "Add recovery phone" link');
        return false;
    } catch (error) {
        logger.error('Error clicking "Add recovery phone" link', { error: error.message });
        return false;
    }
}

/**
 * Handle confirm identifier page
 * التعامل مع صفحة تأكيد الهوية
 */
async function handleConfirmIdentifier(page) {
    try {
        logger.info('Handling confirm identifier page...');
        
        const confirmButtonXPath = '/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[3]/div/div/div/div/button';
        try {
            await page.waitForXPath(confirmButtonXPath, { timeout: 5000 });
            const buttons = await page.$x(confirmButtonXPath);
            if (buttons.length > 0) {
                const isVisible = await buttons[0].evaluate(el => el.offsetParent !== null);
                const isDisabled = await buttons[0].evaluate(el => el.disabled);
                if (isVisible && !isDisabled) {
                    await humanClick(page, buttons[0], { preClickDelay: true, postClickDelay: true });
                    logger.info('Confirm button clicked');
                    await page.waitForTimeout(3000);
                    
                    // Wait for navigation
                    const urlBefore = page.url();
                    for (let i = 0; i < 10; i++) {
                        await page.waitForTimeout(1000);
                        const urlAfter = page.url();
                        if (urlAfter !== urlBefore) {
                            logger.info('Page navigated after confirm identifier', { from: urlBefore, to: urlAfter });
                            break;
                        }
                    }
                    return true;
                }
            }
        } catch (e) {
            logger.debug('XPath method failed, trying fallback', { error: e.message });
        }
        
        // Fallback: try to find any enabled button
        const button = await page.evaluateHandle(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            return buttons.find(btn => {
                const text = btn.textContent.toLowerCase();
                return (text.includes('next') || text.includes('التالي') || text.includes('continue') || text.includes('متابعة')) && !btn.disabled && btn.offsetParent !== null;
            });
        });
        
        if (button && button.asElement()) {
            await humanClick(page, button.asElement(), { preClickDelay: true, postClickDelay: true });
            logger.info('Confirm button clicked (fallback)');
            await page.waitForTimeout(3000);
            return true;
        }
        
        return false;
    } catch (error) {
        logger.error('Error handling confirm identifier page', { error: error.message });
        return false;
    }
}

/**
 * Handle password page
 * التعامل مع صفحة كلمة المرور
 */
async function handlePasswordPage(page, password) {
    try {
        logger.info('Handling password page...');
        
        const passwordInputXPath = '/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[2]/div/div/div/form/span/section[2]/div/div/div[1]/div[1]/div/div/div/div/div[1]/div/div[1]/input';
        
        let passwordEntered = false;
        
        // Try XPath first
        try {
            await page.waitForXPath(passwordInputXPath, { timeout: 5000 });
            const inputs = await page.$x(passwordInputXPath);
            if (inputs.length > 0) {
                const input = inputs[0];
                await input.click({ clickCount: 3 });
                await page.waitForTimeout(200);
                await humanType(page, input, password, {
                    minDelay: 80,
                    maxDelay: 200,
                    mistakeChance: 0.05,
                    pauseChance: 0.08
                });
                logger.info('Password entered (XPath)');
                passwordEntered = true;
            }
        } catch (e) {
            logger.debug('XPath method failed, trying CSS selectors', { error: e.message });
        }
        
        // Fallback to CSS selectors
        if (!passwordEntered) {
            const selectors = [
                'input[type="password"]',
                'input[name="password"]',
                'input[aria-label*="password" i]'
            ];
            
            for (const selector of selectors) {
                try {
                    const input = await waitForElement(page, selector, 3000);
                    if (input) {
                        await input.click({ clickCount: 3 });
                        await page.waitForTimeout(200);
                        await humanType(page, input, password, {
                            minDelay: 80,
                            maxDelay: 200,
                            mistakeChance: 0.05,
                            pauseChance: 0.08
                        });
                        logger.info('Password entered (CSS)', { selector });
                        passwordEntered = true;
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }
        }
        
        if (!passwordEntered) {
            logger.warn('Could not find password input field');
            return false;
        }
        
        await page.waitForTimeout(500);
        
        // Click Next button
        const nextButtonXPath = '/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[3]/div/div/div/div/button';
        try {
            await page.waitForXPath(nextButtonXPath, { timeout: 5000 });
            const buttons = await page.$x(nextButtonXPath);
            if (buttons.length > 0) {
                const isVisible = await buttons[0].evaluate(el => el.offsetParent !== null);
                const isDisabled = await buttons[0].evaluate(el => el.disabled);
                if (isVisible && !isDisabled) {
                    await humanClick(page, buttons[0], { preClickDelay: true, postClickDelay: true });
                    logger.info('Next button clicked after password');
                    await page.waitForTimeout(3000);
                    
                    // Wait for navigation
                    const urlBefore = page.url();
                    for (let i = 0; i < 10; i++) {
                        await page.waitForTimeout(1000);
                        const urlAfter = page.url();
                        if (urlAfter !== urlBefore) {
                            logger.info('Page navigated after password', { from: urlBefore, to: urlAfter });
                            break;
                        }
                    }
                    return true;
                }
            }
        } catch (e) {
            logger.debug('Next button XPath failed, trying fallback', { error: e.message });
        }
        
        return false;
    } catch (error) {
        logger.error('Error handling password page', { error: error.message });
        return false;
    }
}

/**
 * Wait for reCAPTCHA to be solved and check for password page
 * انتظار حل reCAPTCHA والتحقق من صفحة كلمة المرور
 */
async function waitForRecaptchaAndPasswordPage(page, password, targetPasswordUrl) {
    try {
        logger.info('Waiting for reCAPTCHA to be solved...');
        
        const maxWaitTime = 300000; // 5 minutes max wait
        const checkInterval = 1000; // Check every 1 second
        const startTime = Date.now();
        let lastUrl = page.url();
        
        while (Date.now() - startTime < maxWaitTime) {
            await page.waitForTimeout(checkInterval);
            
            const currentUrl = page.url();
            
            // Check if URL changed to password page
            // التحقق من تغيير الرابط إلى صفحة كلمة المرور
            const isPasswordPage = currentUrl.includes('/challenge/pwd') || 
                                   (targetPasswordUrl && (
                                       currentUrl === targetPasswordUrl ||
                                       currentUrl.includes(targetPasswordUrl.split('?')[0]) ||
                                       (targetPasswordUrl.includes('/challenge/pwd') && currentUrl.includes('/challenge/pwd'))
                                   ));
            
            if (isPasswordPage) {
                logger.info('Password page detected after reCAPTCHA', { 
                    url: currentUrl,
                    targetUrl: targetPasswordUrl
                });
                
                // Wait a bit for page to fully load
                await page.waitForTimeout(2000);
                
                // Handle password page
                const passwordHandled = await handlePasswordPage(page, password);
                if (passwordHandled) {
                    logger.info('Password entered successfully after reCAPTCHA');
                    return true;
                } else {
                    logger.warn('Failed to handle password page after reCAPTCHA');
                    return false;
                }
            }
            
            // Check if reCAPTCHA is still present
            const hasRecaptcha = await page.evaluate(() => {
                return !!(
                    document.querySelector('iframe[src*="recaptcha"]') ||
                    document.querySelector('div[class*="recaptcha"]') ||
                    document.querySelector('div[id*="recaptcha"]') ||
                    window.location.href.includes('recaptcha')
                );
            });
            
            // If reCAPTCHA is gone and URL changed, check what page we're on
            if (!hasRecaptcha && currentUrl !== lastUrl) {
                logger.info('reCAPTCHA solved and URL changed', { 
                    from: lastUrl, 
                    to: currentUrl 
                });
                lastUrl = currentUrl;
                
                // Check if we're on password page
                if (currentUrl.includes('/challenge/pwd')) {
                    logger.info('Password page detected after reCAPTCHA solved');
                    await page.waitForTimeout(2000);
                    const passwordHandled = await handlePasswordPage(page, password);
                    if (passwordHandled) {
                        return true;
                    }
                }
            }
            
            // Log progress every 10 seconds
            const elapsed = Math.floor((Date.now() - startTime) / 500);
            if (elapsed % 10 === 0 && elapsed > 0) {
                logger.debug('Still waiting for reCAPTCHA to be solved...', { 
                    elapsedSeconds: elapsed,
                    currentUrl: currentUrl
                });
            }
        }
        
        logger.warn('Timeout waiting for reCAPTCHA to be solved');
        return false;
    } catch (error) {
        logger.error('Error waiting for reCAPTCHA', { error: error.message });
        return false;
    }
}

/**
 * Handle consent page
 * التعامل مع صفحة الموافقة
 */
async function handleConsentPage(page) {
    try {
        logger.info('Handling consent page...');
        
        const consentButtonXPath = '/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[3]/div/div[1]/div/div/button';
        try {
            await page.waitForXPath(consentButtonXPath, { timeout: 5000 });
            const buttons = await page.$x(consentButtonXPath);
            if (buttons.length > 0) {
                const isVisible = await buttons[0].evaluate(el => el.offsetParent !== null);
                const isDisabled = await buttons[0].evaluate(el => el.disabled);
                if (isVisible && !isDisabled) {
                    await humanClick(page, buttons[0], { preClickDelay: true, postClickDelay: true });
                    logger.info('Consent button clicked');
                    await page.waitForTimeout(3000);
                    
                    // Wait for navigation
                    const urlBefore = page.url();
                    for (let i = 0; i < 10; i++) {
                        await page.waitForTimeout(1000);
                        const urlAfter = page.url();
                        if (urlAfter !== urlBefore) {
                            logger.info('Page navigated after consent', { from: urlBefore, to: urlAfter });
                            break;
                        }
                    }
                    return true;
                }
            }
        } catch (e) {
            logger.debug('XPath method failed, trying fallback', { error: e.message });
        }
        
        // Fallback
        const button = await page.evaluateHandle(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            return buttons.find(btn => {
                const text = btn.textContent.toLowerCase();
                return (text.includes('allow') || text.includes('موافق') || text.includes('continue') || text.includes('متابعة')) && !btn.disabled && btn.offsetParent !== null;
            });
        });
        
        if (button && button.asElement()) {
            await humanClick(page, button.asElement(), { preClickDelay: true, postClickDelay: true });
            logger.info('Consent button clicked (fallback)');
            await page.waitForTimeout(3000);
            return true;
        }
        
        return false;
    } catch (error) {
        logger.error('Error handling consent page', { error: error.message });
        return false;
    }
}

/**
 * Handle Next or Skip button click
 * التعامل مع الضغط على زر Next أو Skip
 */
async function handleSkipButton(page) {
    try {
        logger.info('Looking for Next or Skip button...');
        
        // Human behavior: Wait a bit before clicking
        // سلوك بشري: الانتظار قليلاً قبل النقر
        await humanSleep(getHumanDelay('thinking'));
        
        let buttonClicked = false;
        
        // Method 1: Look for "Next" button by text (priority)
        // الطريقة 1: البحث عن زر "Next" بالنص (الأولوية)
        try {
            const nextButton = await page.evaluateHandle(() => {
                const buttons = Array.from(document.querySelectorAll('button, a'));
                return buttons.find(btn => {
                    const text = (btn.textContent || '').toLowerCase().trim();
                    return (text.includes('next') || 
                            text.includes('التالي') || 
                            text.includes('continue') ||
                            text.includes('متابعة')) && 
                           btn.offsetParent !== null && 
                           !btn.disabled;
                });
            });
            
            if (nextButton && nextButton.asElement()) {
                await humanClick(page, nextButton.asElement(), { preClickDelay: true, postClickDelay: true });
                logger.info('Next button clicked');
                buttonClicked = true;
                await humanSleep(getHumanDelay('pageLoad'));
            }
        } catch (e) {
            logger.debug('Could not find Next button by text', { error: e.message });
        }
        
        // Method 2: Look for "Next" button by jsname attribute (from HTML provided)
        // الطريقة 2: البحث عن زر "Next" بـ jsname (من HTML المقدم)
        if (!buttonClicked) {
            try {
                const nextSelectors = [
                    'button[jsname="LgbsSe"]',
                    'button[data-primary-action-label="Next"]',
                    'button.VfPpkd-LgbsSe',
                    'button[type="button"][jsname="LgbsSe"]'
                ];
                
                for (const selector of nextSelectors) {
                    try {
                        const nextElement = await waitForElement(page, selector, 2000);
                        if (nextElement) {
                            const isVisible = await nextElement.evaluate(el => el.offsetParent !== null);
                            const isDisabled = await nextElement.evaluate(el => el.disabled);
                            if (isVisible && !isDisabled) {
                                await humanClick(page, nextElement, { preClickDelay: true, postClickDelay: true });
                                logger.info('Next button clicked (CSS selector)', { selector });
                                buttonClicked = true;
                                await humanSleep(getHumanDelay('pageLoad'));
                                break;
                            }
                        }
                    } catch (e) {
                        continue;
                    }
                }
            } catch (e) {
                logger.debug('Could not find Next button by CSS selectors', { error: e.message });
            }
        }
        
        // Method 3: Look for "Skip" button by text (fallback)
        // الطريقة 3: البحث عن زر "Skip" بالنص (احتياطي)
        if (!buttonClicked) {
            try {
                const skipButton = await page.evaluateHandle(() => {
                    const buttons = Array.from(document.querySelectorAll('button, a'));
                    return buttons.find(btn => {
                        const text = (btn.textContent || '').toLowerCase().trim();
                        return (text.includes('skip') || 
                                text.includes('تخطي') || 
                                text.includes('later') || 
                                text.includes('لاحقاً') ||
                                text.includes('not now') ||
                                text.includes('ليس الآن')) && 
                               btn.offsetParent !== null && 
                               !btn.disabled;
                    });
                });
                
                if (skipButton && skipButton.asElement()) {
                    await humanClick(page, skipButton.asElement(), { preClickDelay: true, postClickDelay: true });
                    logger.info('Skip button clicked');
                    buttonClicked = true;
                    await humanSleep(getHumanDelay('pageLoad'));
                }
            } catch (e) {
                logger.debug('Could not find Skip button by text', { error: e.message });
            }
        }
        
        // Method 4: Look for "Skip" link by aria-label or href (fallback)
        // الطريقة 4: البحث عن رابط "Skip" بـ aria-label أو href (احتياطي)
        if (!buttonClicked) {
            try {
                const skipSelectors = [
                    'a[aria-label*="skip" i]',
                    'a[aria-label*="تخطي" i]',
                    'a[href*="skip"]',
                    'button[aria-label*="skip" i]',
                    'button[aria-label*="تخطي" i]'
                ];
                
                for (const selector of skipSelectors) {
                    try {
                        const skipElement = await waitForElement(page, selector, 2000);
                        if (skipElement) {
                            await humanClick(page, skipElement, { preClickDelay: true, postClickDelay: true });
                            logger.info('Skip button clicked (CSS selector)', { selector });
                            buttonClicked = true;
                            await humanSleep(getHumanDelay('pageLoad'));
                            break;
                        }
                    } catch (e) {
                        continue;
                    }
                }
            } catch (e) {
                logger.debug('Could not find Skip button by CSS selectors', { error: e.message });
            }
        }
        
        if (buttonClicked) {
            // Wait for navigation
            const urlBefore = page.url();
            for (let i = 0; i < 10; i++) {
                await page.waitForTimeout(1000);
                const urlAfter = page.url();
                if (urlAfter !== urlBefore) {
                    logger.info('Page navigated after button click', { from: urlBefore, to: urlAfter });
                    break;
                }
            }
            return true;
        }
        
        logger.warn('Could not find Next or Skip button');
        return false;
    } catch (error) {
        logger.error('Error handling Next/Skip button', { error: error.message });
        return false;
    }
}

/**
 * Get OTP code for recovery phone (using same phone number and same order)
 * الحصول على كود OTP لرقم الاسترداد (باستخدام نفس الرقم ونفس الطلب)
 */
async function getNewRecoveryOTP(phoneNumber, countryCode, smsProvider, orderId, timeout = 120000) {
    try {
        logger.info('Getting OTP code for recovery phone using existing order', { 
            phone: phoneNumber, 
            orderId: orderId 
        });
        
        // Validate that we have orderId and phoneNumber
        if (!orderId) {
            throw new Error('Order ID is required to get recovery phone OTP code');
        }
        
        if (!phoneNumber) {
            throw new Error('Phone number is required to get recovery phone OTP code');
        }
        
        // Wait for verification code from the same order
        // انتظار كود التحقق من نفس الطلب
        logger.info('Waiting for SMS code from existing order', { orderId, phone: phoneNumber });
        const verificationCode = await smsApi.waitForSmsVerifyCode(orderId, timeout, 3000);
        
        if (!verificationCode) {
            throw new Error('Failed to receive verification code for recovery phone');
        }
        
        // Finish the order after getting the code
        await smsApi.finishSmsVerifyOrder(orderId);
        
        logger.info('OTP code received for recovery phone', { 
            code: verificationCode.code || verificationCode,
            orderId,
            phone: phoneNumber
        });
        
        return {
            code: verificationCode.code || verificationCode,
            orderId: orderId,
            phone: phoneNumber
        };
    } catch (error) {
        logger.error('Error getting recovery OTP', { error: error.message });
        throw error;
    }
}

/**
 * Handle phone input page (when phone number needs to be entered)
 * التعامل مع صفحة إدخال الرقم (عند الحاجة لإدخال رقم الهاتف)
 */
async function handlePhoneInputPage(page, phoneNumber) {
    try {
        logger.info('Handling phone input page for recovery phone...');
        
        const phoneInputXPath = '/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[2]/div/div/div/form/span/section[3]/div/div/div/div/div[2]/div[1]/label/input';
        
        let phoneEntered = false;
        
        // Try XPath first
        try {
            await page.waitForXPath(phoneInputXPath, { timeout: 5000 });
            const inputs = await page.$x(phoneInputXPath);
            if (inputs.length > 0) {
                const input = inputs[0];
                await input.click({ clickCount: 3 });
                await page.waitForTimeout(200);
                await humanType(page, input, phoneNumber, {
                    minDelay: 80,
                    maxDelay: 200,
                    mistakeChance: 0.05,
                    pauseChance: 0.08
                });
                logger.info('Phone number entered for recovery (XPath)', { phone: phoneNumber });
                phoneEntered = true;
            }
        } catch (e) {
            logger.debug('XPath method failed, trying CSS selectors', { error: e.message });
        }
        
        // Fallback to CSS selectors
        if (!phoneEntered) {
            const selectors = [
                'input#phoneNumberId',
                'input[type="tel"][name="phoneNumberId"]',
                'input[type="tel"][aria-label*="phone" i]'
            ];
            
            for (const selector of selectors) {
                try {
                    const input = await waitForElement(page, selector, 3000);
                    if (input) {
                        await input.click({ clickCount: 3 });
                        await page.waitForTimeout(200);
                        await humanType(page, input, phoneNumber, {
                            minDelay: 80,
                            maxDelay: 200,
                            mistakeChance: 0.05,
                            pauseChance: 0.08
                        });
                        logger.info('Phone number entered for recovery (CSS)', { selector, phone: phoneNumber });
                        phoneEntered = true;
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }
        }
        
        if (!phoneEntered) {
            logger.warn('Could not find phone input field');
            return false;
        }
        
        await page.waitForTimeout(500);
        
        // Click Next button
        const nextButtonXPath = '/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[3]/div/div/div/div/button';
        try {
            await page.waitForXPath(nextButtonXPath, { timeout: 5000 });
            const buttons = await page.$x(nextButtonXPath);
            if (buttons.length > 0) {
                const isVisible = await buttons[0].evaluate(el => el.offsetParent !== null);
                const isDisabled = await buttons[0].evaluate(el => el.disabled);
                if (isVisible && !isDisabled) {
                    await humanClick(page, buttons[0], { preClickDelay: true, postClickDelay: true });
                    logger.info('Next button clicked after entering phone number');
                    await page.waitForTimeout(3000);
                    
                    // Wait for navigation
                    const urlBefore = page.url();
                    for (let i = 0; i < 10; i++) {
                        await page.waitForTimeout(1000);
                        const urlAfter = page.url();
                        if (urlAfter !== urlBefore) {
                            logger.info('Page navigated after phone input', { from: urlBefore, to: urlAfter });
                            break;
                        }
                    }
                    return true;
                }
            }
        } catch (e) {
            logger.debug('Next button XPath failed, trying fallback', { error: e.message });
        }
        
        return false;
    } catch (error) {
        logger.error('Error handling phone input page', { error: error.message });
        return false;
    }
}

/**
 * Handle "Get verification code" page
 * التعامل مع صفحة "الحصول على كود التحقق"
 */
async function handleGetVerificationCodePage(page) {
    try {
        logger.info('Handling "Get verification code" page...');
        
        const getCodeButtonXPath = '/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[3]/div/div[1]/div/div/button';
        try {
            await page.waitForXPath(getCodeButtonXPath, { timeout: 5000 });
            const buttons = await page.$x(getCodeButtonXPath);
            if (buttons.length > 0) {
                const isVisible = await buttons[0].evaluate(el => el.offsetParent !== null);
                const isDisabled = await buttons[0].evaluate(el => el.disabled);
                if (isVisible && !isDisabled) {
                    await humanClick(page, buttons[0], { preClickDelay: true, postClickDelay: true });
                    logger.info('Get verification code button clicked');
                    await page.waitForTimeout(3000);
                    
                    // Wait for navigation to code input page
                    const urlBefore = page.url();
                    for (let i = 0; i < 10; i++) {
                        await page.waitForTimeout(1000);
                        const urlAfter = page.url();
                        if (urlAfter !== urlBefore || urlAfter.includes('/verify')) {
                            logger.info('Page navigated after clicking get code', { from: urlBefore, to: urlAfter });
                            break;
                        }
                    }
                    return true;
                }
            }
        } catch (e) {
            logger.debug('XPath method failed, trying fallback', { error: e.message });
        }
        
        // Fallback
        const button = await page.evaluateHandle(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            return buttons.find(btn => {
                const text = btn.textContent.toLowerCase();
                return (text.includes('get') || text.includes('verification') || text.includes('send') || text.includes('التالي')) && !btn.disabled && btn.offsetParent !== null;
            });
        });
        
        if (button && button.asElement()) {
            await humanClick(page, button.asElement(), { preClickDelay: true, postClickDelay: true });
            logger.info('Get verification code button clicked (fallback)');
            await page.waitForTimeout(3000);
            return true;
        }
        
        return false;
    } catch (error) {
        logger.error('Error handling get verification code page', { error: error.message });
        return false;
    }
}

/**
 * Handle verification code page for recovery phone
 * التعامل مع صفحة كود التحقق لرقم الاسترداد
 */
async function handleVerificationCodePage(page, verificationCode) {
    try {
        logger.info('Handling verification code page for recovery phone...');
        
        const codeInputXPath = '/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[2]/div/div/div/form/span/section[2]/div/div/div[2]/div[1]/div[1]/div/div[1]/input';
        
        let codeEntered = false;
        const codeToEnter = String(verificationCode.code || verificationCode);
        
        // Try XPath first
        try {
            await page.waitForXPath(codeInputXPath, { timeout: 5000 });
            const inputs = await page.$x(codeInputXPath);
            if (inputs.length > 0) {
                const input = inputs[0];
                await input.click({ clickCount: 3 });
                await page.waitForTimeout(200);
                await humanType(page, input, codeToEnter, {
                    minDelay: 80,
                    maxDelay: 200,
                    mistakeChance: 0.05,
                    pauseChance: 0.08
                });
                logger.info('Verification code entered for recovery phone (XPath)', { code: codeToEnter });
                codeEntered = true;
            }
        } catch (e) {
            logger.debug('XPath method failed, trying CSS selectors', { error: e.message });
        }
        
        // Fallback to CSS selectors
        if (!codeEntered) {
            const selectors = [
                'input#idvAnyPhonePin',
                'input[name="pin"]',
                'input[type="tel"][name="code"]',
                'input[type="tel"][name="pin"]',
                'input#code',
                'input[name="code"]',
                'input[aria-label*="Enter code" i]',
                'input[aria-label*="code" i]'
            ];
            
            for (const selector of selectors) {
                try {
                    const input = await waitForElement(page, selector, 3000);
                    if (input) {
                        await input.click({ clickCount: 3 });
                        await page.waitForTimeout(200);
                        await humanType(page, input, codeToEnter, {
                            minDelay: 80,
                            maxDelay: 200,
                            mistakeChance: 0.05,
                            pauseChance: 0.08
                        });
                        logger.info('Verification code entered for recovery phone (CSS)', { selector, code: codeToEnter });
                        codeEntered = true;
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }
        }
        
        if (!codeEntered) {
            logger.warn('Could not find verification code input field');
            return false;
        }
        
        await page.waitForTimeout(500);
        
        // Click Next/Verify button
        const verifyButtonXPath = '/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[3]/div[2]/div[1]/div/div/button';
        try {
            await page.waitForXPath(verifyButtonXPath, { timeout: 5000 });
            const buttons = await page.$x(verifyButtonXPath);
            if (buttons.length > 0) {
                const isVisible = await buttons[0].evaluate(el => el.offsetParent !== null);
                const isDisabled = await buttons[0].evaluate(el => el.disabled);
                if (isVisible && !isDisabled) {
                    await humanClick(page, buttons[0], { preClickDelay: true, postClickDelay: true });
                    logger.info('Verify button clicked after entering recovery code');
                    await page.waitForTimeout(3000);
                    
                    // Wait for navigation
                    const urlBefore = page.url();
                    for (let i = 0; i < 10; i++) {
                        await page.waitForTimeout(1000);
                        const urlAfter = page.url();
                        if (urlAfter !== urlBefore) {
                            logger.info('Page navigated after verification', { from: urlBefore, to: urlAfter });
                            break;
                        }
                    }
                    return true;
                }
            }
        } catch (e) {
            logger.debug('Verify button XPath failed, trying fallback', { error: e.message });
        }
        
        // Fallback
        const button = await page.evaluateHandle(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            return buttons.find(btn => {
                const text = btn.textContent.toLowerCase();
                return (text.includes('next') || text.includes('التالي') || text.includes('verify') || text.includes('تحقق')) && !btn.disabled && btn.offsetParent !== null;
            });
        });
        
        if (button && button.asElement()) {
            await humanClick(page, button.asElement(), { preClickDelay: true, postClickDelay: true });
            logger.info('Verify button clicked (fallback)');
            await page.waitForTimeout(3000);
            return true;
        }
        
        return false;
    } catch (error) {
        logger.error('Error handling verification code page', { error: error.message });
        return false;
    }
}

/**
 * Add recovery phone to account
 * إضافة رقم هاتف الاسترداد للحساب
 * 
 * @param {Page} page - Puppeteer page object
 * @param {Object} accountData - Account data including password, phone, etc.
 * @param {number} countryCode - Country code index
 * @returns {Promise<Object>} Result with success status and recovery phone info
 */
export async function addRecoveryPhone(page, accountData, countryCode) {
    try {
        logger.info('Starting recovery phone addition process...');
        
        const currentUrl = page.url();
        logger.info('Current URL before recovery phone process', { url: currentUrl });
        
        // Wait a bit for page to stabilize
        await page.waitForTimeout(3000);
        
        // Step 1: Check if we're on myaccount.google.com
        const pageInfo = await detectRecoveryPage(page);
        logger.info('Initial page detected', { type: pageInfo.type, url: pageInfo.url });
        
        if (pageInfo.type !== 'MY_ACCOUNT') {
            // Navigate to myaccount.google.com if not already there
            logger.info('Not on myaccount.google.com, navigating...');
            await page.goto('https://myaccount.google.com/', { waitUntil: 'networkidle2', timeout: 30000 });
            await page.waitForTimeout(3000);
        }
        
        // Step 2: Click on "Add recovery phone" link
        const linkClicked = await clickAddRecoveryPhone(page);
        if (!linkClicked) {
            logger.warn('Could not click "Add recovery phone" link, but continuing...');
        }
        
        await page.waitForTimeout(2000);
        
        // Step 3: Navigate through pages using smart detection
        const maxSteps = 20;
        for (let step = 0; step < maxSteps; step++) {
            const currentPageInfo = await detectRecoveryPage(page);
            logger.info(`Recovery phone flow step ${step + 1}`, { type: currentPageInfo.type, url: currentPageInfo.url });
            
            switch (currentPageInfo.type) {
                case 'CONFIRM_IDENTIFIER':
                    await handleConfirmIdentifier(page);
                    await page.waitForTimeout(2000);
                    break;
                    
                case 'PASSWORD':
                    const passwordHandled = await handlePasswordPage(page, accountData.password);
                    if (!passwordHandled) {
                        logger.warn('Failed to handle password page');
                        return { success: false, error: 'Failed to enter password' };
                    }
                    await page.waitForTimeout(2000);
                    break;
                    
                case 'CONSENT':
                    await handleConsentPage(page);
                    await page.waitForTimeout(2000);
                    break;
                    
                case 'RECAPTCHA':
                    // Wait for reCAPTCHA to be solved and handle password page when it appears
                    // انتظار حل reCAPTCHA والتعامل مع صفحة كلمة المرور عند ظهورها
                    logger.info('reCAPTCHA page detected, waiting for solution...');
                    const currentRecaptchaUrl = page.url();
                    // Expected password URL (from user's request)
                    // الرابط المتوقع لصفحة كلمة المرور (من طلب المستخدم)
                    const expectedPasswordUrl = 'https://accounts.google.com/v3/signin/challenge/pwd';
                    const recaptchaHandled = await waitForRecaptchaAndPasswordPage(
                        page, 
                        accountData.password,
                        expectedPasswordUrl
                    );
                    if (!recaptchaHandled) {
                        logger.warn('Failed to handle reCAPTCHA or password page, continuing...');
                        // Continue anyway, might have navigated
                    }
                    await page.waitForTimeout(2000);
                    break;
                    
                case 'PHONE_INPUT':
                    // Enter the phone number that was purchased earlier
                    logger.info('Phone input page detected, entering previously purchased phone number...');
                    const phoneHandled = await handlePhoneInputPage(page, accountData.phone);
                    if (!phoneHandled) {
                        logger.warn('Failed to handle phone input page');
                        return { success: false, error: 'Failed to enter phone number' };
                    }
                    await page.waitForTimeout(2000);
                    break;
                    
                case 'GET_VERIFICATION_CODE':
                    // Click button to get verification code
                    logger.info('Get verification code page detected, clicking button...');
                    await handleGetVerificationCodePage(page);
                    await page.waitForTimeout(2000);
                    break;
                    
                case 'VERIFY_CODE':
                    // Get OTP code for recovery phone using same order
                    logger.info('Verification code page detected, getting OTP code from existing order...');
                    const smsProvider = (process.env.SMS_PROVIDER || 'sms-verification').toLowerCase().trim();
                    
                    // Use the same phone and orderId from accountData
                    if (!accountData.phone || !accountData.orderId) {
                        logger.error('Phone number or Order ID missing in accountData', {
                            hasPhone: !!accountData.phone,
                            hasOrderId: !!accountData.orderId
                        });
                        return { success: false, error: 'Phone number or Order ID missing' };
                    }
                    
                    const verificationCode = await getNewRecoveryOTP(
                        accountData.phone, 
                        countryCode, 
                        smsProvider, 
                        accountData.orderId
                    );
                    
                    // Enter verification code
                    const codeHandled = await handleVerificationCodePage(page, verificationCode);
                    if (!codeHandled) {
                        logger.warn('Failed to handle verification code page');
                        return { success: false, error: 'Failed to enter verification code' };
                    }
                    
                    // Success - recovery phone added
                    await page.waitForTimeout(3000);
                    logger.info('Recovery phone added successfully', { 
                        phone: verificationCode.phone,
                        orderId: verificationCode.orderId
                    });
                    return {
                        success: true,
                        recoveryPhone: verificationCode.phone,
                        recoveryPhoneOrderId: verificationCode.orderId,
                        recoveryPhoneCode: verificationCode.code
                    };
                    
                case 'MY_ACCOUNT':
                case 'RECOVERY_OPTIONS':
                    // Try to click Skip button if available
                    // محاولة الضغط على زر Skip إذا كان متاحاً
                    logger.info('Account page or recovery options detected, checking for Skip button...');
                    const skipHandled = await handleSkipButton(page);
                    if (skipHandled) {
                        logger.info('Skip button clicked successfully');
                        await page.waitForTimeout(2000);
                    }
                    
                    // We're back to account page or recovery options, might be done
                    if (step > 3) {
                        logger.info('Returned to account page, recovery phone process may be complete');
                        return { success: true };
                    }
                    break;
                    
                case 'UNKNOWN':
                    logger.warn('Unknown page type detected', { url: currentPageInfo.url });
                    break;
            }
            
            // Check if we've completed the flow
            const finalUrl = page.url();
            if (finalUrl.includes('myaccount.google.com') && step > 5) {
                logger.info('Returned to account page after recovery phone flow');
                return { success: true };
            }
            
            await page.waitForTimeout(1000);
        }
        
        logger.warn('Recovery phone flow completed but could not verify success');
        return { success: true }; // Assume success if we got through the flow
        
    } catch (error) {
        logger.error('Error adding recovery phone', { error: error.message });
        return { success: false, error: error.message };
    }
}

export default {
    addRecoveryPhone
};
