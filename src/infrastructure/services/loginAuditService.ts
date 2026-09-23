/**
 * loginAuditService.ts
 *
 * Records every login attempt (success + failure) for admin and teacher portals.
 * Captures: IP address, geolocation, device info, browser, OS, timestamp.
 * Stores events in Firebase Firestore → 'loginAudit' collection.
 */

import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, deleteDoc, doc, where } from 'firebase/firestore';

export interface LoginAuditEntry {
    id?: string;
    timestamp: number;           // Unix ms
    role: 'admin' | 'teacher';
    username: string;
    name: string;
    success: boolean;
    failReason?: string;         // e.g. "Wrong password", "Unknown user"
    ipAddress: string;
    userAgent: string;
    deviceType: 'mobile' | 'desktop' | 'tablet';
    browser: string;
    os: string;
    country?: string;
    city?: string;
    isp?: string;
    isSuspicious: boolean;
    suspicionReasons?: string[]; // e.g. ["Failed login", "Foreign IP"]
}

// ─── IP & Geolocation ────────────────────────────────────────────────────────

async function getPublicIP(): Promise<string> {
    try {
        const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(4000) });
        const data = await res.json();
        return data.ip || 'Unknown';
    } catch {
        try {
            const res2 = await fetch('https://api4.my-ip.io/ip.json', { signal: AbortSignal.timeout(4000) });
            const data2 = await res2.json();
            return data2.ip || 'Unknown';
        } catch {
            return 'Unknown';
        }
    }
}

interface GeoInfo {
    country: string;
    city: string;
    isp: string;
}

async function getGeoInfo(ip: string): Promise<GeoInfo> {
    if (!ip || ip === 'Unknown') return { country: 'Unknown', city: 'Unknown', isp: 'Unknown' };
    try {
        // ip-api.com: free, 45 req/min, no API key required
        const res = await fetch(`http://ip-api.com/json/${ip}?fields=country,city,isp,status`, {
            signal: AbortSignal.timeout(5000)
        });
        const data = await res.json();
        if (data.status === 'success') {
            return {
                country: data.country || 'Unknown',
                city: data.city || 'Unknown',
                isp: data.isp || 'Unknown'
            };
        }
        return { country: 'Unknown', city: 'Unknown', isp: 'Unknown' };
    } catch {
        return { country: 'Unknown', city: 'Unknown', isp: 'Unknown' };
    }
}

// ─── Device / Browser / OS Parsing ───────────────────────────────────────────

function parseUserAgent(ua: string): { deviceType: 'mobile' | 'desktop' | 'tablet'; browser: string; os: string } {
    // Device type
    let deviceType: 'mobile' | 'desktop' | 'tablet' = 'desktop';
    if (/tablet|ipad|playbook|silk/i.test(ua)) {
        deviceType = 'tablet';
    } else if (/mobile|android|iphone|ipod|blackberry|windows phone/i.test(ua)) {
        deviceType = 'mobile';
    }

    // OS
    let os = 'Unknown OS';
    if (/windows nt 10/i.test(ua)) os = 'Windows 10/11';
    else if (/windows nt 6\.3/i.test(ua)) os = 'Windows 8.1';
    else if (/windows nt 6\.1/i.test(ua)) os = 'Windows 7';
    else if (/windows/i.test(ua)) os = 'Windows';
    else if (/android/i.test(ua)) {
        const m = ua.match(/android ([0-9.]+)/i);
        os = m ? `Android ${m[1]}` : 'Android';
    } else if (/iphone|ipad|ipod/i.test(ua)) {
        const m = ua.match(/os ([0-9_]+)/i);
        os = m ? `iOS ${m[1].replace(/_/g, '.')}` : 'iOS';
    } else if (/mac os x/i.test(ua)) {
        const m = ua.match(/mac os x ([0-9_]+)/i);
        os = m ? `macOS ${m[1].replace(/_/g, '.')}` : 'macOS';
    } else if (/linux/i.test(ua)) os = 'Linux';
    else if (/ubuntu/i.test(ua)) os = 'Ubuntu';

    // Browser
    let browser = 'Unknown Browser';
    if (/edg\//i.test(ua)) {
        const m = ua.match(/edg\/([0-9.]+)/i);
        browser = m ? `Edge ${m[1].split('.')[0]}` : 'Edge';
    } else if (/opr\//i.test(ua) || /opera/i.test(ua)) {
        browser = 'Opera';
    } else if (/chrome\/([0-9.]+)/i.test(ua) && !/chromium/i.test(ua)) {
        const m = ua.match(/chrome\/([0-9.]+)/i);
        browser = m ? `Chrome ${m[1].split('.')[0]}` : 'Chrome';
    } else if (/firefox\/([0-9.]+)/i.test(ua)) {
        const m = ua.match(/firefox\/([0-9.]+)/i);
        browser = m ? `Firefox ${m[1].split('.')[0]}` : 'Firefox';
    } else if (/safari\/([0-9.]+)/i.test(ua)) {
        const m = ua.match(/version\/([0-9.]+)/i);
        browser = m ? `Safari ${m[1].split('.')[0]}` : 'Safari';
    } else if (/samsungbrowser/i.test(ua)) {
        browser = 'Samsung Browser';
    } else if (/miuibrowser/i.test(ua)) {
        browser = 'MIUI Browser';
    }

    return { deviceType, browser, os };
}

