import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import prisma from '../../../../lib/prisma'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

// Mock prisma
vi.mock('../../../../lib/prisma', () => ({
    default: {
        user: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
    },
}))

// Mock bcrypt
vi.mock('bcryptjs', () => ({
    default: {
        compare: vi.fn(),
    },
}))

// Mock jwt
vi.mock('jsonwebtoken', () => ({
    default: {
        sign: vi.fn(),
    },
}))

describe('POST /api/auth/login', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should return 400 if email or password is missing', async () => {
        const req = new Request('http://localhost/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email: 'test@example.com' }), // missing password
        })

        const response = await POST(req)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toBe('Missing required fields')
    })

    it('should return 401 if user is not found', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

        const req = new Request('http://localhost/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email: 'nonexistent@example.com', password: 'password123' }),
        })

        const response = await POST(req)
        const data = await response.json()

        expect(response.status).toBe(401)
        expect(data.error).toBe('Invalid credentials')
    })

    it('should return 401 if password is invalid', async () => {
        const mockUser = { id: 'user-1', email: 'test@example.com', password_hash: 'hashed_pw' }
        vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
        vi.mocked(bcrypt.compare as any).mockResolvedValue(false)

        const req = new Request('http://localhost/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email: 'test@example.com', password: 'wrongpassword' }),
        })

        const response = await POST(req)
        const data = await response.json()

        expect(response.status).toBe(401)
        expect(data.error).toBe('Invalid credentials')
    })

    it('should return 200 and a token on successful login', async () => {
        const mockUser = {
            id: 'user-1',
            email: 'test@example.com',
            username: 'testuser',
            password_hash: 'hashed_pw'
        }
        vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
        vi.mocked(bcrypt.compare as any).mockResolvedValue(true)
        vi.mocked(jwt.sign).mockReturnValue('mock-token' as any)
        vi.mocked(prisma.user.update).mockResolvedValue({} as any)

        const req = new Request('http://localhost/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email: 'test@example.com', password: 'correctpassword' }),
        })

        const response = await POST(req)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.token).toBe('mock-token')
        expect(data.user.id).toBe('user-1')
        expect(data.user.password_hash).toBeUndefined()

        // Check if status was updated
        expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: 'user-1' },
            data: expect.objectContaining({ status: 'online' })
        })
    })

    it('should return 500 if an internal error occurs', async () => {
        vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error('DB connection failed'))

        const req = new Request('http://localhost/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
        })

        const response = await POST(req)
        const data = await response.json()

        expect(response.status).toBe(500)
        expect(data.error).toBe('Internal server error')
    })
})
