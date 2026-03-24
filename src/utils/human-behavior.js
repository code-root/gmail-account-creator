/**
 * Human Behavior Simulation Module
 * وحدة محاكاة السلوك البشري
 * 
 * This module provides functions to simulate natural human behavior
 * including mouse movements, scrolling, typing, and clicking.
 * توفر هذه الوحدة دوال لمحاكاة السلوك البشري الطبيعي
 * بما في ذلك حركة الماوس، التمرير، الكتابة، والنقر.
 */

import logger from './logger.js';

// Random delay generators
// مولدات التأخير العشوائي

/**
 * Generate random delay between min and max milliseconds
 * توليد تأخير عشوائي بين الحد الأدنى والأقصى بالمللي ثانية
 */
export function randomDelay(min = 100, max = 300) {
    return Math.floor(min + Math.random() * (max - min));
}

/**
 * Generate human-like delay based on action type
 * توليد تأخير بشري بناءً على نوع الإجراء
 */
export function getHumanDelay(actionType = 'default') {
    const delays = {
        'beforeClick': { min: 200, max: 600 },
        'afterClick': { min: 300, max: 800 },
        'beforeType': { min: 150, max: 400 },
        'afterType': { min: 200, max: 500 },
        'betweenActions': { min: 500, max: 1500 },
        'pageLoad': { min: 1000, max: 3000 },
        'thinking': { min: 1500, max: 4000 },
        'reading': { min: 2000, max: 5000 },
        'shortPause': { min: 100, max: 300 },
        'default': { min: 200, max: 500 }
    };
    
    const { min, max } = delays[actionType] || delays.default;
    return randomDelay(min, max);
}

/**
 * Sleep for a specified duration with optional variance
 * النوم لمدة محددة مع تباين اختياري
 */
export async function humanSleep(baseMs, variancePercent = 30) {
    const variance = (baseMs * variancePercent) / 100;
    const actualMs = baseMs + (Math.random() * variance * 2) - variance;
    await new Promise(resolve => setTimeout(resolve, Math.max(50, actualMs)));
}

// Bezier curve for natural mouse movement
// منحنى بيزير لحركة الماوس الطبيعية

/**
 * Calculate point on quadratic bezier curve
 * حساب نقطة على منحنى بيزير التربيعي
 */
function bezierPoint(t, p0, p1, p2) {
    const u = 1 - t;
    return u * u * p0 + 2 * u * t * p1 + t * t * p2;
}

/**
 * Calculate point on cubic bezier curve
 * حساب نقطة على منحنى بيزير المكعب
 */
function cubicBezierPoint(t, p0, p1, p2, p3) {
    const u = 1 - t;
    return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

/**
 * Generate natural mouse path using bezier curves
 * توليد مسار ماوس طبيعي باستخدام منحنيات بيزير
 */
export function generateMousePath(startX, startY, endX, endY, steps = 25) {
    const points = [];
    
    // Add slight randomness to control points for natural curve
    // إضافة عشوائية طفيفة لنقاط التحكم للمنحنى الطبيعي
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    
    // Random control point offset (20-40% of distance)
    const offsetX = (endX - startX) * (0.2 + Math.random() * 0.2) * (Math.random() > 0.5 ? 1 : -1);
    const offsetY = (endY - startY) * (0.2 + Math.random() * 0.2) * (Math.random() > 0.5 ? 1 : -1);
    
    const cp1x = midX + offsetX;
    const cp1y = midY + offsetY;
    
    // Second control point for more natural curve
    const cp2x = midX - offsetX * 0.5;
    const cp2y = midY - offsetY * 0.5;
    
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        
        // Use cubic bezier for smoother movement
        const x = cubicBezierPoint(t, startX, cp1x, cp2x, endX);
        const y = cubicBezierPoint(t, startY, cp1y, cp2y, endY);
        
        // Add micro-jitter for realism (human hands aren't perfectly steady)
        const jitterX = (Math.random() - 0.5) * 2;
        const jitterY = (Math.random() - 0.5) * 2;
        
        points.push({
            x: Math.round(x + jitterX),
            y: Math.round(y + jitterY)
        });
    }
    
    return points;
}

/**
 * Move mouse naturally to coordinates
 * تحريك الماوس بشكل طبيعي إلى الإحداثيات
 */
