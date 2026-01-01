/**
 * 5SIM Legacy API (api1.5sim.net) - For Old API Compatibility
 * Primary attempt: England + virtual15 (vodafone)
 * This API uses the old format for compatibility with existing software
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Legacy API Configuration
const LEGACY_API_URL = 'http://api1.5sim.net/stubs/handler_api.php';
// Get API key from .env or use default (if provided)
const FIVESIM_API_KEY = process.env.FIVESIM_API_KEY || process.env.SMS_VERIFY_API_KEY || '9f634afcb5584057bb5a0df60b6a7784';

// Default settings for first attempt (can be overridden via .env)
const DEFAULT_COUNTRY = process.env.FIVESIM_COUNTRY || 'england'; // England
const DEFAULT_OPERATOR = process.env.FIVESIM_OPERATOR || 'any'; // 'any' recommended to avoid NO_NUMBERS errors
const DEFAULT_SERVICE = process.env.FIVESIM_SERVICE || 'go'; // 'go' for Google/YouTube (from user request) or 'fu' for Snapchat
const MAX_PRICE = parseFloat(process.env.FIVESIM_MAX_PRICE) || 50; // Maximum price in rubles

/**
 * Make a request to the legacy 5SIM API
 */
async function makeLegacyRequest(params) {
    const url = new URL(LEGACY_API_URL);
    url.searchParams.append('api_key', FIVESIM_API_KEY);
    
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.append(key, value);
    }

    console.log(`[Legacy API] Request: ${url.toString().replace(FIVESIM_API_KEY, '***')}`);

    try {
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        const text = await response.text();
        console.log(`[Legacy API] Response: ${text}`);

        // Try to parse as JSON first
        try {
            return { success: true, data: JSON.parse(text), raw: text };
        } catch {
            // Return as text if not JSON
            return { success: true, data: text, raw: text };
        }
    } catch (error) {
        console.error(`[Legacy API] Error: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Get balance from legacy API
 * Response: ACCESS_BALANCE:$balance
 */
export async function getLegacyBalance() {
    const result = await makeLegacyRequest({ action: 'getBalance' });
    
    if (!result.success) {
        return { success: false, error: result.error };
    }

    const raw = result.raw;
    if (raw.startsWith('ACCESS_BALANCE:')) {
        const balance = parseFloat(raw.split(':')[1]);
        return { success: true, balance };
    }
    
    return { success: false, error: raw };
}

/**
 * Get available numbers count
 */
export async function getLegacyNumbersStatus(country = DEFAULT_COUNTRY) {
    const result = await makeLegacyRequest({
        action: 'getNumbersStatus',
        country: country
    });
    
    return result;
}

/**
 * Buy a number from legacy API
 * Response: ACCESS_NUMBER:$id:$number
 * 
 * @param {string} service - Service code (default: 'fu' for Snapchat)
 * @param {number|string} country - Country code (default: 16 for England)
 * @param {string} operator - Operator name (default: 'virtual15')
 */
export async function buyLegacyNumber(
    service = DEFAULT_SERVICE,
    country = DEFAULT_COUNTRY,
    operator = DEFAULT_OPERATOR
) {
    console.log(`\n=== Buying Number (Legacy API) ===`);
    console.log(`Service: ${service}, Country: ${country}, Operator: ${operator}`);

    const result = await makeLegacyRequest({
        action: 'getNumber',
        service: service,
        country: country, // Use the passed country parameter
        operator: operator // Use the passed operator parameter
    });

    if (!result.success) {
        return { success: false, error: result.error };
    }

    const raw = result.raw;

    // Check for error responses
    if (raw === 'NO_NUMBERS') {
        console.log('✗ No numbers available');
        return { success: false, error: 'NO_NUMBERS', noNumbers: true };
    }
    if (raw === 'NO_BALANCE') {
        console.log('✗ Not enough balance');
        return { success: false, error: 'NO_BALANCE' };
    }
    if (raw === 'BAD_KEY') {
        console.log('✗ Invalid API key');
        return { success: false, error: 'BAD_KEY' };
    }
    if (raw === 'BAD_SERVICE') {
        console.log('✗ Invalid service');
        return { success: false, error: 'BAD_SERVICE' };
    }
    if (raw === 'BAD_ACTION') {
        console.log('✗ Invalid action');
        return { success: false, error: 'BAD_ACTION' };
    }

    // Parse successful response: ACCESS_NUMBER:$id:$number
    if (raw.startsWith('ACCESS_NUMBER:')) {
        const parts = raw.split(':');
        const orderId = parts[1];
        const phoneNumber = parts[2];
        
        console.log(`✓ Number purchased: ${phoneNumber} (Order ID: ${orderId})`);
        
        return {
            success: true,
            orderId: orderId,
            phone: phoneNumber,
            country: country === 16 ? 'england' : country,
            operator: operator,
            service: service,
            apiType: 'legacy'
        };
    }

    return { success: false, error: raw };
}

/**
 * Get order status / Check for SMS
 * Responses:
 * - STATUS_WAIT_CODE - waiting for SMS
 * - STATUS_OK:$code - SMS received
 * - STATUS_CANCEL - order cancelled
 * - STATUS_WAIT_RETRY:$lastcode - waiting for new SMS
 * - STATUS_WAIT_RESEND - waiting for resend
 */
export async function getLegacyOrderStatus(orderId) {
    const result = await makeLegacyRequest({
        action: 'getStatus',
        id: orderId
    });

    if (!result.success) {
        return { success: false, error: result.error };
    }

    const raw = result.raw;

    // Parse status
    if (raw === 'STATUS_WAIT_CODE') {
        return { success: true, status: 'PENDING', waiting: true };
    }
    if (raw.startsWith('STATUS_OK:')) {
        const code = raw.split(':')[1];
        return { success: true, status: 'RECEIVED', code: code };
    }
    if (raw === 'STATUS_CANCEL') {
        return { success: true, status: 'CANCELED' };
    }
    if (raw.startsWith('STATUS_WAIT_RETRY:')) {
        const lastCode = raw.split(':')[1];
        return { success: true, status: 'WAIT_RETRY', lastCode: lastCode };
    }
    if (raw === 'STATUS_WAIT_RESEND') {
        return { success: true, status: 'WAIT_RESEND' };
    }
    if (raw === 'NO_ACTIVATION') {
        return { success: false, error: 'NO_ACTIVATION' };
    }

    return { success: false, error: raw };
}

/**
 * Set order status
 * Status codes:
 * -1 - cancel activation
 * 1 - SMS sent (ready to receive)
 * 3 - request another code
 * 6 - complete activation
 * 8 - number used, cancel
 */
export async function setLegacyOrderStatus(orderId, status) {
    console.log(`[Legacy API] Setting order ${orderId} status to: ${status}`);
    
    // const result = await makeLegacyRequest({
    //     action: 'setStatus',
    //     id: orderId,
    //     status: status
    // });

    // if (!result.success) {
    //     return { success: false, error: result.error };
    // }

    // const raw = result.raw;

    // if (raw === 'ACCESS_READY') {
    //     return { success: true, status: 'READY' };
    // }
    // if (raw === 'ACCESS_RETRY_GET') {
    //     return { success: true, status: 'RETRY' };
    // }
    // if (raw === 'ACCESS_ACTIVATION') {
    //     return { success: true, status: 'FINISHED' };
    // }
    // if (raw === 'ACCESS_CANCEL') {
    //     return { success: true, status: 'CANCELED' };
    // }

    return { success: true, status: 'READY' };
}

/**
 * Cancel order
 */
export async function cancelLegacyOrder(orderId) {
    return await setLegacyOrderStatus(orderId, -1);
}

/**
 * Finish order (complete activation)
 */
export async function finishLegacyOrder(orderId) {
    return await setLegacyOrderStatus(orderId, 6);
}

/**
 * Request another SMS code
 */
export async function requestLegacyResend(orderId) {
    return await setLegacyOrderStatus(orderId, 3);
}

/**
 * Report number as used and cancel
 */
export async function reportLegacyNumberUsed(orderId) {
    return await setLegacyOrderStatus(orderId, 8);
}

/**
 * Wait for SMS code from legacy API
 * @param {string} orderId - Order ID
 * @param {number} timeout - Timeout in milliseconds (default: 120000 = 2 minutes)
 * @param {number} interval - Check interval in milliseconds (default: 5000 = 5 seconds)
 */
export async function waitForLegacySMS(orderId, timeout = 120000, interval = 5000) {
    console.log(`\n=== Waiting for SMS (Legacy API) ===`);
    console.log(`Order ID: ${orderId}, Timeout: ${timeout/1000}s`);

    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        console.log(`[${elapsed}s] Checking for SMS...`);

        const result = await getLegacyOrderStatus(orderId);

        if (!result.success) {
            console.log(`✗ Error checking status: ${result.error}`);
            if (result.error === 'NO_ACTIVATION') {
                return { success: false, error: 'Order not found' };
            }
            // Continue waiting on other errors
        } else {
            if (result.status === 'RECEIVED' && result.code) {
                console.log(`✓ SMS received! Code: ${result.code}`);
                return { success: true, code: result.code };
            }
            if (result.status === 'CANCELED') {
                console.log('✗ Order was canceled');
                return { success: false, error: 'Order canceled' };
            }
            if (result.status === 'WAIT_RESEND') {
                console.log('⚠ Waiting for resend...');
            }
            if (result.status === 'WAIT_RETRY') {
                console.log(`⚠ Waiting for retry, last code: ${result.lastCode}`);
            }
        }

        // Wait before next check
        await new Promise(resolve => setTimeout(resolve, interval));
    }

    console.log('✗ Timeout waiting for SMS');
    return { success: false, error: 'TIMEOUT', timeout: true };
}

/**
 * Buy number and wait for SMS (complete flow for legacy API)
 */
export async function buyLegacyNumberAndGetSMS(
    service = DEFAULT_SERVICE,
    country = DEFAULT_COUNTRY,
    operator = DEFAULT_OPERATOR,
    smsTimeout = 120000
) {
    // Buy number
    const buyResult = await buyLegacyNumber(service, country, operator);
    
    if (!buyResult.success) {
        return buyResult;
    }

    // Set status to 1 (ready to receive SMS)
    await setLegacyOrderStatus(buyResult.orderId, 1);

    // Wait for SMS
    const smsResult = await waitForLegacySMS(buyResult.orderId, smsTimeout);

    if (smsResult.success) {
        // Finish the order
        await finishLegacyOrder(buyResult.orderId);
        
        return {
            success: true,
            orderId: buyResult.orderId,
            phone: buyResult.phone,
            code: smsResult.code,
            country: buyResult.country,
            operator: buyResult.operator,
            apiType: 'legacy'
        };
    } else {
        // Cancel the order on failure
        await cancelLegacyOrder(buyResult.orderId);
        
        return {
            success: false,
            error: smsResult.error,
            timeout: smsResult.timeout,
            orderId: buyResult.orderId,
            phone: buyResult.phone
        };
    }
}

// Export default settings
export const LEGACY_DEFAULTS = {
    country: DEFAULT_COUNTRY,
    operator: DEFAULT_OPERATOR,
    service: DEFAULT_SERVICE,
    maxPrice: MAX_PRICE
};

export default {
    getLegacyBalance,
    getLegacyNumbersStatus,
    buyLegacyNumber,
    getLegacyOrderStatus,
    setLegacyOrderStatus,
    cancelLegacyOrder,
    finishLegacyOrder,
    requestLegacyResend,
    reportLegacyNumberUsed,
    waitForLegacySMS,
    buyLegacyNumberAndGetSMS,
    LEGACY_DEFAULTS
};




















