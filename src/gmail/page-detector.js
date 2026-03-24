/**
 * Gmail Page Detector
 * كاشف صفحات Gmail الذكي
 */

import logger from '../utils/logger.js';

/**
 * Detect current Gmail page type
 * اكتشاف نوع صفحة Gmail الحالية
 */
export async function detectGmailPage(page) {
    try {
        const url = page.url();
        logger.debug('Detecting Gmail page', { url });

        // Check URL patterns first (most reliable)
        // Check for phone verification page
        if (url.includes('/collectemailphone') || url.includes('/signup/phone')) {
            logger.info('Detected: Phone verification page (by URL)');
            return {
                type: 'PHONE_VERIFICATION',
                elements: ['phone'],
                action: 'enter_phone',
                url: url
            };
        }

        // Check for verification code page
        if (url.includes('/challenge/phone') || url.includes('/verification/phone') || 
            url.includes('/challenge/sms') || url.includes('/verification/sms')) {
            logger.info('Detected: Verification code page (by URL)');
            return {
                type: 'VERIFICATION_CODE',
                elements: ['code'],
                action: 'enter_code',
                url: url
            };
        }

        // Check for name input page
        if (url.includes('/steps/signup/name') || url.includes('/signup/name')) {
            logger.info('Detected: Name input page (by URL)');
            return {
                type: 'SIGN_UP_FORM',
                elements: ['firstName', 'lastName'],
                action: 'fill_name',
                url: url
            };
        }

        // Check for username/email input page
        if (url.includes('/steps/signup/username') || url.includes('/signup/username') ||
            url.includes('/steps/signup/email') || url.includes('/signup/email')) {
            logger.info('Detected: Username/Email input page (by URL)');
            return {
                type: 'USERNAME_INPUT',
                elements: ['username'],
                action: 'enter_username',
                url: url
            };
        }

        // Check for password input page
        if (url.includes('/steps/signup/password') || url.includes('/signup/password')) {
            logger.info('Detected: Password input page (by URL)');
            return {
                type: 'PASSWORD_INPUT',
                elements: ['password'],
                action: 'enter_password',
                url: url
            };
        }

        // Check for birthday/gender input page
        if (url.includes('/steps/signup/birthdaygender') || url.includes('/signup/birthdaygender') ||
            url.includes('/birthdaygender')) {
            logger.info('Detected: Birthday/Gender input page (by URL)');
            return {
                type: 'BIRTHDAY_GENDER',
                elements: ['day', 'month', 'year', 'gender'],
                action: 'fill_birthday_gender',
                url: url
            };
        }

        if (url.includes('/signin/identifier') || url.includes('/ServiceLogin')) {
            return await detectSignInPage(page);
        }
        
        if (url.includes('/signup') || url.includes('/webcreateaccount')) {
            return await detectSignUpPage(page);
        }
        
        if (url.includes('/challenge') || url.includes('/verification')) {
            return await detectVerificationPage(page);
        }

        // Detect by class names (more reliable for Google pages)
        const pageTypeByClass = await detectByClassNames(page);
        if (pageTypeByClass && pageTypeByClass.type !== 'UNKNOWN') {
            return pageTypeByClass;
        }

        // Detect by page elements as fallback
        const pageType = await detectByElements(page);
        return pageType;
    } catch (error) {
        logger.error('Error detecting Gmail page', { error: error.message });
        return { type: 'UNKNOWN', elements: [] };
    }
}

/**
 * Detect sign in page
 * اكتشاف صفحة تسجيل الدخول
 */
async function detectSignInPage(page) {
    try {
        const selectors = [
            'input[type="email"]',
            'input[name="identifier"]',
            '#identifierId',
            'button:has-text("Next")',
            'button:has-text("التالي")'
        ];

        const foundElements = [];
        for (const selector of selectors) {
            try {
                const element = await page.$(selector);
                if (element) {
                    foundElements.push(selector);
                }
            } catch (e) {
                // Continue
            }
        }

        if (foundElements.length > 0) {
            logger.info('Detected: Sign In page');
            return {
                type: 'SIGN_IN',
                elements: foundElements,
                action: 'enter_email'
            };
        }
    } catch (error) {
        logger.debug('Error detecting sign in page', { error: error.message });
    }

    return null;
}

