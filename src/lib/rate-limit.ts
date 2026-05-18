import { NextRequest, NextResponse } from "next/server";

const rateLimitMap = new Map<string, { count: number, lastReset: number }>();

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 20; // 20 requests per minute per IP

export function rateLimit(req: NextRequest) {
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    const now = Date.now();

    const record = rateLimitMap.get(ip) || { count: 0, lastReset: now };

    if (now - record.lastReset > WINDOW_MS) {
        record.count = 0;
        record.lastReset = now;
    }

    record.count += 1;
    rateLimitMap.set(ip, record);

    if (record.count > MAX_REQUESTS) {
        return true; // Rate limited
    }

    return false; // Allowed
}
