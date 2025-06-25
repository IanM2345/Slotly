import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not set in .env');
}

export function verifyToken(request) {
  const authHeader = request.headers.get('authorization');
  console.log('Authorization header:', authHeader); // debug

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'No token provided' };
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('Decoded JWT:', decoded); // debug
    return { valid: true, decoded };
  } catch (err) {
    console.error('JWT verification failed:', err); // debug
    return { valid: false, error: 'Invalid token' };
  }
}




