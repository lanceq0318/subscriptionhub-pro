import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    // Just return a success response without processing any actions.
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Error occurred', e);
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
}
