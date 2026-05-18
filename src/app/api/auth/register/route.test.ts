import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import prisma from '../../../../lib/prisma'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

// Mock prisma
vi.mock('../../../../lib/prisma', () => ({
    default: {
        user: {
            findFirst: vi.fn(),
            create: vi.fn(),
        },
    },
}))

// Mock bcrypt
vi.mock('bcryptjs', () => ({
    default: {
        hash: vi.fn(),
    },
}))

// Mock jwt
vi.mock('jsonwebtoken', () => ({
    default: {
        sign: vi.fn(),
    },
}))

describe('POST /api/auth/register', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should return 400 if required fields are missing', async () => {
        const req = new Request('http://localhost/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email: 'test@example.com' }), // missing username and password
        })

        const response = await POST(req)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toBe('Missing required fields')
    })

    it('should return 409 if user with email/username already exists', async () => {
        vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'existing-id' } as any)

        const req = new Request('http://localhost/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                username: 'testuser',
                email: 'test@example.com',
                password: 'password123'
            }),
        })

        const response = await POST(req)
        const data = await response.json()

        expect(response.status).toBe(409)
        expect(data.error).toBe('User already exists')
    })

    it('should return 201 and a token on successful registration', async () => {
        vi.mocked(prisma.user.findFirst).mockResolvedValue(null)
        vi.mocked(bcrypt.hash).mockResolvedValue('hashed_pw' as any)
        const mockUser = {
            id: 'new-user-id',
            username: 'testuser',
            email: 'test@example.com'
        }
        vi.mocked(prisma.user.create).mockResolvedValue(mockUser as any)
        vi.mocked(jwt.sign).mockReturnValue('mock-token' as any)

        const req = new Request('http://localhost/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                username: 'testuser',
                email: 'test@example.com',
                password: 'password123'
            }),
        })

        const response = await POST(req)
        const data = await response.json()

        expect(response.status).toBe(201)
        expect(data.token).toBe('mock-token')
        expect(data.user.username).toBe('testuser')
        expect(prisma.user.create).toHaveBeenCalledWith({
            data: {
                username: 'testuser',
                email: 'test@example.com',
                password_hash: 'hashed_pw',
                status: 'online'
            }
        })
    })

    it('should return 500 if an internal error occurs', async () => {
        vi.mocked(prisma.user.findFirst).mockRejectedValue(new Error('DB error'))

        const req = new Request('http://localhost/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                username: 'testuser',
                email: 'test@example.com',
                password: 'password123'
            }),
        })

        const response = await POST(req)
        const data = await response.json()

        expect(response.status).toBe(500)
        expect(data.error).toBe('Internal server error')
    })
})
