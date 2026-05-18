import { jwtVerify } from 'jose';

const secret = process.env.JWT_SECRET;
if (!secret) {
    throw new Error('JWT_SECRET must be set in environment variables');
}
export const JWT_SECRET = secret;


export async function verifyToken(token: string) {
    try {
        const secret = new TextEncoder().encode(JWT_SECRET);
        const { payload } = await jwtVerify(token, secret);
        return payload;
    } catch (err) {
        return null;
    }
}

export async function verifyAuth(request: Request) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.split(' ')[1];
    return verifyToken(token);
}
