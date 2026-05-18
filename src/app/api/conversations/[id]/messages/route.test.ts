import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST, GET } from './route'
import prisma from '../../../../../lib/prisma'
import jwt from 'jsonwebtoken'
import { NextRequest } from 'next/server'

// Mock prisma
vi.mock('../../../../../lib/prisma', () => ({
    default: {
        message: {
            create: vi.fn(),
            findMany: vi.fn(),
        },
        conversation: {
            update: vi.fn(),
        },
        conversationMember: {
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

describe('Messages API', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('POST /api/conversations/[id]/messages', () => {
        it('should return 401 if unauthorized', async () => {
            const req = new NextRequest('http://localhost/api/conversations/1/messages', { method: 'POST' })
            const response = await POST(req, { params: Promise.resolve({ id: '1' }) } as any)
            expect(response.status).toBe(401)
        })

        it('should return 403 if user is not a member of the conversation', async () => {
            vi.mocked(jwt.verify).mockReturnValue({ userId: 'user-1' } as any)
            vi.mocked(prisma.conversationMember.findUnique).mockResolvedValue(null)

            const req = new NextRequest('http://localhost/api/conversations/1/messages', {
                method: 'POST',
                headers: { authorization: 'Bearer token' },
                body: JSON.stringify({ content: 'hello' })
            })

            const response = await POST(req, { params: Promise.resolve({ id: '1' }) } as any)
            expect(response.status).toBe(403)
        })

        it('should create a message', async () => {
            vi.mocked(jwt.verify).mockReturnValue({ userId: 'user-1' } as any)
            vi.mocked(prisma.conversationMember.findUnique).mockResolvedValue({ id: 'm1' } as any)
            vi.mocked(prisma.message.create).mockResolvedValue({ id: 'msg-1', content: 'hello' } as any)

            const req = new NextRequest('http://localhost/api/conversations/1/messages', {
                method: 'POST',
                headers: { authorization: 'Bearer token' },
                body: JSON.stringify({ content: 'hello', type: 'text' })
            })

            const response = await POST(req, { params: Promise.resolve({ id: '1' }) } as any)
            const data = await response.json()

            expect(response.status).toBe(201)
            expect(data.message.id).toBe('msg-1')
            expect(prisma.message.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    content: 'hello',
                    conversation_id: '1',
                    sender_id: 'user-1'
                })
            }))
        })
    })

    describe('GET /api/conversations/[id]/messages', () => {
        it('should return messages for a conversation', async () => {
            vi.mocked(jwt.verify).mockReturnValue({ userId: 'user-1' } as any)
            vi.mocked(prisma.conversationMember.findUnique).mockResolvedValue({ id: 'm1' } as any)
            vi.mocked(prisma.message.findMany).mockResolvedValue([{ id: 'msg-1', content: 'hi' }] as any)

            const req = new NextRequest('http://localhost/api/conversations/1/messages', {
                headers: { authorization: 'Bearer token' }
            })

            const response = await GET(req, { params: Promise.resolve({ id: '1' }) } as any)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.messages).toHaveLength(1)
        })
    })
})
