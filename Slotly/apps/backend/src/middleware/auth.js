import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not set in .env');
}

export function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return { valid: true, decoded };
  } catch (err) {
    console.error('JWT verification failed:', err);
    return { valid: false, error: 'Invalid token' };
  }
}
import jwt from 'jsonwebtoken';



if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not set in .env');
}


export function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return { valid: true, decoded };
  } catch (err) {
    console.error('JWT verification failed:', err);
    return { valid: false, error: 'Invalid token' };
  }
}


export async function authenticateRequest(request) {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Authorization header missing or malformed' };
  }

  const token = authHeader.split(' ')[1];
  return verifyToken(token);
}