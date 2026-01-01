/**
 * SMS Verification Number API Integration
 * https://sms-verification-number.com/stubs/handler_api
 * Compatible API with sms-verification-number.com
 */

import axios from 'axios';

const SMS_VERIFY_API_URL = 'https://sms-verification-number.com/stubs/handler_api';

// Order status constants
const ORDER_STATUS = {
    WAIT_CODE: 'STATUS_WAIT_CODE',
    CANCEL: 'STATUS_CANCEL',
    OK: 'STATUS_OK'
};

/**
 * Get API key from environment
 */
function getApiKey() {
    return process.env.SMS_VERIFY_API_KEY || '';
}

/**
 * Get language/currency setting (ru = crystals, en = dollars)
 */
function getLang() {
    return process.env.SMS_VERIFY_LANG || 'ru';
}

/**
 * Make API request to SMS Verification service
 * @param {string} action - API action name
 * @param {Object} params - Additional parameters
 * @returns {Promise<any>} Response data
 */
async function makeRequest(action, params = {}) {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error('SMS Verification API key not configured. Set SMS_VERIFY_API_KEY in .env');
    }

    const queryParams = {
        api_key: apiKey,
        action,
        lang: getLang(),
        ...params
    };

    try {
        const response = await axios.get(SMS_VERIFY_API_URL, {
            params: queryParams,
            timeout: 30000
        });

        return response.data;
    } catch (error) {
        console.error(`SMS Verify API Error [${action}]:`, error.response?.data || error.message);
        throw error;
    }
}

/**
 * Check balance
 * @returns {Promise<number>} Current balance
 */
export async function getSmsVerifyBalance() {
    try {
        const balance = await makeRequest('getBalance');
        console.log(`✓ SMS Verify Balance: ${balance}`);
        return parseFloat(balance);
    } catch (error) {
        console.error('Error getting SMS Verify balance:', error.message);
        throw error;
    }
}

/**
 * Get available countries and operators
 * @returns {Promise<Array>} List of countries with operators
 */
export async function getSmsVerifyCountries() {
    try {
        const data = await makeRequest('getCountryAndOperators');
        return data;
    } catch (error) {
        console.error('Error getting countries:', error.message);
        throw error;
    }
}

/**
 * Get prices for a country
 * @param {number} country - Country ID
 * @param {string} operator - Operator code (optional)
 * @param {string} service - Service code (optional)
 * @returns {Promise<Object>} Prices data
 */
export async function getSmsVerifyPrices(country, operator, service) {
    try {
        const params = { country };
        if (operator) params.operator = operator;
        if (service) params.service = service;

        const data = await makeRequest('getPrices', params);
        return data;
    } catch (error) {
        console.error('Error getting prices:', error.message);
        throw error;
    }
}

/**
 * Get services with prices and quantities
 * @param {number} country - Country ID
 * @param {string} operator - Operator code (optional)
 * @param {string} service - Service code (optional)
 * @returns {Promise<Array>} Services with prices
 */
export async function getSmsVerifyServices(country, operator, service) {
    try {
        const params = { country };
        if (operator) params.operator = operator;
        if (service) params.service = service;

        const data = await makeRequest('getServicesAndCost', params);
        return data;
    } catch (error) {
        console.error('Error getting services:', error.message);
        throw error;
    }
}

/**
 * Buy a number for SMS verification
 * @param {string} service - Service code (e.g., 'fu' for Snapchat)
 * @param {number} country - Country ID (default: 16 for UK)
 * @param {string} operator - Operator code (default: 'any')
 * @param {Object} options - Additional options
 * @param {number} options.maxPrice - Maximum price willing to pay
 * @returns {Promise<{id: number, phone: string, price?: number}>}
 */
