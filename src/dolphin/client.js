/**
 * Dolphin Anty API Client
 * عميل Dolphin Anty API
 */

import axios from 'axios';
import logger from '../utils/logger.js';
import { generateAndroidUserAgent } from '../gpmlogin/client.js';
import { generateAndroidFingerprint } from '../gpmlogin/client.js';
import config from '../config.js';

const DOLPHIN_API_URL = config.dolphin.apiUrl;
const DOLPHIN_API_KEY = config.dolphin.apiKey;

// Helper function to format Authorization header
// دالة مساعدة لتنسيق رأس Authorization
function getAuthHeader() {
    // Check if API key is empty
    // التحقق من أن API key ليس فارغاً
    if (!DOLPHIN_API_KEY || DOLPHIN_API_KEY.trim() === '') {
        throw new Error('DOLPHIN_API_KEY is not set. Please set it in .env file');
    }
    
    // Check if API key already has Bearer prefix
    // التحقق من أن API key يحتوي على Bearer prefix
    if (DOLPHIN_API_KEY.startsWith('Bearer ')) {
        return DOLPHIN_API_KEY;
    }
    
    // For Local API, try without Bearer first (as it worked in list-dolphin-folders.js)
    // لـ Local API، جرب بدون Bearer أولاً (كما عمل في list-dolphin-folders.js)
    return DOLPHIN_API_KEY;
}

/**
 * Check if Dolphin API is available and responding
 * التحقق من أن Dolphin API متاح ويستجيب
 */
export async function checkDolphinConnection() {
    try {
        const response = await axios.post(`${DOLPHIN_API_URL}/api/profile/getProfiles`, 
            { page: 1, pageSize: 1 },
            {
                headers: {
                    'Authorization': getAuthHeader(),
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            }
        );
        logger.info('Dolphin Anty API is connected and responding');
        return true;
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            logger.error('Dolphin Anty API is not running or not accessible', {
                url: DOLPHIN_API_URL,
                suggestion: 'Please make sure Dolphin Anty is running or check DOLPHIN_API_URL'
            });
        } else if (error.code === 'ETIMEDOUT') {
            logger.error('Dolphin Anty API connection timeout', { url: DOLPHIN_API_URL });
        } else if (error.response?.status === 401) {
            logger.error('Dolphin Anty API authentication failed', {
                hint: 'Please check your DOLPHIN_API_KEY in .env file'
            });
        } else {
            logger.error('Dolphin Anty API Error', { error: error.message });
        }
        return false;
    }
}

/**
 * Create a new profile in Dolphin Anty
 * إنشاء بروفايل جديد في Dolphin Anty
 */
