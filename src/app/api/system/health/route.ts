import { NextResponse } from 'next/server';

export async function HEAD() {
    return new NextResponse(null, { status: 200 });
}

export async function GET() {
    return NextResponse.json({ status: 'ok', version: '0.1.4-beta' });
}