/**
 * Detect sign up page
 * اكتشاف صفحة إنشاء حساب
 */
async function detectSignUpPage(page) {
    try {
        // Check for "Create account" button or sign up form
        const selectors = [
            'button:has-text("Create account")',
            'button:has-text("إنشاء حساب")',
            'input[name="firstName"]',
            'input[name="lastName"]',
            '#firstName',
            '#lastName',
            'input[type="text"][aria-label*="First name" i]',
            'input[type="text"][aria-label*="Last name" i]'
        ];

        const foundElements = [];
        for (const selector of selectors) {
            try {
                const element = await page.$(selector);
                if (element) {
                    foundElements.push(selector);
                }
            } catch (e) {
                // Continue
            }
        }

        // Also check for "Create account" button using XPath
        try {
            const createAccountButton = await page.$x('//button[contains(text(), "Create account") or contains(text(), "إنشاء حساب")]');
            if (createAccountButton.length > 0) {
                foundElements.push('create_account_button');
            }
        } catch (e) {
            // Continue
        }

        if (foundElements.length > 0) {
            logger.info('Detected: Sign Up page');
            return {
                type: 'SIGN_UP',
                elements: foundElements,
                action: 'fill_signup_form'
            };
        }
    } catch (error) {
        logger.debug('Error detecting sign up page', { error: error.message });
    }

    return null;
}

/**
 * Detect verification page
 * اكتشاف صفحة التحقق
 */
async function detectVerificationPage(page) {
    try {
        const selectors = [
            'input[type="tel"]',
            'input[name="phoneNumberId"]',
            'input[aria-label*="phone" i]',
            'input[aria-label*="Phone" i]',
            'button:has-text("Next")',
            'button:has-text("Verify")'
        ];

        const foundElements = [];
        for (const selector of selectors) {
            try {
                const element = await page.$(selector);
                if (element) {
                    foundElements.push(selector);
                }
            } catch (e) {
                // Continue
            }
        }

        // Check for verification code input
        const codeInputs = await page.$$('input[type="text"][maxlength="6"], input[type="text"][maxlength="8"]');
        if (codeInputs.length > 0) {
            foundElements.push('verification_code_input');
        }

        if (foundElements.length > 0) {
            logger.info('Detected: Verification page');
            return {
                type: 'VERIFICATION',
                elements: foundElements,
                action: 'enter_verification'
            };
        }
    } catch (error) {
        logger.debug('Error detecting verification page', { error: error.message });
    }

    return null;
}

/**
 * Detect page by class names (Google Material Design classes)
 * اكتشاف الصفحة بناءً على أسماء الفئات (فئات Google Material Design)
 */
