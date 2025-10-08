import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(
  req: Request,
  { params }: { params: { id: string; attachmentId: string } }
) {
  const id = Number(params.id);
  const attachmentId = Number(params.attachmentId);
  if (!Number.isInteger(id) || !Number.isInteger(attachmentId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  try {
    const { rows } = await sql<{
      id: number; name: string; mime_type: string | null; data: any;
    }>`
      SELECT id, name, mime_type, data
      FROM attachments
      WHERE id = ${attachmentId} AND subscription_id = ${id}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const rec = rows[0];
    const contentType = rec.mime_type || 'application/octet-stream';
    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Cache-Control', 'private, max-age=0, no-store');

    const url = new URL(req.url);
    const download = url.searchParams.get('download');
    const disposition = download ? 'attachment' : 'inline';
    headers.set('Content-Disposition', `${disposition}; filename="${encodeURIComponent(rec.name)}"`);

    const body: any = rec.data as any;
    const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);

    return new Response(buf, { headers });
  } catch (e) {
    console.error('Download attachment failed', e);
    return NextResponse.json({ error: 'Failed to download attachment' }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; attachmentId: string } }
) {
  const id = Number(params.id);
  const attachmentId = Number(params.attachmentId);
  if (!Number.isInteger(id) || !Number.isInteger(attachmentId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  try {
    const { rowCount } = await sql`
      DELETE FROM attachments
      WHERE id = ${attachmentId} AND subscription_id = ${id}
    `;
    if (!rowCount) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Delete attachment failed', e);
    return NextResponse.json({ error: 'Failed to delete attachment' }, { status: 500 });
  }
}
