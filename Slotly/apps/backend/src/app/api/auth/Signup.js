import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function POST(request) {
  const data ={
    name: request.body.username,
    email: request.body.email,
    password: bcrypt.hashSync(request.body.password, 10),
  }

  const userdata = await Collection.insertMany(data);
  console.
  
}