export async function buySmsVerifyNumber(service = 'go', country = 16, operator = 'virtual58', options = {}) {
    try {
        console.log(`Buying SMS Verify number: service=${service}, country=${country}, operator=${operator}...`);

        const params = { service, country, operator };
        if (options.maxPrice) params.maxPrice = options.maxPrice;

        const response = await makeRequest('getNumber', params);

        // Parse response: ACCESS_NUMBER:ID:NUMBER
        if (typeof response === 'string') {
            if (response === 'NO_BALANCE') {
                throw new Error('Insufficient balance');
            }
            if (response === 'NO_NUMBERS') {
                throw new Error('No numbers available for this combination');
            }
            if (response.startsWith('WRONG_MAX_PRICE:')) {
                const minPrice = response.split(':')[1];
                throw new Error(`Price too low. Minimum: ${minPrice}`);
            }
            if (response.startsWith('ACCESS_NUMBER:')) {
                const parts = response.split(':');
                const id = parseInt(parts[1]);
                const phone = parts[2];

                console.log(`✓ SMS Verify number purchased: ${phone} (ID: ${id})`);

                return { id, phone };
            }
        }

        throw new Error(`Unexpected response: ${response}`);
    } catch (error) {
        console.error('Error buying SMS Verify number:', error.message);
        throw error;
    }
}

/**
 * Buy number using V2 API (returns JSON)
 * @param {string} service - Service code
 * @param {number} country - Country ID
 * @param {string} operator - Operator code
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Order data
 */
export async function buySmsVerifyNumberV2(service = 'fu', country = 16, operator = 'any', options = {}) {
    try {
        console.log(`Buying SMS Verify number (V2): service=${service}, country=${country}...`);

        const params = { service, country, operator };
        if (options.maxPrice) params.maxPrice = options.maxPrice;

        const response = await makeRequest('getNumberV2', params);

        if (typeof response === 'string') {
            if (response === 'NO_BALANCE') throw new Error('Insufficient balance');
            if (response === 'NO_NUMBERS') throw new Error('No numbers available');
            if (response.startsWith('WRONG_MAX_PRICE:')) {
                throw new Error(`Price too low. Min: ${response.split(':')[1]}`);
            }
        }

        console.log(`✓ SMS Verify number purchased: ${response.phoneNumber} (ID: ${response.activationId})`);

        return {
            id: response.activationId,
            phone: response.phoneNumber,
            price: response.activationCost,
            currency: response.currency,
            countryCode: response.countryCode,
            operator: response.activationOperator,
            time: response.activationTime
        };
    } catch (error) {
        console.error('Error buying SMS Verify number (V2):', error.message);
        throw error;
    }
}

/**
 * Check order status and get SMS code
 * @param {number} orderId - Order ID
 * @returns {Promise<{status: string, code?: string}>}
 */
export async function checkSmsVerifyOrder(orderId) {
    try {
        const response = await makeRequest('getStatus', { id: orderId });

        if (typeof response === 'string') {
            if (response === 'STATUS_WAIT_CODE') {
                return { status: 'PENDING', code: null };
            }
            if (response === 'STATUS_CANCEL') {
                return { status: 'CANCELED', code: null };
            }
            if (response.startsWith('STATUS_OK:')) {
                const code = response.split(':')[1];
                return { status: 'RECEIVED', code };
            }
        }

        return { status: 'UNKNOWN', code: null, raw: response };
    } catch (error) {
        console.error('Error checking order status:', error.message);
        throw error;
    }
}

/**
 * Set order status
 * @param {number} orderId - Order ID
 * @param {number} status - Status code: 3=retry SMS, 6=finish, 8=cancel
 * @returns {Promise<string>} Response
 */
export async function setSmsVerifyStatus(orderId, status) {
    try {
        const response = await makeRequest('setStatus', { id: orderId, status });

        if (response === 'CANNOT_BEFORE_2_MIN') {
            throw new Error('Cannot cancel before 2 minutes after ordering');
        }

        return response;
    } catch (error) {
        console.error('Error setting order status:', error.message);
        throw error;
    }
}

/**
 * Cancel order (only if no SMS received)
 * @param {number} orderId - Order ID
 * @returns {Promise<boolean>} Success
 */