// ─── Suspicious Detection ─────────────────────────────────────────────────────

function detectSuspicion(
    success: boolean,
    country: string
): { isSuspicious: boolean; reasons: string[] } {
    const reasons: string[] = [];

    if (!success) {
        reasons.push('Failed login attempt');
    }

    // Flag if country is not India
    if (country && country !== 'Unknown' && country.toLowerCase() !== 'india') {
        reasons.push(`Foreign IP: ${country}`);
    }

    return { isSuspicious: reasons.length > 0, reasons };
}

// ─── Main Service Class ───────────────────────────────────────────────────────

class LoginAuditService {
    private readonly COLLECTION = 'loginAudit';
    private db: ReturnType<typeof getFirestore> | null = null;

    private getDb() {
        if (!this.db) {
            this.db = getFirestore();
        }
        return this.db;
    }

    /**
     * Record a login attempt. Non-blocking — never throws or blocks the UI.
     */
    async recordLogin(params: {
        role: 'admin' | 'teacher';
        username: string;
        name: string;
        success: boolean;
        failReason?: string;
    }): Promise<void> {
        try {
            const [ip, uaInfo] = await Promise.all([
                getPublicIP(),
                Promise.resolve(parseUserAgent(navigator.userAgent))
            ]);

            let geo: GeoInfo = { country: 'Unknown', city: 'Unknown', isp: 'Unknown' };
            try {
                geo = await getGeoInfo(ip);
            } catch {
                // silent
            }

            const { isSuspicious, reasons } = detectSuspicion(params.success, geo.country);

            const entry: Omit<LoginAuditEntry, 'id'> = {
                timestamp: Date.now(),
                role: params.role,
                username: params.username,
                name: params.name,
                success: params.success,
                failReason: params.failReason,
                ipAddress: ip,
                userAgent: navigator.userAgent,
                deviceType: uaInfo.deviceType,
                browser: uaInfo.browser,
                os: uaInfo.os,
                country: geo.country,
                city: geo.city,
                isp: geo.isp,
                isSuspicious,
                suspicionReasons: reasons.length > 0 ? reasons : undefined,
            };

            const db = this.getDb();
            await addDoc(collection(db, this.COLLECTION), entry);
        } catch (err) {
            // Never crash the login flow due to audit failure
            console.warn('[LoginAudit] Failed to record login event:', err);
        }
    }

    /**
     * Fetch all login audit logs, newest first.
     */
    async getLogs(limitCount = 500): Promise<LoginAuditEntry[]> {
        try {
            const db = this.getDb();
            const q = query(
                collection(db, this.COLLECTION),
                orderBy('timestamp', 'desc'),
                limit(limitCount)
            );
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ id: d.id, ...d.data() } as LoginAuditEntry));
        } catch (err) {
            console.error('[LoginAudit] Failed to fetch logs:', err);
            return [];
        }
    }

    /**
     * Delete ALL login audit logs.
     */
    async clearAllLogs(): Promise<void> {
        const db = this.getDb();
        const snap = await getDocs(collection(db, this.COLLECTION));
        await Promise.all(snap.docs.map(d => deleteDoc(doc(db, this.COLLECTION, d.id))));
    }

    /**
     * Delete logs older than N days. Returns count deleted.
     */
    async clearOldLogs(days = 90): Promise<number> {
        const db = this.getDb();
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        const q = query(collection(db, this.COLLECTION), where('timestamp', '<', cutoff));
        const snap = await getDocs(q);
        await Promise.all(snap.docs.map(d => deleteDoc(doc(db, this.COLLECTION, d.id))));
        return snap.docs.length;
    }
}

export const loginAuditService = new LoginAuditService();