export async function createProfile(profileName, proxy = null) {
    try {
        const timestamp = Date.now();
        const randomNum = Math.floor(Math.random() * 10000);
        let finalName = `Gmail_${timestamp}_${randomNum}`;
        
        // Clean name
        finalName = finalName.replace(/[^a-zA-Z0-9_]/g, '_');
        finalName = finalName.substring(0, 50);
        
        if (!finalName || finalName.trim().length === 0) {
            finalName = `Gmail_${timestamp}`;
        }
        
        // Generate realistic Android User-Agent
        const userAgent = generateAndroidUserAgent();
        
        // Generate unique Android fingerprint for this profile
        const fingerprint = generateAndroidFingerprint();
        
        logger.info('Generated Android fingerprint for Dolphin', {
            userAgent: userAgent.substring(0, 60) + '...',
            resolution: fingerprint.resolution,
            language: fingerprint.language,
            hardwareConcurrency: fingerprint.hardwareConcurrency,
            deviceMemory: fingerprint.deviceMemory,
            timezone: fingerprint.timezone,
            dpr: fingerprint.dpr
        });
        
        // Extract device model from User-Agent for uamodel field
        const uaMatch = userAgent.match(/Android \d+; ([^)]+)/);
        const uamodel = uaMatch ? uaMatch[1] : null;
        
        // Parse resolution width and height
        const [width, height] = fingerprint.resolution.split('x').map(Number);
        
        // Generate random realistic WebGL configuration (Real hardware GPUs)
        // توليد إعدادات WebGL عشوائية واقعية (GPUs حقيقية)
        const webglConfigs = [
            { manufacturer: 'Qualcomm', renderer: 'Adreno (TM) 650' },
            { manufacturer: 'Qualcomm', renderer: 'Adreno (TM) 730' },
            { manufacturer: 'Qualcomm', renderer: 'Adreno (TM) 740' },
            { manufacturer: 'Qualcomm', renderer: 'Adreno (TM) 660' },
            { manufacturer: 'ARM', renderer: 'Mali-G78' },
            { manufacturer: 'ARM', renderer: 'Mali-G710' },
            { manufacturer: 'ARM', renderer: 'Mali-G77' },
            { manufacturer: 'Samsung', renderer: 'Xclipse 920' },
            { manufacturer: 'Samsung', renderer: 'Xclipse 930' },
        ];
        const selectedWebgl = webglConfigs[Math.floor(Math.random() * webglConfigs.length)];
        
        // Generate random resolution (common Android resolutions)
        // توليد دقة عشوائية (دقات Android شائعة)
        const resolutions = [
            { res: '360x720', dpr: 2.0 },
            { res: '360x740', dpr: 2.0 },
            { res: '360x780', dpr: 2.0 },
            { res: '360x800', dpr: 2.0 },
            { res: '412x732', dpr: 2.625 },
            { res: '412x869', dpr: 2.625 },
            { res: '412x892', dpr: 2.625 },
            { res: '393x873', dpr: 2.75 },
            { res: '384x854', dpr: 2.0 },
        ];
        const selectedResolution = resolutions[Math.floor(Math.random() * resolutions.length)];
        
        // Generate random Android device and User-Agent
        // توليد جهاز Android و User-Agent عشوائي
        const androidDevices = [
            { model: 'SM-S938U', build: 'BP2A.250605.031.A3', android: 16 },
            { model: 'SM-G998B', build: 'SP1A.210812.016', android: 14 },
            { model: 'SM-S928B', build: 'UP1A.231005.007', android: 14 },
            { model: 'Pixel 8 Pro', build: 'AP2A.240805.005', android: 15 },
            { model: 'Pixel 9', build: 'AP3A.241005.015', android: 15 },
            { model: 'SM-A546B', build: 'UP1A.231005.007', android: 14 },
            { model: 'OnePlus 12', build: 'TP1A.220624.014', android: 14 },
        ];
        const selectedDevice = androidDevices[Math.floor(Math.random() * androidDevices.length)];
        
        // Generate random Chrome version
        const chromeVersions = ['141.0.7390.54', '141.0.7390.111', '142.0.7444.138', '140.0.7259.132'];
        const selectedChromeVersion = chromeVersions[Math.floor(Math.random() * chromeVersions.length)];
        const chromeMajor = selectedChromeVersion.split('.')[0];
        
        // Build random User-Agent
        const randomUserAgent = `Mozilla/5.0 (Linux; Android ${selectedDevice.android}; ${selectedDevice.model} Build/${selectedDevice.build}; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/${selectedChromeVersion} Safari/537.36`;
        
        // Generate random hardware concurrency (4-8 cores)
        const hardwareConcurrency = 4 + Math.floor(Math.random() * 5); // 4-8
        
        // Build fingerprint object for Dolphin API - with random realistic values
        // بناء كائن fingerprint لـ Dolphin API - بقيم عشوائية واقعية
        const fingerprintObj = {
            // OS and Browser Settings
            // إعدادات النظام والمتصفح
            os: 'Linux armv81', // Android
            osVersion: selectedDevice.android.toString(), // Random Android version
            product: 'chrome', // Browser product
            coreVersion: chromeMajor, // Chrome major version
            uaFullVersion: selectedChromeVersion, // Full UA version
            userAgent: randomUserAgent, // Random User-Agent
            
            // Profile Size: 500 x 950
            // حجم البروفايل: 500 x 950
            openWidth: 500,
            openHeight: 950,
            
            // Resolution: Random from common Android resolutions
            // الدقة: عشوائية من دقات Android الشائعة
            resolution: selectedResolution.res,
            devicePixelRatio: selectedResolution.dpr,
            
            // Language: Based on proxy IP
            // اللغة: بناءً على IP البروكسي
            languageFollowIp: true, // Generate language based on IP
            uiLanguageType: 2, // 2 = Follow system
            
            // Timezone: Based on proxy IP
            // المنطقة الزمنية: بناءً على IP البروكسي
            timeZoneFollowIp: true, // Generate timezone based on IP
            
            // Fonts: Random (masks font fingerprint)
            // الخطوط: عشوائية (تخفي بصمة الخط)
            randomFonts: true,
            
            // Hardware noise - all enabled for better anti-detection
            // ضوضاء الأجهزة - جميعها مفعلة لمكافحة الاكتشاف
            canvasNoise: true, // Prevents canvas fingerprinting
            webglNoise: true, // Prevents WebGL fingerprinting
            audioContextNoise: true, // Prevents audio fingerprinting
            clientRectsNoise: true, // Prevents element positioning fingerprinting
            mediaDeviceNoise: true, // Masks media device IDs
            speechVoiceNoise: true, // Masks speech synthesis voices
            
            // WebGL meta: Real hardware GPU (not SwiftShader!)
            // WebGL meta: GPU حقيقي (ليس SwiftShader!)
            webGLMeta: true,
            webGLManufacturer: selectedWebgl.manufacturer,
            webGLRender: selectedWebgl.renderer,
            
            // WebRTC: Replace (privacy mode - prevents IP leakage)
            // WebRTC: استبدال (وضع الخصوصية - يمنع تسريب IP)
            webRTC: 'replace', // replace = Replace mode
            
            // Geolocation: Based on proxy IP (better than Ask me!)
            // الموقع الجغرافي: بناءً على IP البروكسي (أفضل من Ask me!)
            geolocation: 2, // 2 = Based on proxy IP (not 1 = ask)
            geolocationFollowIp: true, // Generate geolocation based on IP
            
            // Hardware concurrency: Random (4-8 cores)
            // عدد المعالجات: عشوائي (4-8 أنوية)
            hardwareConcurrency: hardwareConcurrency,
            
            // Do not track: Disabled (more human-like)
            // عدم التتبع: معطل (أكثر شبهاً بالإنسان)
            doNotTrack: false,
            
            // Port Scan Protection: Enabled
            // حماية من مسح المنافذ: مفعل
            portScanProtection: true,
            
            // HTTPS certificate errors: Ignore (Disabled)
            // أخطاء شهادة HTTPS: تجاهل (معطل)
            ignoreHttpsErrors: false
        };
        
        logger.info('Generated random fingerprint for Dolphin', {
            device: selectedDevice.model,
            android: selectedDevice.android,
            chrome: chromeMajor,
            resolution: selectedResolution.res,
            webgl: `${selectedWebgl.manufacturer} - ${selectedWebgl.renderer}`,
            cores: hardwareConcurrency
        });
        
        // Build proxy object if provided
        // Dolphin API uses proxyMethod: 0 for base proxy
        // According to API example, proxy format uses: protocol, host, port, proxyUsername, proxyPassword
        // بناء كائن البروكسي إذا تم توفيره
        // Dolphin API يستخدم proxyMethod: 0 للبروكسي الأساسي
        let proxyObj = null;
        if (proxy && proxy.ip && proxy.port) {
            const proxyType = (proxy.type || 'http').toLowerCase();
            const username = (proxy.username || proxy.proxyUsername || '').trim();
            const password = (proxy.password || proxy.proxyPassword || '').trim();
            
            proxyObj = {
                proxyMethod: 0, // 0 = base proxy (recommended)
                protocol: proxyType === 'socks5' ? 'socks5' : (proxyType === 'socks4' ? 'socks4' : 'http'),
                host: proxy.ip.trim(),
                port: parseInt(proxy.port, 10),
                proxyUsername: username,
                proxyPassword: password
            };
            
            // Validate port
            if (isNaN(proxyObj.port) || proxyObj.port <= 0 || proxyObj.port > 65535) {
                throw new Error(`Invalid proxy port: ${proxy.port}`);
            }
            
            logger.info('Creating Dolphin profile with base proxy (proxyMethod: 0)', {
                proxy: `${proxyObj.host}:${proxyObj.port}`,
                protocol: proxyObj.protocol,
                hasAuth: !!(username && password),
                usernameLength: username.length,
                passwordLength: password.length
            });
        }
     
        // Get or create folder
        // الحصول على مجلد أو إنشاؤه
        let folderId = config.dolphin.folderId;
        
        // If folder ID is set, validate it exists
        // إذا تم تحديد folder ID، تحقق من وجوده
        if (folderId && folderId.toString().trim() !== '') {
            logger.info('Folder ID provided in config, will use it', { folderId: folderId.toString() });
        } else {
            // If folder ID is not set or is empty, get or create default folder
            // إذا لم يتم تحديد folder ID أو كان فارغاً، احصل على مجلد افتراضي أو أنشئه
            const defaultFolderName = 'gmail-accounts'; // Default folder name in English
            logger.info('Folder ID not set, getting or creating default folder', { folderName: defaultFolderName });
            try {
                folderId = await getOrCreateFolder(defaultFolderName, '#3370FF');
            } catch (folderError) {
                logger.warn('Failed to get or create folder, trying to use first available folder', { 
                    error: folderError.message 
                });
                // Fallback: use first available folder
                try {
                    folderId = await getFirstAvailableFolder();
                    if (!folderId) {
                        throw new Error('No folders available');
                    }
                } catch (fallbackError) {
                    throw new Error('No folders available. Please create a folder manually in Dolphin Anty or set a valid DOLPHIN_FOLDER_ID in .emv file.');
                }
            }
        }
        
        // Validate folder ID
        if (!folderId || folderId.toString().trim() === '') {
            throw new Error('Folder ID is required but not set. Please set DOLPHIN_FOLDER_ID in .emv file or create a folder in Dolphin Anty.');
        }
        
        logger.info('Using folder ID for profile creation', { folderId: folderId.toString() });
        
        // Build request body
        const requestBody = {
            title: finalName,
            folderId: folderId.toString(), // Ensure it's a string
            fingerprint: fingerprintObj
        };
        
        if (proxyObj) {
            requestBody.proxy = proxyObj;
        }
        
        logger.info('Creating Dolphin Anty profile', { 
            name: finalName, 
            userAgent: userAgent.substring(0, 50) + '...',
            folderId: folderId.toString(),
            hasProxy: !!proxyObj,
            apiUrl: DOLPHIN_API_URL
        });
        
        const authHeader = getAuthHeader();
        logger.debug('API Request details', {
            url: `${DOLPHIN_API_URL}/api/profile/advancedCreateProfile`,
            hasAuthHeader: !!authHeader,
            authHeaderLength: authHeader ? authHeader.length : 0
        });
        
        const response = await axios.post(`${DOLPHIN_API_URL}/api/profile/advancedCreateProfile`, requestBody, {
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });
        
        let responseData = response.data;
        if (typeof responseData === 'string') {
            try {
                responseData = JSON.parse(responseData);
            } catch (e) {
                throw new Error(`Failed to parse response: ${responseData}`);
            }
        }
        
        if (responseData && responseData.id) {
            logger.info('Dolphin Anty profile created successfully', { 
                profileId: responseData.id,
                name: responseData.title || finalName
            });
            return { 
                id: responseData.id,
                profileId: responseData.id,
                title: responseData.title || finalName,
                userAgent: userAgent
            };
        }
        
        throw new Error(`Invalid response from Dolphin API: ${JSON.stringify(responseData)}`);
    } catch (error) {
        if (error.response) {
            logger.error('Dolphin Anty API Error Response', {
                status: error.response.status,
                data: error.response.data
            });
            let errorMsg = 'Unknown error';
            const errorData = error.response.data;
            if (typeof errorData === 'string') {
                try {
                    const parsed = JSON.parse(errorData);
                    errorMsg = parsed.message || errorData;
                } catch (e) {
                    errorMsg = errorData;
                }
            } else if (errorData && errorData.message) {
                errorMsg = errorData.message;
            }
            
            // Provide helpful error messages for common issues
            // تقديم رسائل خطأ مفيدة للمشاكل الشائعة
            if (error.response.status === 400 && (errorMsg.includes('permission') || errorMsg.includes('50200'))) {
                const helpfulMsg = `Insufficient permissions. Possible solutions:
1. Check if your API key has the required permissions in Dolphin Anty settings
2. Verify that Dolphin Anty is running and accessible at ${DOLPHIN_API_URL}
3. Make sure the folder ID exists and you have access to it
4. Try generating a new API key from Dolphin Anty panel with full permissions`;
                throw new Error(`Dolphin Anty API Error: ${error.response.status} - ${errorMsg}\n\n${helpfulMsg}`);
            }
            
            throw new Error(`Dolphin Anty API Error: ${error.response.status} - ${errorMsg}`);
        }
        logger.error('Error creating Dolphin Anty profile', { error: error.message });
        throw error;
    }
}

