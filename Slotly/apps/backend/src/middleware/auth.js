import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not set in .env');
}

export function verifyToken(request) {
  const token = request.cookies.get('token')?.value;

  if (!token) {
    return { valid: false, error: 'No token provided' };
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return { valid: true, decoded };
  } catch (err) {
    return { valid: false, error: 'Invalid token' };
  }
}


export function requireAuth(request) {
  const { valid, decoded, error } = verifyToken(request);
  if (!valid) {
    return NextResponse.json({ error }, { status: 401 });
  }

  return decoded; 
}
