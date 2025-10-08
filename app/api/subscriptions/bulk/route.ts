import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export const runtime = 'nodejs';

type Action =
  | { type: 'delete'; ids: number[] }
  | { type: 'status'; ids: number[]; status: 'active' | 'pending' | 'cancelled' }
  | { type: 'addTag'; ids: number[]; tag: string }
  | { type: 'removeTag'; ids: number[]; tag: string };

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Action;
    const ids = (body as any).ids;
    if (!Array.isArray(ids) || !ids.length) {
      return NextResponse.json({ error: 'No ids provided' }, { status: 400 });
    }
    const idList = ids.map(Number).filter(n => Number.isInteger(n));
    if (!idList.length) {
      return NextResponse.json({ error: 'No valid ids' }, { status: 400 });
    }

    // Use the array directly in SQL queries (no need for sql.raw or sql.array)
    const idListStr = idList.join(',');

    if (body.type === 'delete') {
      await sql`DELETE FROM payments WHERE subscription_id = ANY(${idListStr})`;
      await sql`DELETE FROM attachments WHERE subscription_id = ANY(${idListStr})`;
      await sql`DELETE FROM subscription_tags WHERE subscription_id = ANY(${idListStr})`;
      await sql`DELETE FROM subscriptions WHERE id = ANY(${idListStr})`;
      return NextResponse.json({ success: true, count: idList.length });
    }

    if (body.type === 'status') {
      await sql`
        UPDATE subscriptions
        SET status = ${body.status}, updated_at = NOW()
        WHERE id = ANY(${idListStr})
      `;
      return NextResponse.json({ success: true, count: idList.length });
    }

    if (body.type === 'addTag') {
      for (const id of idList) {
        await sql`INSERT INTO subscription_tags (subscription_id, tag) VALUES (${id}, ${body.tag})`;
      }
      return NextResponse.json({ success: true, count: idList.length });
    }

    if (body.type === 'removeTag') {
      await sql`
        DELETE FROM subscription_tags
        WHERE subscription_id = ANY(${idListStr}) AND tag = ${body.tag}
      `;
      return NextResponse.json({ success: true, count: idList.length });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    console.error('bulk action failed', e);
    return NextResponse.json({ error: 'Bulk action failed' }, { status: 500 });
  }
}