/**
 * Start a profile by ID
 * بدء بروفايل بالمعرف
 */
export async function startProfile(profileId) {
    try {
        logger.info('Starting Dolphin Anty profile', { profileId });
        
        const response = await axios.post(`${DOLPHIN_API_URL}/api/browser/openBrowser`, 
            { profileId },
            {
                headers: {
                    'Authorization': getAuthHeader(),
                    'Content-Type': 'application/json'
                },
                timeout: 60000 // 60 seconds timeout for browser launch
            }
        );
        
        let responseData = response.data;
        if (typeof responseData === 'string') {
            try {
                responseData = JSON.parse(responseData);
            } catch (e) {
                throw new Error(`Failed to parse response: ${responseData}`);
            }
        }
        
        if (responseData && responseData.ws) {
            logger.info('Dolphin Anty profile started successfully', { 
                profileId,
                ws: responseData.ws,
                port: responseData.port
            });
            return {
                ws: responseData.ws,
                webSocketDebuggerUrl: responseData.ws,
                port: responseData.port,
                pid: responseData.pid
            };
        }
        
        throw new Error(`Invalid response from Dolphin API: ${JSON.stringify(responseData)}`);
    } catch (error) {
        if (error.response) {
            logger.error('Dolphin Anty API Error Response', {
                status: error.response.status,
                data: error.response.data
            });
            let errorMsg = 'Unknown error';
            const errorData = error.response.data;
            if (typeof errorData === 'string') {
                try {
                    const parsed = JSON.parse(errorData);
                    errorMsg = parsed.message || errorData;
                } catch (e) {
                    errorMsg = errorData;
                }
            } else if (errorData && errorData.message) {
                errorMsg = errorData.message;
            }
            throw new Error(`Dolphin Anty API Error: ${error.response.status} - ${errorMsg}`);
        }
        logger.error('Error starting Dolphin Anty profile', { error: error.message });
        throw error;
    }
}