async function detectByClassNames(page) {
    try {
        await page.waitForTimeout(1000);

        const classChecks = await page.evaluate(() => {
            // Cache common queries for performance
            const body = document.body;
            const allButtons = Array.from(document.querySelectorAll('button, a, span'));
            const allInputs = Array.from(document.querySelectorAll('input'));
            
            // Google Material Design class patterns
            const checks = {
                // Account type selection menu (dropdown with "For my personal use")
                hasAccountTypeMenu: !!(
                    document.querySelector('ul.VfPpkd-StrnGf-rymPhb[role="menu"]') ||
                    document.querySelector('ul[jsname="rymPhb"][role="menu"]') ||
                    document.querySelector('ul.VfPpkd-StrnGf-rymPhb.DMZ54e[jsname="rymPhb"]') ||
                    document.querySelector('li[jsname="RZzeR"]') || // "For my personal use" option
                    document.querySelector('li.gNVsKb.G3hhxb.VfPpkd-StrnGf-rymPhb-ibnC6b[jsname="RZzeR"]')
                ),

                // Birthday/Gender form indicators
                hasBirthdayGenderForm: !!(
                    document.querySelector('div[jsname="ZU2VHd"]') || // Gender container
                    document.querySelector('div[id="gender"]') ||
                    document.querySelector('div.Udn8cf.aVfon.Jj6Lae') || // Birthday/Gender wrapper
                    document.querySelector('div.Udn8cf.aVfon.Jj6Lae[jscontroller="xCK0rb"]') ||
                    (document.querySelector('input[aria-label*="day" i]') &&
                     document.querySelector('div[jsname="O1htCb"]') && // Month dropdown
                     document.querySelector('div[jsname="ZU2VHd"]')) // Gender dropdown
                ),

                // Month dropdown (birthday form)
                hasMonthDropdown: !!(
                    document.querySelector('div[jsname="O1htCb"]') ||
                    document.querySelector('div.VfPpkd-O1htCb[jsname="O1htCb"]') ||
                    document.querySelector('div.VfPpkd-O1htCb-H9tDt.kqZXwe[jsname="O1htCb"]') ||
                    document.querySelector('ul.VfPpkd-rymPhb[aria-label="Month"]') ||
                    document.querySelector('ul.VfPpkd-rymPhb.r6B9Fd.bwNLcf.P2Hi5d[aria-label="Month"]')
                ),

                // Gender dropdown
                hasGenderDropdown: !!(
                    document.querySelector('div[jsname="ZU2VHd"]') ||
                    document.querySelector('div[id="gender"]') ||
                    document.querySelector('div.Udn8cf.aVfon.Jj6Lae[jscontroller="xCK0rb"]') ||
                    document.querySelector('div.VfPpkd-O1htCb[jsname="O1htCb"][id="gender"]') ||
                    document.querySelector('ul.VfPpkd-rymPhb[aria-label="Gender"]')
                ),

                // Username/Email input page
                hasUsernameInput: !!(
                    document.querySelector('input[aria-label="Create a Gmail address"]') ||
                    document.querySelector('input[aria-label*="Gmail address" i]') ||
                    document.querySelector('input[type="text"][autocomplete="username"]') ||
                    (document.querySelector('input[type="text"]') &&
                     document.querySelector('form span section') &&
                     !document.querySelector('input[type="password"]') &&
                     !document.querySelector('input[aria-label*="day" i]'))
                ),

                // Password input page
                hasPasswordInput: !!(
                    document.querySelector('input[type="password"][name="Passwd"]') ||
                    (document.querySelector('input[type="password"]') &&
                     document.querySelector('form span section'))
                ),

                // Phone verification page
                hasPhoneInput: !!(
                    document.querySelector('input[type="tel"]') ||
                    document.querySelector('input[name="phoneNumberId"]') ||
                    (document.querySelector('input[aria-label*="phone" i]') &&
                     !document.querySelector('input[type="text"][maxlength="6"]'))
                ),

                // Verification code page
                hasVerificationCode: !!(
                    document.querySelector('input[type="text"][maxlength="6"]') ||
                    document.querySelector('input[type="text"][maxlength="8"]') ||
                    document.querySelector('input[aria-label*="code" i]')
                ),

                // Name input form (first name, last name)
                hasNameForm: !!(
                    document.querySelector('input[aria-label*="First name" i]') &&
                    document.querySelector('input[aria-label*="Last name" i]')
                ),

                // Suggested emails page (with "Create your own Gmail address" option)
                hasSuggestedEmails: !!(
                    Array.from(document.querySelectorAll('button, a, span')).some(el => {
                        const text = el.textContent.toLowerCase();
                        return (text.includes('create your own') && text.includes('gmail address')) ||
                               (text.includes('create') && text.includes('own') && text.includes('email'));
                    })
                ),

                // Next button (Google Material Design)
                hasNextButton: !!(
                    document.querySelector('button.VfPpkd-LgbsSe') ||
                    document.querySelector('button[jsname="OCpkoe"]') ||
                    Array.from(document.querySelectorAll('button')).some(btn => {
                        const text = btn.textContent.toLowerCase().trim();
                        return text === 'next' || text === 'التالي';
                    })
                )
            };

            return checks;
        });

        // Detect page type based on class combinations
        if (classChecks.hasAccountTypeMenu) {
            logger.info('Detected: Account type selection menu (by class names)');
            return {
                type: 'ACCOUNT_TYPE_SELECTION',
                elements: ['account_type_menu'],
                action: 'select_account_type',
                method: 'class_names'
            };
        }

        if (classChecks.hasBirthdayGenderForm || (classChecks.hasMonthDropdown && classChecks.hasGenderDropdown)) {
            logger.info('Detected: Birthday/Gender form (by class names)');
            return {
                type: 'BIRTHDAY_GENDER',
                elements: ['day', 'month', 'year', 'gender'],
                action: 'fill_birthday_gender',
                method: 'class_names'
            };
        }

        if (classChecks.hasSuggestedEmails) {
            logger.info('Detected: Suggested emails page (by class names)');
            return {
                type: 'SUGGESTED_EMAILS',
                elements: ['suggested_emails', 'create_own_link'],
                action: 'click_create_own_email',
                method: 'class_names'
            };
        }

        if (classChecks.hasUsernameInput && !classChecks.hasPasswordInput) {
            logger.info('Detected: Username/Email input page (by class names)');
            return {
                type: 'USERNAME_INPUT',
                elements: ['username'],
                action: 'enter_username',
                method: 'class_names'
            };
        }

        if (classChecks.hasPasswordInput) {
            logger.info('Detected: Password input page (by class names)');
            return {
                type: 'PASSWORD_INPUT',
                elements: ['password'],
                action: 'enter_password',
                method: 'class_names'
            };
        }

        if (classChecks.hasPhoneInput && !classChecks.hasVerificationCode) {
            logger.info('Detected: Phone verification page (by class names)');
            return {
                type: 'PHONE_VERIFICATION',
                elements: ['phone'],
                action: 'enter_phone',
                method: 'class_names'
            };
        }

        if (classChecks.hasVerificationCode) {
            logger.info('Detected: Verification code page (by class names)');
            return {
                type: 'VERIFICATION_CODE',
                elements: ['code'],
                action: 'enter_code',
                method: 'class_names'
            };
        }

        if (classChecks.hasNameForm) {
            logger.info('Detected: Name input form (by class names)');
            return {
                type: 'SIGN_UP_FORM',
                elements: ['firstName', 'lastName'],
                action: 'fill_signup_form',
                method: 'class_names'
            };
        }

        logger.debug('Could not detect page type by class names');
        return {
            type: 'UNKNOWN',
            elements: [],
            action: 'wait',
            method: 'class_names'
        };
    } catch (error) {
        logger.error('Error detecting page by class names', { error: error.message });
        return {
            type: 'UNKNOWN',
            elements: [],
            action: 'wait',
            method: 'class_names'
        };
    }
}

