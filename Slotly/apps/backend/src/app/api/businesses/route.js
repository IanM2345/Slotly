import '@/sentry.server.config'
import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma' 

const prisma = new PrismaClient()


export async function POST(request) {
  try {
    const data = await request.json()

    const { name, description, ownerId } = data

    if (!name || !description || !ownerId) {
      return NextResponse.json(
        { error: 'Name, description, and ownerId are required.' },
        { status: 400 }
      )
    }

   
    const existingBusiness = await prisma.business.findFirst({
      where: {
        name,
        ownerId
      }
    })

    if (existingBusiness) {
      return NextResponse.json(
        { error: 'You already have a business with this name.' },
        { status: 409 }
      )
    }

    const newBusiness = await prisma.business.create({
      data: {
        name,
        description,
        ownerId
      }
    })

    return NextResponse.json(newBusiness, { status: 201 })
  } catch (error) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A business with this name already exists for this user.' },
        { status: 409 }
      )
    }
    Sentry.captureException(error)
    console.error('Error creating business:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const businesses = await prisma.business.findMany({
      include: {
        owner: true,
        staff: true,
        services: true,
        subscription: true
      }
    })

    return NextResponse.json(businesses, { status: 200 })
  } catch (error) {
    Sentry.captureException(error)
    console.error('Error fetching businesses:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