export async function cancelSmsVerifyOrder(orderId) {
    try {
        const response = await setSmsVerifyStatus(orderId, 8);
        console.log(`✓ Order ${orderId}: Canceled`);
        return response === 'ACCESS_CANCEL';
    } catch (error) {
        if (error.message.includes('2 minutes')) {
            console.log(`⚠ Order ${orderId}: Cannot cancel yet (wait 2 min)`);
            return false;
        }
        throw error;
    }
}

/**
 * Finish order (complete work with number)
 * @param {number} orderId - Order ID
 * @returns {Promise<boolean>} Success
 */
export async function finishSmsVerifyOrder(orderId) {
    try {
        const response = await setSmsVerifyStatus(orderId, 6);
        console.log(`✓ Order ${orderId}: Finished`);
        return response === 'ACCESS_ACTIVATION';
    } catch (error) {
        console.error(`Error finishing order ${orderId}:`, error.message);
        throw error;
    }
}

/**
 * Request another SMS
 * @param {number} orderId - Order ID
 * @returns {Promise<boolean>} Success
 */
export async function retrySmsVerifyOrder(orderId) {
    try {
        const response = await setSmsVerifyStatus(orderId, 3);
        console.log(`✓ Order ${orderId}: Waiting for new SMS`);
        return response === 'ACCESS_RETRY_GET';
    } catch (error) {
        console.error(`Error requesting new SMS for order ${orderId}:`, error.message);
        throw error;
    }
}

/**
 * Get current activations list
 * @param {Object} options - Filter options
 * @param {number} options.status - Status filter (0=new, 1=finished, 2=canceled, 3=received, 4=waiting)
 * @param {number} options.limit - Limit results
 * @param {string} options.order - Order by field (id/number/date)
 * @param {string} options.orderBy - Sort direction (ASC/DESC)
 * @returns {Promise<Array>} List of activations
 */
export async function getSmsVerifyActivations(options = {}) {
    try {
        const params = {};
        if (options.status !== undefined) params.status = options.status;
        if (options.limit) params.limit = options.limit;
        if (options.order) params.order = options.order;
        if (options.orderBy) params.orderBy = options.orderBy;

        const data = await makeRequest('getCurrentActivationsList', params);
        return data;
    } catch (error) {
        console.error('Error getting activations:', error.message);
        throw error;
    }
}

/**
 * Wait for SMS code
 * @param {number} orderId - Order ID
 * @param {number} maxWaitTime - Max wait time in ms (default: 5 min)
 * @param {number} checkInterval - Check interval in ms (default: 3 sec)
 * @returns {Promise<string>} SMS code
 */
export async function waitForSmsVerifyCode(orderId, maxWaitTime = 300000, checkInterval = 3000) {
    const startTime = Date.now();
    let lastStatus = 'PENDING';

    console.log(`Waiting for SMS (Order: ${orderId}, Max: ${maxWaitTime / 1000}s)...`);

    while (Date.now() - startTime < maxWaitTime) {
        try {
            const result = await checkSmsVerifyOrder(orderId);

            if (result.status !== lastStatus) {
                console.log(`  Status: ${lastStatus} -> ${result.status}`);
                lastStatus = result.status;
            }

            if (result.code) {
                console.log(`✓ SMS code received: ${result.code}`);
                return result.code;
            }

            if (result.status === 'CANCELED') {
                throw new Error('Order was canceled');
            }

        } catch (error) {
            if (error.message.includes('canceled')) throw error;
            console.log(`  Retry after error: ${error.message}`);
        }

        await new Promise(r => setTimeout(r, checkInterval));
    }

    throw new Error(`Timeout waiting for SMS (Order: ${orderId})`);
}

/**
 * Complete flow: Buy number, wait for SMS, finish order
 * @param {Object} options - Options
 * @param {string} options.service - Service code (default: 'fu' for Snapchat)
 * @param {number} options.country - Country ID (default: 16 for UK)
 * @param {string} options.operator - Operator code (default: 'any')
 * @param {number} options.maxWaitTime - Max wait time for SMS
 * @param {number} options.maxPrice - Maximum price
 * @returns {Promise<{phone: string, code: string, orderId: number}>}
 */
