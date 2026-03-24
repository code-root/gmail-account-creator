/**
 * Proxy Manager
 * إدارة البروكسيات من ملف TXT
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROXIES_FILE = path.join(__dirname, '../../config/proxies.txt');

class ProxyManager {
    constructor() {
        this.proxies = [];
        this.usedProxies = new Set();
        this.loadProxies();
    }

    /**
     * Load proxies from file
     * تحميل البروكسيات من الملف
     */
    loadProxies() {
        try {
            if (!fs.existsSync(PROXIES_FILE)) {
                logger.warn('Proxies file not found, creating empty file');
                fs.writeFileSync(PROXIES_FILE, '# Proxy format: ip:port:username:password\n', 'utf8');
                return;
            }

            const content = fs.readFileSync(PROXIES_FILE, 'utf8');
            const lines = content.split('\n').map(line => line.trim()).filter(line => {
                // Skip empty lines and comments
                return line && !line.startsWith('#');
            });

            this.proxies = lines.map((line, index) => {
                const parts = line.split(':');
                if (parts.length >= 2) {
                    const proxy = {
                        ip: parts[0].trim(),
                        port: parts[1].trim(),
                        username: (parts[2] || '').trim(),
                        password: (parts[3] || '').trim(),
                        raw: line
                    };
                    
                    // Log proxy details (without password for security)
                    // تسجيل تفاصيل البروكسي (بدون كلمة المرور للأمان)
                    if (index === 0) { // Log first proxy as example
                        logger.info('Example proxy loaded', {
                            ip: proxy.ip,
                            port: proxy.port,
                            hasUsername: !!proxy.username,
                            hasPassword: !!proxy.password,
                            usernameLength: proxy.username.length,
                            passwordLength: proxy.password.length
                        });
                    }
                    
                    return proxy;
                }
                logger.warn('Invalid proxy format', { line, lineNumber: index + 1 });
                return null;
            }).filter(p => p !== null);

            logger.info(`Loaded ${this.proxies.length} proxies from file`);
        } catch (error) {
            logger.error('Error loading proxies', { error: error.message });
            this.proxies = [];
        }
    }

    /**
     * Get next available proxy
     * الحصول على بروكسي متاح
     */
    getNextProxy() {
        const available = this.proxies.filter(p => !this.usedProxies.has(p.raw));
        
        if (available.length === 0) {
            logger.warn('No available proxies, resetting used proxies');
            this.usedProxies.clear();
            return this.proxies[0] || null;
        }

        const proxy = available[Math.floor(Math.random() * available.length)];
        this.usedProxies.add(proxy.raw);
        return proxy;
    }

    /**
     * Mark proxy as used
     * تحديد البروكسي كمستخدم
     */
    markAsUsed(proxy) {
        if (proxy && proxy.raw) {
            this.usedProxies.add(proxy.raw);
        }
    }

    /**
     * Release proxy (mark as available)
     * تحرير البروكسي
     */
    releaseProxy(proxy) {
        if (proxy && proxy.raw) {
            this.usedProxies.delete(proxy.raw);
        }
    }

    /**
     * Get proxy in GPM Login format
     * الحصول على البروكسي بتنسيق GPM Login
     */
    getGPMLoginFormat(proxy) {
        if (!proxy) return null;

        return {
            ip: proxy.ip,
            port: proxy.port,
            username: proxy.username || '',
            password: proxy.password || '',
            type: 'http' // Default to HTTP
        };
    }

    /**
     * Get proxy in GoLogin format (legacy - kept for compatibility)
     * الحصول على البروكسي بتنسيق GoLogin (قديم - محفوظ للتوافق)
     */
    getGoLoginFormat(proxy) {
        return this.getGPMLoginFormat(proxy);
    }

    /**
     * Get proxy string format (ip:port:user:pass)
     * الحصول على البروكسي كسلسلة نصية
     */
    getStringFormat(proxy) {
        if (!proxy) return null;
        return proxy.raw;
    }

    /**
     * Get available count
     * عدد البروكسيات المتاحة
     */
    getAvailableCount() {
        return this.proxies.length - this.usedProxies.size;
    }

    /**
     * Reset all used proxies
     * إعادة تعيين جميع البروكسيات المستخدمة
     */
    reset() {
        this.usedProxies.clear();
        logger.info('All proxies reset');
    }
}

export default new ProxyManager();