/**
 * Stop a profile by ID
 * إيقاف بروفايل بالمعرف
 */
export async function stopProfile(profileId) {
    try {
        logger.info('Stopping Dolphin Anty profile', { profileId });
        
        const response = await axios.post(`${DOLPHIN_API_URL}/api/browser/closeProfiles`,
            { profileIds: [profileId] },
            {
                headers: {
                    'Authorization': getAuthHeader(),
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            }
        );
        
        logger.info('Dolphin Anty profile stopped successfully', { profileId });
        return true;
    } catch (error) {
        logger.warn('Error stopping Dolphin Anty profile', { 
            profileId,
            error: error.message 
        });
        return false;
    }
}

/**
 * Delete a profile by ID
 * حذف بروفايل بالمعرف
 */
export async function deleteProfile(profileId) {
    try {
        logger.info('Deleting Dolphin Anty profile', { profileId });
        
        const response = await axios.post(`${DOLPHIN_API_URL}/api/profile/delete`,
            { profileIds: [profileId] },
            {
                headers: {
                    'Authorization': getAuthHeader(),
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            }
        );
        
        logger.info('Dolphin Anty profile deleted successfully', { profileId });
        return true;
    } catch (error) {
        logger.error('Error deleting Dolphin Anty profile', { 
            profileId,
            error: error.message 
        });
        throw error;
    }
}

/**
 * Get profile details by ID
 * الحصول على تفاصيل البروفايل بالمعرف
 */
export async function getProfile(profileId) {
    try {
        const response = await axios.post(`${DOLPHIN_API_URL}/api/profile/detail`,
            { profileId },
            {
                headers: {
                    'Authorization': getAuthHeader(),
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            }
        );
        
        return response.data;
    } catch (error) {
        logger.error('Error getting Dolphin Anty profile', { 
            profileId,
            error: error.message 
        });
        throw error;
    }
}

/**
 * Update profile's base proxy
 * تحديث البروكسي الأساسي للبروفايل
 * @param {string|string[]} profileIds - Profile ID or array of profile IDs
 * @param {Object} proxy - Proxy configuration object
 * @param {string} proxy.host - Proxy host/IP
 * @param {number} proxy.port - Proxy port
 * @param {string} proxy.protocol - Proxy protocol (http, https, socks5, ssh)
 * @param {string} proxy.username - Proxy username (optional)
 * @param {string} proxy.password - Proxy password (optional)
 */
export async function updateProfileProxy(profileIds, proxy) {
    try {
        // Ensure profileIds is an array
        const ids = Array.isArray(profileIds) ? profileIds : [profileIds];
        
        if (!proxy || !proxy.host || !proxy.port) {
            throw new Error('Proxy host and port are required');
        }
        
        const proxyType = (proxy.protocol || proxy.type || 'http').toLowerCase();
        
        const requestBody = {
            host: proxy.host || proxy.ip,
            port: parseInt(proxy.port, 10),
            protocol: proxyType === 'socks5' ? 'socks5' : (proxyType === 'socks4' ? 'socks4' : (proxyType === 'https' ? 'https' : 'http')),
            proxyMethod: 0, // 0 = base proxy
            proxyUsername: proxy.username || proxy.proxyUsername || '',
            proxyPassword: proxy.password || proxy.proxyPassword || '',
            ids: ids
        };
        
        logger.info('Updating profile proxy', {
            profileIds: ids,
            proxy: `${requestBody.host}:${requestBody.port}`,
            protocol: requestBody.protocol
        });
        
        const response = await axios.post(`${DOLPHIN_API_URL}/api/profile/updateProfileBaseProxy`, 
            requestBody,
            {
                headers: {
                    'Authorization': getAuthHeader(),
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            }
        );
        
        let responseData = response.data;
        if (typeof responseData === 'string') {
            try {
                responseData = JSON.parse(responseData);
            } catch (e) {
                // Response might be empty or non-JSON on success
            }
        }
        
        logger.info('Profile proxy updated successfully', {
            profileIds: ids,
            proxy: `${requestBody.host}:${requestBody.port}`
        });
        
        return {
            success: true,
            profileIds: ids,
            proxy: {
                host: requestBody.host,
                port: requestBody.port,
                protocol: requestBody.protocol
            }
        };
    } catch (error) {
        if (error.response) {
            logger.error('Dolphin Anty API Error updating proxy', {
                status: error.response.status,
                data: error.response.data
            });
            
            let errorMsg = 'Unknown error';
            const errorData = error.response.data;
            if (typeof errorData === 'string') {
                try {
                    const parsed = JSON.parse(errorData);
                    errorMsg = parsed.message || errorData;
                } catch (e) {
                    errorMsg = errorData;
                }
            } else if (errorData && errorData.message) {
                errorMsg = errorData.message;
            }
            
            throw new Error(`Dolphin Anty API Error: ${error.response.status} - ${errorMsg}`);
        }
        logger.error('Error updating profile proxy', { error: error.message });
        throw error;
    }
}

/**
 * Get folder list
 * الحصول على قائمة المجلدات
 */
export async function getFolderList(page = 1, pageSize = 100) {
    try {
        // Try different authorization formats
        // جرب تنسيقات مختلفة للتفويض
        const authFormats = [
            DOLPHIN_API_KEY, // Without Bearer
            `Bearer ${DOLPHIN_API_KEY}`, // With Bearer
        ];

        let lastError = null;
        for (const authFormat of authFormats) {
            try {
                const response = await axios.post(`${DOLPHIN_API_URL}/api/folder/list`, 
                    { page, pageSize },
                    {
                        headers: {
                            'Authorization': authFormat,
                            'Content-Type': 'application/json'
                        },
                        timeout: 10000
                    }
                );
                
                let responseData = response.data;
                if (typeof responseData === 'string') {
                    try {
                        responseData = JSON.parse(responseData);
                    } catch (e) {
                        throw new Error(`Failed to parse response: ${responseData}`);
                    }
                }
                
                return responseData;
            } catch (error) {
                lastError = error;
                // If 401, try next format; otherwise throw
                if (error.response && error.response.status === 401) {
                    continue;
                }
                throw error;
            }
        }
        
        // If all formats failed with 401
        throw lastError || new Error('Failed to authenticate with Dolphin API');
    } catch (error) {
        logger.error('Error getting folder list', { error: error.message });
        throw error;
    }
}

/**
 * Get all folders (across all pages)
 * الحصول على جميع المجلدات (من جميع الصفحات)
 */
export async function getAllFolders() {
    try {
        const allFolders = [];
        let page = 1;
        const pageSize = 100;
        let hasMore = true;

        while (hasMore) {
            const responseData = await getFolderList(page, pageSize);
            
            // Handle different response formats
            let folders = [];
            if (responseData && responseData.list && Array.isArray(responseData.list)) {
                folders = responseData.list;
            } else if (responseData && responseData.data && Array.isArray(responseData.data)) {
                folders = responseData.data;
            } else if (Array.isArray(responseData)) {
                folders = responseData;
            } else if (responseData && responseData.folders && Array.isArray(responseData.folders)) {
                folders = responseData.folders;
            }

            if (folders.length > 0) {
                allFolders.push(...folders);
                
                const total = responseData.total || folders.length;
                
                if (folders.length < pageSize || allFolders.length >= total) {
                    hasMore = false;
                } else {
                    page++;
                }
            } else {
                hasMore = false;
            }
        }

        return allFolders;
    } catch (error) {
        logger.error('Error getting all folders', { error: error.message });
        throw error;
    }
}

/**
 * Find folder by name
 * البحث عن مجلد بالاسم
 */
export async function findFolderByName(folderName) {
    try {
        const folders = await getFolderList(1, 100);
        
        // Search in all pages if needed
        // Check both 'folderName' and 'name' fields (API may use either)
        if (folders && folders.data && Array.isArray(folders.data)) {
            const found = folders.data.find(folder => 
                (folder.folderName && folder.folderName === folderName) ||
                (folder.name && folder.name === folderName)
            );
            if (found) {
                return found.id;
            }
        }
        
        // Search in additional pages if there are more
        if (folders && folders.total > 100) {
            const totalPages = Math.ceil(folders.total / 100);
            for (let page = 2; page <= totalPages; page++) {
                const pageFolders = await getFolderList(page, 100);
                if (pageFolders && pageFolders.data && Array.isArray(pageFolders.data)) {
                    const found = pageFolders.data.find(folder => 
                        (folder.folderName && folder.folderName === folderName) ||
                        (folder.name && folder.name === folderName)
                    );
                    if (found) {
                        return found.id;
                    }
                }
            }
        }
        
        return null;
    } catch (error) {
        logger.error('Error finding folder by name', { error: error.message });
        throw error;
    }
}

/**
 * Create a new folder
 * إنشاء مجلد جديد
 */
export async function createFolder(folderName, folderColor = '#3370FF', sortOrder = 0) {
    try {
        logger.info('Creating Dolphin folder', { folderName, folderColor });
        
        const response = await axios.post(`${DOLPHIN_API_URL}/api/folder/add`, 
            { 
                folderName,
                folderColor,
                sortOrder
            },
            {
                headers: {
                    'Authorization': getAuthHeader(),
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            }
        );
        
        let responseData = response.data;
        if (typeof responseData === 'string') {
            try {
                responseData = JSON.parse(responseData);
            } catch (e) {
                throw new Error(`Failed to parse response: ${responseData}`);
            }
        }
        
        if (responseData && responseData.id) {
            logger.info('Dolphin folder created successfully', { 
                folderId: responseData.id,
                folderName: responseData.folderName || folderName
            });
            return responseData.id;
        }
        
        throw new Error(`Invalid response from Dolphin API: ${JSON.stringify(responseData)}`);
    } catch (error) {
        if (error.response) {
            const errorData = error.response.data;
            let errorMsg = 'Unknown error';
            
            if (typeof errorData === 'string') {
                try {
                    const parsed = JSON.parse(errorData);
                    errorMsg = parsed.message || errorData;
                } catch (e) {
                    errorMsg = errorData;
                }
            } else if (errorData && errorData.message) {
                errorMsg = errorData.message;
            }
            
            // Check if folder already exists
            if (errorMsg.includes('already exists') || error.response.status === 400) {
                logger.warn('Folder might already exist, trying to find it', { folderName });
                const existingFolderId = await findFolderByName(folderName);
                if (existingFolderId) {
                    logger.info('Found existing folder', { folderName, folderId: existingFolderId });
                    return existingFolderId;
                }
            }
            
            throw new Error(`Dolphin Anty API Error: ${error.response.status} - ${errorMsg}`);
        }
        logger.error('Error creating Dolphin folder', { error: error.message });
        throw error;
    }
}

/**
 * Get first available folder from list
 * الحصول على أول مجلد متاح من القائمة
 */
export async function getFirstAvailableFolder() {
    try {
        const folders = await getFolderList(1, 100);
        
        if (folders && folders.data && Array.isArray(folders.data) && folders.data.length > 0) {
            const firstFolder = folders.data[0];
            const folderId = firstFolder.id || firstFolder.folderId;
            const folderName = firstFolder.folderName || firstFolder.name;
            
            if (folderId) {
                logger.info('Using first available folder', { 
                    folderName: folderName,
                    folderId: folderId 
                });
                return folderId;
            }
        }
        
        return null;
    } catch (error) {
        logger.error('Error getting first available folder', { error: error.message });
        throw error;
    }
}

/**
 * Get or create folder by name
 * الحصول على مجلد بالاسم أو استخدام أول مجلد متاح
 */
export async function getOrCreateFolder(folderName, folderColor = '#3370FF') {
    try {
        // Try to find existing folder
        const existingFolderId = await findFolderByName(folderName);
        if (existingFolderId) {
            logger.info('Found existing folder', { folderName, folderId: existingFolderId });
            return existingFolderId;
        }
        
        // Try to create new folder
        try {
            logger.info('Folder not found, attempting to create new folder', { folderName });
            const newFolderId = await createFolder(folderName, folderColor);
            return newFolderId;
        } catch (createError) {
            // If creation fails due to permissions, use first available folder
            if (createError.message && (createError.message.includes('permission') || createError.message.includes('50200'))) {
                logger.warn('Cannot create folder due to insufficient permissions, using first available folder instead', { 
                    error: createError.message 
                });
                const firstFolderId = await getFirstAvailableFolder();
                if (firstFolderId) {
                    logger.info('Using first available folder as fallback', { folderId: firstFolderId });
                    return firstFolderId;
                }
                throw new Error('No folders available and cannot create new folder. Please create a folder manually in Dolphin Anty.');
            }
            throw createError;
        }
    } catch (error) {
        logger.error('Error getting or creating folder', { error: error.message });
        throw error;
    }
}

export default {
    checkDolphinConnection,
    createProfile,
    startProfile,
    stopProfile,
    deleteProfile,
    getProfile,
    updateProfileProxy,
    getFolderList,
    getAllFolders,
    findFolderByName,
    createFolder,
    getOrCreateFolder,
    getFirstAvailableFolder
};

