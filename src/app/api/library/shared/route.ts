import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

import { JWT_SECRET } from '@/lib/auth';

async function getUserIdFromReq(req: Request) {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return null
    const token = authHeader.split(' ')[1]
    try {
        const decoded: any = jwt.verify(token, JWT_SECRET)
        return decoded.userId
    } catch (e) {
        return null
    }
}

export async function GET(req: Request) {
    const userId = await getUserIdFromReq(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        // Get all users who have me as a contact (mutual friends essentially for this simplified version)
        // Actually, the user wants "when we add each other". 
        // Let's find contacts where the relationship is existing.

        const contacts = await prisma.userContact.findMany({
            where: { user_id: userId },
            include: {
                contact: {
                    include: {
                        assets: true
                    }
                }
            }
        })

        const sharedLibraries = contacts.map(c => ({
            userId: c.contact.id,
            username: c.contact.username,
            assets: c.contact.assets
        }))

        return NextResponse.json({ sharedLibraries })
    } catch (error) {
        console.error('Shared library fetch error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