/**
 * Detect page by elements
 * اكتشاف الصفحة بناءً على العناصر
 */
async function detectByElements(page) {
    try {
        // Wait a bit for page to load
        await page.waitForTimeout(1000);

        // Check for various page indicators
        const checks = await page.evaluate(() => {
            const indicators = {
                hasEmailInput: !!document.querySelector('input[type="email"], input[name="identifier"], #identifierId'),
                hasPasswordInput: !!document.querySelector('input[type="password"]'),
                hasFirstNameInput: !!document.querySelector('input[name="firstName"], #firstName, input[aria-label*="First name" i]'),
                hasLastNameInput: !!document.querySelector('input[name="lastName"], #lastName, input[aria-label*="Last name" i]'),
                hasPhoneInput: !!document.querySelector('input[type="tel"], input[name="phoneNumberId"]'),
                hasVerificationCode: !!document.querySelector('input[type="text"][maxlength="6"], input[type="text"][maxlength="8"]'),
                hasCreateAccountButton: !!Array.from(document.querySelectorAll('button')).find(btn => 
                    btn.textContent.includes('Create account') || btn.textContent.includes('إنشاء حساب')
                ),
                hasNextButton: !!Array.from(document.querySelectorAll('button')).find(btn => 
                    btn.textContent.includes('Next') || btn.textContent.includes('التالي')
                )
            };
            return indicators;
        });

        // Check for birthday/gender inputs
        const hasBirthdayInputs = await page.evaluate(() => {
            return !!(
                document.querySelector('input[name="day"], input[aria-label*="day" i]') &&
                document.querySelector('#month, select[name="month"]') &&
                document.querySelector('input[name="year"], input[aria-label*="year" i]') &&
                document.querySelector('#gender, select[name="gender"]')
            );
        });

        if (hasBirthdayInputs) {
            logger.info('Detected: Birthday/Gender form');
            return {
                type: 'BIRTHDAY_GENDER',
                elements: ['day', 'month', 'year', 'gender'],
                action: 'fill_birthday_gender'
            };
        }

        // Determine page type based on indicators
        if (checks.hasFirstNameInput && checks.hasLastNameInput) {
            logger.info('Detected: Sign Up form');
            return {
                type: 'SIGN_UP_FORM',
                elements: ['firstName', 'lastName'],
                action: 'fill_signup_form'
            };
        }

        if (checks.hasPhoneInput && !checks.hasVerificationCode) {
            logger.info('Detected: Phone verification input');
            return {
                type: 'PHONE_VERIFICATION',
                elements: ['phone'],
                action: 'enter_phone'
            };
        }

        if (checks.hasVerificationCode) {
            logger.info('Detected: Verification code input');
            return {
                type: 'VERIFICATION_CODE',
                elements: ['code'],
                action: 'enter_code'
            };
        }

        if (checks.hasEmailInput && !checks.hasPasswordInput) {
            logger.info('Detected: Email input page');
            return {
                type: 'EMAIL_INPUT',
                elements: ['email'],
                action: 'enter_email'
            };
        }

        if (checks.hasCreateAccountButton) {
            logger.info('Detected: Create account button present');
            return {
                type: 'SIGN_UP_START',
                elements: ['create_account_button'],
                action: 'click_create_account'
            };
        }

        logger.warn('Could not detect page type');
        return {
            type: 'UNKNOWN',
            elements: [],
            action: 'wait'
        };
    } catch (error) {
        logger.error('Error detecting page by elements', { error: error.message });
        return {
            type: 'UNKNOWN',
            elements: [],
            action: 'wait'
        };
    }
}

/**
 * Wait for specific element
 * انتظار عنصر محدد
 */
export async function waitForElement(page, selector, timeout = 10000) {
    try {
        await page.waitForSelector(selector, { timeout });
        return await page.$(selector);
    } catch (error) {
        logger.debug(`Element not found: ${selector}`, { error: error.message });
        return null;
    }
}

/**
 * Check if element exists
 * التحقق من وجود عنصر
 */
export async function elementExists(page, selector) {
    try {
        const element = await page.$(selector);
        return element !== null;
    } catch (error) {
        return false;
    }
}

/**
 * Wait for page to load completely
 * انتظار تحميل الصفحة بالكامل
 */
export async function waitForPageLoad(page, timeout = 30000) {
    try {
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout });
        await page.waitForTimeout(2000); // Additional wait for rendering
        logger.debug('Page loaded and settled');
    } catch (error) {
        logger.warn(`Page load might not be complete or timed out: ${error.message}`);
    }
}

export default {
    detectGmailPage,
    waitForElement,
    elementExists,
    waitForPageLoad
};


