/**
 * SMS Provider Wrapper
 * اختيار مزود خدمة الأرقام من .env
 * 
 * Supported providers:
 * - 'sms-verification' (default) - SMS Verification API
 * - 'fivesim-legacy' - 5SIM Legacy API (api1.5sim.net)
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Get provider from .env (default: 'sms-verification')
const SMS_PROVIDER = (process.env.SMS_PROVIDER || 'sms-verification').toLowerCase().trim();

// Lazy load providers
let smsProvider = null;
let providerLoaded = false;

async function loadProvider() {
    if (providerLoaded) return smsProvider;
    
    if (SMS_PROVIDER === 'fivesim-legacy' || SMS_PROVIDER === '5sim-legacy') {
        // Use 5SIM Legacy API
        const legacyApi = await import('../fivesim-api-legacy.js');
        
        // Map country codes to 5SIM Legacy country names
        const countryCodeToName = {
            0: 'russia', 1: 'ukraine', 2: 'kazakhstan', 3: 'china', 4: 'philippines',
            6: 'indonesia', 7: 'malaysia', 8: 'kenya', 9: 'tanzania', 10: 'vietnam',
            11: 'kyrgyzstan', 12: 'usa', 13: 'israel', 14: 'hongkong', 15: 'poland',
            16: 'england', 17: 'madagascar', 18: 'congo', 19: 'nigeria', 20: 'macau',
            21: 'egypt', 22: 'india', 23: 'ireland', 25: 'laos', 26: 'haiti',
            27: 'ivorycoast', 28: 'gambia', 29: 'serbia', 31: 'southafrica',
            32: 'romania', 33: 'colombia', 34: 'estonia', 35: 'azerbaijan',
            36: 'canada', 37: 'morocco', 38: 'ghana', 39: 'argentina', 40: 'uzbekistan',
            41: 'cameroon', 42: 'chad', 43: 'germany', 44: 'lithuania', 45: 'croatia',
            46: 'sweden', 48: 'netherlands', 49: 'latvia', 50: 'austria', 51: 'belarus',
            52: 'thailand', 53: 'saudiarabia', 54: 'mexico', 55: 'taiwan', 56: 'spain',
            58: 'algeria', 59: 'slovenia', 60: 'bangladesh', 61: 'senegal', 62: 'turkey',
            63: 'czech', 64: 'srilanka', 65: 'peru', 66: 'pakistan', 67: 'newzealand',
            70: 'venezuela', 71: 'ethiopia', 72: 'mongolia', 73: 'brazil', 74: 'afghanistan',
            75: 'uganda', 76: 'angola', 77: 'cyprus', 78: 'france', 80: 'mozambique',
            81: 'nepal', 82: 'belgium', 83: 'bulgaria', 84: 'hungary', 85: 'moldova',
            86: 'italy', 87: 'paraguay', 88: 'honduras', 89: 'tunisia', 90: 'nicaragua',
            91: 'easttimor', 92: 'bolivia', 93: 'costarica', 94: 'guatemala', 95: 'uae',
            96: 'zimbabwe', 97: 'puertorico', 99: 'togo', 100: 'kuwait', 101: 'salvador',
            103: 'jamaica', 104: 'tit', 105: 'ecuador', 107: 'oman', 108: 'bih',
            109: 'dominicana', 112: 'panama', 114: 'mauritania', 115: 'sierraleone',
            116: 'jordan', 117: 'portugal', 118: 'barbados', 119: 'burundi', 120: 'benin',
            123: 'botswana', 128: 'georgia', 129: 'greece', 130: 'guineabissau',
            131: 'guyana', 134: 'saintkittsandnevis', 135: 'liberia', 136: 'lesotho',
            137: 'malawi', 138: 'namibia', 140: 'rwanda', 141: 'slovakia', 142: 'suriname',
            143: 'tajikistan', 145: 'bahrain', 146: 'reunion', 147: 'zambia', 148: 'armenia',
            152: 'burkinafaso', 154: 'gabon', 155: 'albania', 156: 'uruguay', 157: 'mauritius',
            158: 'bhutane', 159: 'maldives', 161: 'turkmenistan', 162: 'frenchguiana',
            163: 'finland', 164: 'saintlucia', 165: 'luxembourg', 166: 'saintvincentandgrenadines',
            169: 'antiguaandbarbuda', 173: 'switzerland', 174: 'norway', 175: 'australia',
            179: 'aruba', 181: 'anguilla', 183: 'northmacedonia', 185: 'newcaledonia',
            186: 'capeverde'
        };
        
        // Wrapper to convert country code to name and orderId to id
        // Use .env defaults if country/operator not provided
        const buyNumberWrapper = async (service, country, operator, options) => {
            // Use .env defaults if not provided
            const finalService = service || process.env.FIVESIM_SERVICE || 'go';
            let finalCountry = country;
            let finalOperator = operator;
            
            // If country not provided, use .env default
            if (!finalCountry) {
                finalCountry = process.env.FIVESIM_COUNTRY || 'england';
            } else if (typeof finalCountry === 'number') {
                // Convert country code to name if it's a number
                finalCountry = countryCodeToName[finalCountry] || finalCountry.toString();
            }
            
            // If operator not provided or is 'any', use .env default
            if (!finalOperator || finalOperator === 'any') {
                finalOperator = process.env.FIVESIM_OPERATOR || 'any';
            }
            
            console.log(`[5SIM Legacy] Using: service=${finalService}, country=${finalCountry}, operator=${finalOperator}`);
            
            const result = await legacyApi.buyLegacyNumber(finalService, finalCountry, finalOperator);
            
            // Check for NO_NUMBERS error and throw exception
            // التحقق من خطأ عدم توفر أرقام ورمي استثناء
            if (result && !result.success) {
                if (result.noNumbers || result.error === 'NO_NUMBERS') {
                    throw new Error(`No numbers available for country: ${finalCountry}, operator: ${finalOperator}. Try changing FIVESIM_OPERATOR to 'any' in .env`);
                }
                throw new Error(result.error || 'Failed to buy number from 5SIM Legacy API');
            }
            
            if (result && result.success && result.orderId) {
                // Convert orderId to id for compatibility with existing code
                return {
                    ...result,
                    id: result.orderId,
                    orderId: result.orderId // Keep both for compatibility
                };
            }
            return result;
        };
        
        smsProvider = {
            // Balance
            getBalance: legacyApi.getLegacyBalance,
            
            // Buy number (with compatibility wrapper)
            buyNumber: buyNumberWrapper,
            buyNumberAndGetSMS: async (service, country, operator, options) => {
                // Use .env defaults if not provided
                const finalService = service || process.env.FIVESIM_SERVICE || 'go';
                let finalCountry = country;
                let finalOperator = operator;
                
                // If country not provided, use .env default
                if (!finalCountry) {
                    finalCountry = process.env.FIVESIM_COUNTRY || 'england';
                } else if (typeof finalCountry === 'number') {
                    // Convert country code to name if it's a number
                    finalCountry = countryCodeToName[finalCountry] || finalCountry.toString();
                }
                
                // If operator not provided, use .env default or 'any'
                if (!finalOperator || finalOperator === 'any') {
                    finalOperator = process.env.FIVESIM_OPERATOR || 'any';
                }
                
                const result = await legacyApi.buyLegacyNumberAndGetSMS(finalService, finalCountry, finalOperator, options);
                
                // Check for NO_NUMBERS error and throw exception
                // التحقق من خطأ عدم توفر أرقام ورمي استثناء
                if (result && !result.success) {
                    if (result.noNumbers || result.error === 'NO_NUMBERS') {
                        throw new Error(`No numbers available for country: ${finalCountry}, operator: ${finalOperator}. Try changing FIVESIM_OPERATOR to 'any' in .env`);
                    }
                    throw new Error(result.error || 'Failed to buy number from 5SIM Legacy API');
                }
                
                if (result && result.success && result.orderId) {
                    return {
                        ...result,
                        id: result.orderId,
                        orderId: result.orderId
                    };
                }
                return result;
            },
            
            // Order status
            getOrderStatus: legacyApi.getLegacyOrderStatus,
            waitForSMS: legacyApi.waitForLegacySMS,
            
            // Order management
            cancelOrder: legacyApi.cancelLegacyOrder,
            finishOrder: legacyApi.finishLegacyOrder,
            requestResend: legacyApi.requestLegacyResend,
            reportNumberUsed: legacyApi.reportLegacyNumberUsed,
            
            // Status codes
            setOrderStatus: legacyApi.setLegacyOrderStatus,
            
            // Service name for compatibility
            serviceName: '5SIM Legacy',
            providerType: 'fivesim-legacy'
        };
        
        console.log('📱 Using SMS Provider: 5SIM Legacy API (api1.5sim.net)');
    } else {
        // Use SMS Verification API (default)
        const smsVerifyApi = await import('../sms-verification-api.js');
        smsProvider = {
            // Balance
            getBalance: smsVerifyApi.getSmsVerifyBalance,
            
            // Buy number
            buyNumber: smsVerifyApi.buySmsVerifyNumber,
            buyNumberAndGetSMS: smsVerifyApi.buyNumberAndGetSMS,
            
            // Order status
            getOrderStatus: smsVerifyApi.getSmsVerifyStatus,
            waitForSMS: smsVerifyApi.waitForSmsVerifyCode,
            
            // Order management
            cancelOrder: smsVerifyApi.cancelSmsVerifyOrder,
            finishOrder: smsVerifyApi.finishSmsVerifyOrder,
            requestResend: smsVerifyApi.resendSmsVerifyCode,
            reportNumberUsed: null, // Not available in SMS Verify API
            
            // Service name for compatibility
            serviceName: 'SMS Verification',
            providerType: 'sms-verification'
        };
        
        console.log('📱 Using SMS Provider: SMS Verification API');
    }
    
    providerLoaded = true;
    return smsProvider;
}

// Export unified interface with lazy loading
export const getBalance = async (...args) => {
    const provider = await loadProvider();
    return provider.getBalance(...args);
};

export const buyNumber = async (...args) => {
    const provider = await loadProvider();
    return provider.buyNumber(...args);
};

export const buyNumberAndGetSMS = async (...args) => {
    const provider = await loadProvider();
    return provider.buyNumberAndGetSMS(...args);
};

export const getOrderStatus = async (...args) => {
    const provider = await loadProvider();
    return provider.getOrderStatus(...args);
};

export const waitForSMS = async (...args) => {
    const provider = await loadProvider();
    return provider.waitForSMS(...args);
};

export const cancelOrder = async (...args) => {
    const provider = await loadProvider();
    return provider.cancelOrder(...args);
};

export const finishOrder = async (...args) => {
    const provider = await loadProvider();
    return provider.finishOrder(...args);
};

export const requestResend = async (...args) => {
    const provider = await loadProvider();
    return provider.requestResend(...args);
};

export const reportNumberUsed = async (...args) => {
    const provider = await loadProvider();
    if (!provider.reportNumberUsed) return null;
    return provider.reportNumberUsed(...args);
};

export const setOrderStatus = async (...args) => {
    const provider = await loadProvider();
    return provider.setOrderStatus(...args);
};

export const getServiceName = async () => {
    const provider = await loadProvider();
    return provider.serviceName;
};

export const getProviderType = async () => {
    const provider = await loadProvider();
    return provider.providerType;
};

// Export provider info
export const SMS_PROVIDER_INFO = {
    current: SMS_PROVIDER
};

// For backward compatibility with existing code
export const buySmsVerifyNumber = buyNumber;
export const waitForSmsVerifyCode = waitForSMS;
export const cancelSmsVerifyOrder = cancelOrder;
export const finishSmsVerifyOrder = finishOrder;
export const getSmsVerifyStatus = getOrderStatus;
export const resendSmsVerifyCode = requestResend;

// Export country codes (from SMS Verify API for compatibility)
export { SMS_VERIFY_COUNTRIES } from '../sms-verification-api.js';

export default smsProvider;

