import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'
import { getAssets } from '@/lib/assets'
import { NextRequest } from 'next/server'

vi.mock('@/lib/assets', () => ({
    getAssets: vi.fn(),
}))

describe('GET /api/assets/validate', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should return 404 if asset code is not found', async () => {
        vi.mocked(getAssets).mockResolvedValue([{ id: 'other' }] as any)
        const req = new NextRequest('http://localhost/api/assets/validate?code=missing')
        const response = await GET(req)
        expect(response.status).toBe(404)
    })

    it('should return 200 and asset info if code is valid', async () => {
        vi.mocked(getAssets).mockResolvedValue([
            { id: 'abc', name: 'Test Asset', thumbnail: 'path/to/thumb' }
        ] as any)
        const req = new NextRequest('http://localhost/api/assets/validate?code=abc')
        const response = await GET(req)
        const data = await response.json()
        expect(response.status).toBe(200)
        expect(data.valid).toBe(true)
        expect(data.asset.name).toBe('Test Asset')
    })
})
