import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'
import prisma from '../../../../lib/prisma'
import jwt from 'jsonwebtoken'
import { NextRequest } from 'next/server'

// Mock prisma
vi.mock('../../../../lib/prisma', () => ({
    default: {
        user: {
            findUnique: vi.fn(),
        },
    },
}))

// Mock jwt
vi.mock('jsonwebtoken', () => ({
    default: {
        verify: vi.fn(),
    },
}))

describe('GET /api/auth/me', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should return 401 if authorization header is missing', async () => {
        const req = new NextRequest('http://localhost/api/auth/me')

        const response = await GET(req)
        const data = await response.json()

        expect(response.status).toBe(401)
        expect(data.error).toBe('Unauthorized')
    })

    it('should return 401 if token is invalid', async () => {
        vi.mocked(jwt.verify).mockImplementation(() => {
            throw new Error('Invalid token')
        })

        const req = new NextRequest('http://localhost/api/auth/me', {
            headers: { authorization: 'Bearer invalid-token' }
        })

        const response = await GET(req)
        const data = await response.json()

        expect(response.status).toBe(401)
        expect(data.error).toBe('Invalid or expired token')
    })

    it('should return 404 if user is not found', async () => {
        vi.mocked(jwt.verify).mockReturnValue({ userId: 'user-1' } as any)
        vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

        const req = new NextRequest('http://localhost/api/auth/me', {
            headers: { authorization: 'Bearer valid-token' }
        })

        const response = await GET(req)
        const data = await response.json()

        expect(response.status).toBe(404)
        expect(data.error).toBe('User not found')
    })

    it('should return 200 and user data if token is valid', async () => {
        const mockUser = {
            id: 'user-1',
            username: 'testuser',
            email: 'test@example.com',
            password_hash: 'hashed_pw'
        }
        vi.mocked(jwt.verify).mockReturnValue({ userId: 'user-1' } as any)
        vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)

        const req = new NextRequest('http://localhost/api/auth/me', {
            headers: { authorization: 'Bearer valid-token' }
        })

        const response = await GET(req)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.user.id).toBe('user-1')
        expect(data.user.password_hash).toBeUndefined()
    })
})
