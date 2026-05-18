import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST, GET } from './route'
import prisma from '../../../lib/prisma'
import jwt from 'jsonwebtoken'
import { NextRequest } from 'next/server'

// Mock prisma
vi.mock('../../../lib/prisma', () => ({
    default: {
        conversation: {
            create: vi.fn(),
            findMany: vi.fn(),
            findFirst: vi.fn(),
        },
        conversationMember: {
            create: vi.fn(),
            createMany: vi.fn(),
        },
        $transaction: vi.fn((cb) => cb(prisma)),
    },
}))

// Mock jwt
vi.mock('jsonwebtoken', () => ({
    default: {
        verify: vi.fn(),
    },
}))

describe('Conversations API', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('POST /api/conversations', () => {
        it('should return 401 if unauthorized', async () => {
            const req = new NextRequest('http://localhost/api/conversations', { method: 'POST' })
            const response = await POST(req)
            expect(response.status).toBe(401)
        })

        it('should return 400 if type is missing', async () => {
            vi.mocked(jwt.verify).mockReturnValue({ userId: 'user-1' } as any)
            const req = new NextRequest('http://localhost/api/conversations', {
                method: 'POST',
                headers: { authorization: 'Bearer valid-token' },
                body: JSON.stringify({ name: 'channel' })
            })
            const response = await POST(req)
            const data = await response.json()
            expect(response.status).toBe(400)
            expect(data.error).toBe('Missing required field: type')
        })

        it('should create a new channel', async () => {
            vi.mocked(jwt.verify).mockReturnValue({ userId: 'user-1' } as any)
            const mockConv = { id: 'conv-1', type: 'channel', name: 'General' }
            vi.mocked(prisma.conversation.create).mockResolvedValue(mockConv as any)
            vi.mocked(prisma.conversationMember.create).mockResolvedValue({} as any)

            const req = new NextRequest('http://localhost/api/conversations', {
                method: 'POST',
                headers: { authorization: 'Bearer valid-token' },
                body: JSON.stringify({ type: 'channel', name: 'General' })
            })

            const response = await POST(req)
            const data = await response.json()

            expect(response.status).toBe(201)
            expect(data.conversation.id).toBe('conv-1')
            expect(prisma.conversation.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ type: 'channel', name: 'General' })
            }))
        })

        it('should return existing direct message if it exists', async () => {
            vi.mocked(jwt.verify).mockReturnValue({ userId: 'user-1' } as any)
            const mockConv = { id: 'dm-1', type: 'direct' }
            vi.mocked(prisma.conversation.findFirst).mockResolvedValue(mockConv as any)

            const req = new NextRequest('http://localhost/api/conversations', {
                method: 'POST',
                headers: { authorization: 'Bearer valid-token' },
                body: JSON.stringify({ type: 'direct', member_ids: ['user-2'] })
            })

            const response = await POST(req)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.conversation.id).toBe('dm-1')
            expect(prisma.conversation.create).not.toHaveBeenCalled()
        })
    })

    describe('GET /api/conversations', () => {
        it('should return user conversations', async () => {
            vi.mocked(jwt.verify).mockReturnValue({ userId: 'user-1' } as any)
            const mockConvs = [{ id: 'c1', type: 'channel' }, { id: 'c2', type: 'direct' }]
            vi.mocked(prisma.conversation.findMany).mockResolvedValue(mockConvs as any)

            const req = new NextRequest('http://localhost/api/conversations', {
                headers: { authorization: 'Bearer valid-token' }
            })

            const response = await GET(req)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.conversations).toHaveLength(2)
            expect(prisma.conversation.findMany).toHaveBeenCalledWith(expect.objectContaining({
                where: {
                    members: {
                        some: { user_id: 'user-1' }
                    }
                }
            }))
        })
    })
})