export async function buyNumberAndGetSMS({
    service = 'fu',
    country = 16,
    operator = 'any',
    maxWaitTime = 300000,
    maxPrice
} = {}) {
    let order = null;

    try {
        order = await buySmsVerifyNumber(service, country, operator, { maxPrice });
        const code = await waitForSmsVerifyCode(order.id, maxWaitTime);
        await finishSmsVerifyOrder(order.id);

        return { phone: order.phone, code, orderId: order.id };
    } catch (error) {
        if (order?.id) {
            // Wait 2 minutes before cancel if needed
            await cancelSmsVerifyOrder(order.id).catch(() => {});
        }
        throw error;
    }
}

// Country codes reference (commonly used)
export const SMS_VERIFY_COUNTRIES = {
    RUSSIA: 0,
    UKRAINE: 1,
    KAZAKHSTAN: 2,
    CHINA: 3,
    PHILIPPINES: 4,
    MYANMAR: 5,
    INDONESIA: 6,
    MALAYSIA: 7,
    KENYA: 8,
    TANZANIA: 9,
    VIETNAM: 10,
    KYRGYZSTAN: 11,
    USA_VIRTUAL: 12,
    ISRAEL: 13,
    HONG_KONG: 14,
    POLAND: 15,
    UK: 16,
    MADAGASCAR: 17,
    CONGO: 18,
    NIGERIA: 19,
    MACAU: 20,
    EGYPT: 21,
    INDIA: 22,
    IRELAND: 23,
    CAMBODIA: 24,
    LAOS: 25,
    HAITI: 26,
    IVORY_COAST: 27,
    GAMBIA: 28,
    SERBIA: 29,
    YEMEN: 30,
    SOUTH_AFRICA: 31,
    ROMANIA: 32,
    COLOMBIA: 33,
    ESTONIA: 34,
    AZERBAIJAN: 35,
    CANADA: 36,
    MOROCCO: 37,
    GHANA: 38,
    ARGENTINA: 39,
    UZBEKISTAN: 40,
    CAMEROON: 41,
    CHAD: 42,
    GERMANY: 43,
    LITHUANIA: 44,
    CROATIA: 45,
    SWEDEN: 46,
    IRAQ: 47,
    NETHERLANDS: 48,
    LATVIA: 49,
    AUSTRIA: 50,
    BELARUS: 51,
    THAILAND: 52,
    SAUDI_ARABIA: 53,
    MEXICO: 54,
    TAIWAN: 55,
    SPAIN: 56,
    IRAN: 57,
    ALGERIA: 58,
    SLOVENIA: 59,
    BANGLADESH: 60,
    SENEGAL: 61,
    TURKEY: 62,
    CZECH: 63,
    SRI_LANKA: 64,
    PERU: 65,
    PAKISTAN: 66,
    NEW_ZEALAND: 67,
    GUINEA: 68,
    MALI: 69,
    VENEZUELA: 70,
    ETHIOPIA: 71,
    MONGOLIA: 72,
    BRAZIL: 73,
    AFGHANISTAN: 74,
    UGANDA: 75,
    ANGOLA: 76,
    CYPRUS: 77,
    FRANCE: 78,
    GUINEA_BISSAU: 79,
    MOZAMBIQUE: 80,
    NEPAL: 81,
    BELGIUM: 82,
    BULGARIA: 83,
    HUNGARY: 84,
    MOLDOVA: 85,
    ITALY: 86,
    PARAGUAY: 87,
    HONDURAS: 88,
    TUNISIA: 89,
    NICARAGUA: 90,
    TIMOR_LESTE: 91,
    BOLIVIA: 92,
    COSTA_RICA: 93,
    GUATEMALA: 94,
    UAE: 95,
    ZIMBABWE: 96,
    PUERTO_RICO: 97,
    SUDAN: 98,
    TOGO: 99,
    KUWAIT: 100,
    EL_SALVADOR: 101,
    LIBYA: 102,
    JAMAICA: 103,
    TRINIDAD: 104,
    ECUADOR: 105,
    ESWATINI: 106,
    OMAN: 107,
    BOSNIA: 108,
    DOMINICAN_REP: 109,
    SYRIA: 110,
    QATAR: 111,
    PANAMA: 112,
    CUBA: 113,
    MAURITANIA: 114,
    SIERRA_LEONE: 115,
    JORDAN: 116,
    PORTUGAL: 117,
    BARBADOS: 118,
    BURUNDI: 119,
    BENIN: 120,
    BRUNEI: 121,
    BAHAMAS: 122,
    BOTSWANA: 123,
    BELIZE: 124,
    CAR: 125,
    DOMINICA: 126,
    GRENADA: 127,
    GEORGIA: 128,
    GREECE: 129,
    GUINEA_CONAKRY: 130,
    GUYANA: 131,
    ICELAND: 132,
    COMOROS: 133,
    ST_KITTS: 134,
    LIBERIA: 135,
    LESOTHO: 136,
    MALAWI: 137,
    NAMIBIA: 138,
    NIGER: 139,
    RWANDA: 140,
    SLOVAKIA: 141,
    SURINAME: 142,
    TAJIKISTAN: 143,
    MONACO: 144,
    BAHRAIN: 145,
    REUNION: 146,
    ZAMBIA: 147,
    ARMENIA: 148,
    SOMALIA: 149,
    CONGO_DRC: 150,
    CHILE: 151,
    BURKINA_FASO: 152,
    LEBANON: 153,
    GABON: 154,
    ALBANIA: 155,
    URUGUAY: 156,
    MAURITIUS: 157,
    BHUTAN: 158,
    MALDIVES: 159,
    GUADELOUPE: 160,
    TURKMENISTAN: 161,
    FRENCH_GUIANA: 162,
    FINLAND: 163,
    ST_LUCIA: 164,
    LUXEMBOURG: 165,
    ST_VINCENT: 166,
    EQUATORIAL_GUINEA: 167,
    DJIBOUTI: 168,
    ANTIGUA: 169,
    CAYMAN_ISLANDS: 170,
    MONTENEGRO: 171,
    DENMARK: 172,
    SWITZERLAND: 173,
    NORWAY: 174,
    AUSTRALIA: 175,
    ERITREA: 176,
    SOUTH_SUDAN: 177,
    SAO_TOME: 178,
    ARUBA: 179,
    MONTSERRAT: 180,
    ANGUILLA: 181,
    NORTH_MACEDONIA: 183,
    SEYCHELLES: 184,
    NEW_CALEDONIA: 185,
    CAPE_VERDE: 186,
    USA_REAL: 187,
    PALAU: 188,
    FIJI: 189,
    SOUTH_KOREA: 190,
    WESTERN_SAHARA: 192,
    SOLOMON_ISLANDS: 193,
    SINGAPORE: 196,
    TONGA: 197,
    AMERICAN_SAMOA: 198,
    MALTA: 199,
    JAPAN: 670
};

// Service codes reference (commonly used)
export const SMS_VERIFY_SERVICES = {
    SNAPCHAT: 'fu',
    WHATSAPP: 'wa',
    TELEGRAM: 'tg',
    INSTAGRAM: 'ig',
    FACEBOOK: 'fb',
    GOOGLE: 'go',
    TWITTER: 'tw',
    TIKTOK: 'lf',
    DISCORD: 'ds',
    VIBER: 'vi',
    WECHAT: 'wb',
    LINE: 'me',
    UBER: 'ub',
    MICROSOFT: 'mm',
    APPLE: 'wx',
    AMAZON: 'am',
    NETFLIX: 'nf',
    STEAM: 'mt',
    VK: 'vk',
    OK: 'ok'
};






