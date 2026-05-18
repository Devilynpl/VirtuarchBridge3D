import { NextRequest, NextResponse } from 'next/server';
import { POST } from './route';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
    default: {
        activationCode: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        user: {
            update: vi.fn(),
        },
        $transaction: vi.fn((callback) => callback(prisma)),
    },
}));

vi.mock('@/lib/auth', () => ({
    verifyAuth: vi.fn(),
}));

describe('POST /api/auth/activate', () => {
    let mockReq: { json: Mock };

    beforeEach(() => {
        vi.clearAllMocks();
        mockReq = {
            json: vi.fn(),
        };
    });

    it('should return 401 if unauthorized', async () => {
        vi.mocked(verifyAuth).mockResolvedValue(null);
        const res = await POST(mockReq as unknown as NextRequest);
        expect(res.status).toBe(401);
    });

    it('should return 400 if code is missing', async () => {
        vi.mocked(verifyAuth).mockResolvedValue({ userId: 'user-1', is_active: false } as any);
        mockReq.json.mockResolvedValue({});
        const res = await POST(mockReq as unknown as NextRequest);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toBe('Missing activation code');
    });

    it('should return 404 if code is invalid', async () => {
        vi.mocked(verifyAuth).mockResolvedValue({ userId: 'user-1', is_active: false } as any);
        mockReq.json.mockResolvedValue({ code: 'INVALID' });
        vi.mocked(prisma.activationCode.findUnique).mockResolvedValue(null);

        const res = await POST(mockReq as unknown as NextRequest);
        expect(res.status).toBe(404);
        const data = await res.json();
        expect(data.error).toBe('Invalid activation code');
    });

    it('should return 400 if code is already used', async () => {
        vi.mocked(verifyAuth).mockResolvedValue({ userId: 'user-1', is_active: false } as any);
        mockReq.json.mockResolvedValue({ code: 'USED' });
        vi.mocked(prisma.activationCode.findUnique).mockResolvedValue({
            id: 'code-1',
            code: 'USED',
            is_used: true,
            user_id: 'other-user',
        } as any);

        const res = await POST(mockReq as unknown as NextRequest);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toBe('Activation code already used');
    });

    it('should activate user and return success', async () => {
        const userId = 'user-1';
        const code = 'VALID-CODE';
        vi.mocked(verifyAuth).mockResolvedValue({ userId, is_active: false } as any);
        mockReq.json.mockResolvedValue({ code });
        vi.mocked(prisma.activationCode.findUnique).mockResolvedValue({
            id: 'code-1',
            code,
            is_used: false,
        } as any);

        // Mock transaction
        (prisma as any).$transaction = vi.fn(async (callback) => callback(prisma));

        const res = await POST(mockReq as unknown as NextRequest);
        expect(res.status).toBe(200);

        expect(prisma.activationCode.update).toHaveBeenCalledWith({
            where: { id: 'code-1' },
            data: {
                is_used: true,
                used_at: expect.any(Date),
                user_id: userId,
            },
        });

        expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: userId },
            data: { is_active: true },
        });

        const data = await res.json();
        expect(data.success).toBe(true);
    });
});
