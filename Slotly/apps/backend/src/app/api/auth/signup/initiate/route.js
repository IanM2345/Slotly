import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

const DEV_PRESET_OTP = process.env.DEV_PRESET_OTP || '910150611';
const CORS = {
  'Access-Control-Allow-Origin': '*',          // or your exact origin
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(request) {
  try {
    const { email, phone, password, name } = await request.json();
    if (!name || (!email && !phone) || !password) {
      return NextResponse.json(
        { error: 'Name, phone/email, and password are required' },
        { status: 400, headers: CORS }    // <-- add CORS here too
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const hashedOTP = await bcrypt.hash(String(DEV_PRESET_OTP), 8);
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000);

    return NextResponse.json(
      {
        message: 'Preset OTP mode: enter the preset code to verify',
        sessionData: {
          email: email || null,
          phone: phone || null,
          name,
          password: hashedPassword,
          otp: hashedOTP,
          otpExpires,
          __dev_hint: `Use OTP ${DEV_PRESET_OTP}`,
        },
      },
      { headers: CORS }                    // <-- and here
    );
  } catch (error) {
    console.error('Signup initiate error:', error);
    return NextResponse.json(
      { error: 'Signup initiation failed' },
      { status: 500, headers: CORS }       // <-- and here
    );
  }
}
