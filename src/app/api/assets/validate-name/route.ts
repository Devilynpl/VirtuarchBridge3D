import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'

export async function POST(req: Request) {
    const user = await verifyAuth(req) as any;
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { name, category } = await req.json();
        if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

        // Clean name (lowercase, no spaces)
        let baseName = name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
        let finalName = baseName;
        let counter = 1;

        // Check for existing assets with this name (assuming we store them in DB)
        // If not in DB yet, we check the directory physically or use a dedicated table
        while (true) {
            const existing = await prisma.userAsset.findFirst({
                where: {
                    name: finalName,
                    // Optionally filter by category if names can overlap across categories
                }
            });

            if (!existing) break;

            finalName = `${baseName}_${counter}`;
            counter++;
        }

        return NextResponse.json({
            availableName: finalName,
            isOriginal: finalName === baseName
        });
    } catch (error) {
        return NextResponse.json({ error: 'Validation failed' }, { status: 500 });
    }
}