export async function humanMouseMove(page, targetX, targetY, options = {}) {
    const {
        steps = 20 + Math.floor(Math.random() * 15),
        baseDelay = 5,
        startFromCurrent = true
    } = options;
    
    try {
        // Get current mouse position or use default
        let startX = 100 + Math.random() * 200;
        let startY = 100 + Math.random() * 200;
        
        if (startFromCurrent) {
            try {
                const currentPos = await page.evaluate(() => {
                    return { x: window.mouseX || 0, y: window.mouseY || 0 };
                });
                if (currentPos.x > 0 || currentPos.y > 0) {
                    startX = currentPos.x;
                    startY = currentPos.y;
                }
            } catch (e) {
                // Use default start position
            }
        }
        
        const path = generateMousePath(startX, startY, targetX, targetY, steps);
        
        for (let i = 0; i < path.length; i++) {
            const point = path[i];
            await page.mouse.move(point.x, point.y);
            
            // Variable delay - slower at start and end (like real mouse movement)
            const progress = i / path.length;
            let delay = baseDelay;
            
            if (progress < 0.2 || progress > 0.8) {
                delay = baseDelay * (1.5 + Math.random() * 0.5); // Slower at edges
            } else {
                delay = baseDelay * (0.8 + Math.random() * 0.4); // Faster in middle
            }
            
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        // Save current position for next move
        await page.evaluate((x, y) => {
            window.mouseX = x;
            window.mouseY = y;
        }, targetX, targetY);
        
        logger.debug('Human mouse move completed', { targetX, targetY, steps });
    } catch (error) {
        logger.warn('Error in human mouse move, using direct move', { error: error.message });
        await page.mouse.move(targetX, targetY);
    }
}

/**
 * Get element center coordinates
 * الحصول على إحداثيات مركز العنصر
 */
export async function getElementCenter(page, element) {
    try {
        const box = await element.boundingBox();
        if (!box) return null;
        
        // Add slight randomness to click position (not always center)
        const offsetX = (Math.random() - 0.5) * box.width * 0.3;
        const offsetY = (Math.random() - 0.5) * box.height * 0.3;
        
        return {
            x: box.x + box.width / 2 + offsetX,
            y: box.y + box.height / 2 + offsetY
        };
    } catch (error) {
        logger.warn('Error getting element center', { error: error.message });
        return null;
    }
}

/**
 * Human-like click with mouse movement
 * نقر بشري مع حركة الماوس
 */
export async function humanClick(page, element, options = {}) {
    const {
        moveFirst = true,
        preClickDelay = true,
        postClickDelay = true,
        doubleClick = false
    } = options;
    
    try {
        const center = await getElementCenter(page, element);
        
        if (center && moveFirst) {
            // Move mouse to element naturally
            await humanMouseMove(page, center.x, center.y);
            
            // Pre-click delay (human hesitation)
            if (preClickDelay) {
                await humanSleep(getHumanDelay('beforeClick'));
            }
        }
        
        // Perform click
        if (doubleClick) {
            await element.click({ clickCount: 2 });
        } else {
            await element.click();
        }
        
        // Post-click delay
        if (postClickDelay) {
            await humanSleep(getHumanDelay('afterClick'));
        }
        
        logger.debug('Human click completed', { doubleClick });
        return true;
    } catch (error) {
        logger.warn('Human click failed, using direct click', { error: error.message });
        try {
            await element.click();
            return true;
        } catch (e) {
            return false;
        }
    }
}

/**
 * Human-like click at coordinates
 * نقر بشري عند الإحداثيات
 */
export async function humanClickAt(page, x, y, options = {}) {
    const {
        moveFirst = true,
        preClickDelay = true,
        postClickDelay = true
    } = options;
    
    try {
        if (moveFirst) {
            await humanMouseMove(page, x, y);
            
            if (preClickDelay) {
                await humanSleep(getHumanDelay('beforeClick'));
            }
        }
        
        await page.mouse.click(x, y);
        
        if (postClickDelay) {
            await humanSleep(getHumanDelay('afterClick'));
        }
        
        return true;
    } catch (error) {
        logger.warn('Human click at coordinates failed', { error: error.message, x, y });
        return false;
    }
}

// Scroll behavior
// سلوك التمرير

/**
 * Smooth scroll to position
 * تمرير سلس إلى موضع
 */
export async function humanScroll(page, options = {}) {
    const {
        direction = 'down',
        distance = 300 + Math.random() * 200,
        steps = 10 + Math.floor(Math.random() * 10),
        pauseChance = 0.3
    } = options;
    
    try {
        const scrollAmount = direction === 'down' ? distance : -distance;
        const stepDistance = scrollAmount / steps;
        
        for (let i = 0; i < steps; i++) {
            await page.evaluate((dist) => {
                window.scrollBy({
                    top: dist,
                    behavior: 'auto' // We control smoothness ourselves
                });
            }, stepDistance);
            
            // Variable delay between scroll steps
            const delay = 20 + Math.random() * 40;
            await new Promise(resolve => setTimeout(resolve, delay));
            
            // Occasional pause (like human reading)
            if (Math.random() < pauseChance && i > steps / 3 && i < steps * 2 / 3) {
                await humanSleep(500, 50);
            }
        }
        
        logger.debug('Human scroll completed', { direction, distance });
    } catch (error) {
        logger.warn('Human scroll failed', { error: error.message });
    }
}

/**
 * Scroll to element naturally
 * التمرير إلى عنصر بشكل طبيعي
 */
export async function humanScrollToElement(page, element, options = {}) {
    const {
        block = 'center',
        addRandomOffset = true
    } = options;
    
    try {
        // First, get element position
        const box = await element.boundingBox();
        if (!box) {
            // Fallback to JavaScript scrollIntoView
            await page.evaluate((el, blk) => {
                el.scrollIntoView({ behavior: 'smooth', block: blk });
            }, element, block);
            await humanSleep(500);
            return;
        }
        
        // Get viewport info
        const viewport = await page.evaluate(() => ({
            scrollY: window.scrollY,
            innerHeight: window.innerHeight,
            scrollHeight: document.documentElement.scrollHeight
        }));
        
        // Calculate target scroll position
        let targetScrollY = box.y + viewport.scrollY - viewport.innerHeight / 2;
        
        // Add random offset
        if (addRandomOffset) {
            targetScrollY += (Math.random() - 0.5) * 100;
        }
        
        // Clamp to valid range
        targetScrollY = Math.max(0, Math.min(targetScrollY, viewport.scrollHeight - viewport.innerHeight));
        
        // Calculate scroll distance
        const scrollDistance = targetScrollY - viewport.scrollY;
        const direction = scrollDistance > 0 ? 'down' : 'up';
        
        if (Math.abs(scrollDistance) > 50) {
            await humanScroll(page, {
                direction,
                distance: Math.abs(scrollDistance),
                steps: Math.min(30, Math.floor(Math.abs(scrollDistance) / 20))
            });
        }
        
        logger.debug('Human scroll to element completed');
    } catch (error) {
        logger.warn('Human scroll to element failed, using fallback', { error: error.message });
        try {
            await page.evaluate((el) => {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, element);
            await humanSleep(500);
        } catch (e) {
            // Ignore
        }
    }
}

/**
 * Random page exploration (scroll up and down to look natural)
 * استكشاف عشوائي للصفحة (التمرير لأعلى ولأسفل ليبدو طبيعياً)
 */
export async function explorePageRandomly(page, options = {}) {
    const {
        scrollCount = 2 + Math.floor(Math.random() * 3),
        minDelay = 500,
        maxDelay = 1500
    } = options;
    
    try {
        logger.debug('Starting random page exploration');
        
        for (let i = 0; i < scrollCount; i++) {
            const direction = Math.random() > 0.5 ? 'down' : 'up';
            const distance = 100 + Math.random() * 300;
            
            await humanScroll(page, { direction, distance });
            await humanSleep(randomDelay(minDelay, maxDelay));
        }
        
        logger.debug('Random page exploration completed');
    } catch (error) {
        logger.warn('Random page exploration failed', { error: error.message });
    }
}

// Enhanced typing with more human characteristics
// كتابة محسّنة بخصائص بشرية أكثر

/**
 * Human-like typing with natural variations
 * كتابة بشرية مع تغييرات طبيعية
 */
export async function humanType(page, element, text, options = {}) {
    const {
        minDelay = 30,
        maxDelay = 120,
        mistakeChance = 0.08,
        pauseChance = 0.12,
        burstTypingChance = 0.15,
        clearFirst = true
    } = options;
    
    try {
        logger.debug('Starting human-like typing', { textLength: text.length });
        
        // Focus and optional clear
        await element.focus();
        await humanSleep(100, 30);
        
        if (clearFirst) {
            try {
                await element.click({ clickCount: 3 });
                await humanSleep(50, 20);
                await page.keyboard.press('Delete');
                await humanSleep(50, 20);
                
                // Also clear via JavaScript
                await element.evaluate(el => {
                    el.value = '';
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                });
                await humanSleep(50);
            } catch (e) {
                // Continue anyway
            }
        }
        
        let burstMode = false;
        let burstCount = 0;
        
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            
            // Random burst typing (fast typing for a few characters)
            if (!burstMode && Math.random() < burstTypingChance) {
                burstMode = true;
                burstCount = 3 + Math.floor(Math.random() * 5);
            }
            
            if (burstMode) {
                burstCount--;
                if (burstCount <= 0) burstMode = false;
            }
            
            // Occasional mistake
            if (Math.random() < mistakeChance && i > 0 && i < text.length - 1 && !burstMode) {
                const wrongChars = 'abcdefghijklmnopqrstuvwxyz0123456789';
                const wrongChar = wrongChars[Math.floor(Math.random() * wrongChars.length)];
                await element.type(wrongChar, { delay: 30 + Math.random() * 30 });
                await humanSleep(80, 30);
                await page.keyboard.press('Backspace');
                await humanSleep(100, 40);
            }
            
            // Type character
            const delay = burstMode 
                ? minDelay * 0.5 + Math.random() * 20 
                : minDelay + Math.random() * (maxDelay - minDelay);
            
            await element.type(char, { delay });
            
            // Occasional pause
            if (Math.random() < pauseChance && !burstMode) {
                await humanSleep(200, 50);
            }
            
            // Longer pause after space or special chars
            if ((char === ' ' || char === '.' || char === '@') && !burstMode) {
                await humanSleep(100, 30);
            }
        }
        
        // Final pause
        await humanSleep(100, 40);
        
        // Verify input
        const enteredValue = await element.evaluate(el => el.value);
        if (enteredValue !== text) {
            logger.warn('Text mismatch, retrying', { expected: text, entered: enteredValue });
            await element.click({ clickCount: 3 });
            await page.keyboard.press('Delete');
            await humanSleep(100);
            await element.type(text, { delay: minDelay });
        }
        
        logger.debug('Human typing completed');
        return true;
    } catch (error) {
        logger.warn('Human typing failed, using fallback', { error: error.message });
        try {
            await element.focus();
            await element.click({ clickCount: 3 });
            await page.keyboard.press('Delete');
            await element.type(text, { delay: 50 });
            return true;
        } catch (e) {
            logger.error('Fallback typing also failed', { error: e.message });
            return false;
        }
    }
}

// Window and viewport interactions
// تفاعلات النافذة وإطار العرض

/**
 * Simulate random mouse movements on page (idle behavior)
 * محاكاة حركات الماوس العشوائية على الصفحة (سلوك الخمول)
 */
export async function idleMouseMovement(page, options = {}) {
    const {
        movements = 3 + Math.floor(Math.random() * 4),
        areaWidth = 400,
        areaHeight = 300
    } = options;
    
    try {
        // Get viewport dimensions
        const viewport = await page.evaluate(() => ({
            width: window.innerWidth,
            height: window.innerHeight
        }));
        
        for (let i = 0; i < movements; i++) {
            // Random position within safe area
            const x = 50 + Math.random() * Math.min(areaWidth, viewport.width - 100);
            const y = 100 + Math.random() * Math.min(areaHeight, viewport.height - 150);
            
            await humanMouseMove(page, x, y, { steps: 10 + Math.floor(Math.random() * 10) });
            await humanSleep(200, 50);
        }
        
        logger.debug('Idle mouse movement completed', { movements });
    } catch (error) {
        logger.warn('Idle mouse movement failed', { error: error.message });
    }
}

/**
 * Simulate reading behavior (scroll slowly, pause to read)
 * محاكاة سلوك القراءة (التمرير ببطء، التوقف للقراءة)
 */
export async function simulateReading(page, options = {}) {
    const {
        duration = 3000 + Math.random() * 3000,
        scrollWhileReading = true
    } = options;
    
    try {
        logger.debug('Starting reading simulation');
        
        const startTime = Date.now();
        
        while (Date.now() - startTime < duration) {
            // Random action: scroll or just wait
            const action = Math.random();
            
            if (action < 0.3 && scrollWhileReading) {
                // Small scroll
                await humanScroll(page, {
                    direction: 'down',
                    distance: 50 + Math.random() * 100,
                    steps: 5
                });
            } else if (action < 0.5) {
                // Idle mouse movement
                await idleMouseMovement(page, { movements: 1 });
            }
            
            // Wait (reading)
            await humanSleep(500, 30);
        }
        
        logger.debug('Reading simulation completed');
    } catch (error) {
        logger.warn('Reading simulation failed', { error: error.message });
    }
}

/**
 * Perform random human-like action
 * تنفيذ إجراء بشري عشوائي
 */
export async function performRandomAction(page) {
    const actions = [
        { weight: 40, action: 'scroll' },
        { weight: 30, action: 'mouseMove' },
        { weight: 20, action: 'pause' },
        { weight: 10, action: 'nothing' }
    ];
    
    // Weighted random selection
    const totalWeight = actions.reduce((sum, a) => sum + a.weight, 0);
    let random = Math.random() * totalWeight;
    let selectedAction = 'nothing';
    
    for (const action of actions) {
        random -= action.weight;
        if (random <= 0) {
            selectedAction = action.action;
            break;
        }
    }
    
    try {
        switch (selectedAction) {
            case 'scroll':
                await humanScroll(page, {
                    direction: Math.random() > 0.5 ? 'down' : 'up',
                    distance: 100 + Math.random() * 200,
                    steps: 5 + Math.floor(Math.random() * 5)
                });
                break;
                
            case 'mouseMove':
                await idleMouseMovement(page, { movements: 1 + Math.floor(Math.random() * 2) });
                break;
                
            case 'pause':
                await humanSleep(500, 50);
                break;
                
            default:
                // Do nothing
                break;
        }
        
        logger.debug('Random action completed', { action: selectedAction });
    } catch (error) {
        logger.warn('Random action failed', { error: error.message, action: selectedAction });
    }
}

/**
 * Wait with human-like behavior (not just sleeping)
 * الانتظار بسلوك بشري (ليس مجرد نوم)
 */
export async function humanWait(page, baseMs, options = {}) {
    const {
        doRandomActions = true,
        actionInterval = 1500
    } = options;
    
    const startTime = Date.now();
    const targetTime = startTime + baseMs + (Math.random() * baseMs * 0.3);
    
    while (Date.now() < targetTime) {
        if (doRandomActions && (Date.now() - startTime) > actionInterval) {
            await performRandomAction(page);
        } else {
            await humanSleep(Math.min(500, targetTime - Date.now()));
        }
    }
}

// Focus and blur simulation
// محاكاة التركيز وفقدان التركيز

/**
 * Simulate tab focus/blur (like user switching tabs)
 * محاكاة التركيز/فقدان التركيز (مثل تبديل المستخدم للتبويبات)
 */
export async function simulateTabSwitch(page, options = {}) {
    const {
        awayDuration = 1000 + Math.random() * 2000
    } = options;
    
    try {
        // Blur page
        await page.evaluate(() => {
            window.dispatchEvent(new Event('blur'));
            document.dispatchEvent(new Event('visibilitychange'));
        });
        
        await humanSleep(awayDuration);
        
        // Focus page again
        await page.evaluate(() => {
            window.dispatchEvent(new Event('focus'));
            document.dispatchEvent(new Event('visibilitychange'));
        });
        
        logger.debug('Tab switch simulation completed');
    } catch (error) {
        logger.warn('Tab switch simulation failed', { error: error.message });
    }
}

// Export all functions
export default {
    // Delays
    randomDelay,
    getHumanDelay,
    humanSleep,
    
    // Mouse
    generateMousePath,
    humanMouseMove,
    getElementCenter,
    humanClick,
    humanClickAt,
    idleMouseMovement,
    
    // Scroll
    humanScroll,
    humanScrollToElement,
    explorePageRandomly,
    
    // Typing
    humanType,
    
    // Behavior simulation
    simulateReading,
    performRandomAction,
    humanWait,
    simulateTabSwitch
};


