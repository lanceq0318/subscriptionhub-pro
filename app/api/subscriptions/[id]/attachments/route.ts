import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { AttachmentTypeEnum } from '@/app/lib/validation';

export const runtime = 'nodejs';

const ALLOWED_MIME = new Set([
  'application/pdf','image/png','image/jpeg','image/jpg','image/gif',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword','text/plain'
]);

function sanitizeFilename(name: string) {
  return name.replace(/[\/\\<>:"|?*\x00-\x1F]/g, '_').slice(0, 200) || 'file';
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: 'Invalid subscription id' }, { status: 400 });
  }

  try {
    const { rows } = await sql<{
      id: number; name: string; type: string; size: number | null;
      upload_date: string; mime_type: string | null;
    }>`
      SELECT id, name, type, size, upload_date, mime_type
      FROM attachments
      WHERE subscription_id = ${id}
      ORDER BY upload_date DESC
    `;

    const data = rows.map(r => ({
      id: r.id,
      name: r.name,
      type: r.type,
      size: typeof r.size === 'string' ? Number(r.size) : r.size,
      uploadDate: r.upload_date,
      mimeType: r.mime_type,
    }));

    return NextResponse.json({ attachments: data }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (e) {
    console.error('List attachments failed', e);
    return NextResponse.json({ error: 'Failed to list attachments' }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const subscriptionId = Number(params.id);
  if (!Number.isInteger(subscriptionId)) {
    return NextResponse.json({ error: 'Invalid subscription id' }, { status: 400 });
  }

  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 413 });
    }

    const typeRaw = form.get('type');
    const type = typeof typeRaw === 'string' ? typeRaw : 'other';
    const parsed = AttachmentTypeEnum.safeParse(type);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid attachment type' }, { status: 400 });
    }

    const mimeType = file.type || null;
    if (mimeType && !ALLOWED_MIME.has(mimeType)) {
      return NextResponse.json({ error: `MIME not allowed: ${mimeType}` }, { status: 415 });
    }

    const nameOverride = form.get('name');
    const filenameRaw = typeof nameOverride === 'string' && nameOverride.trim() ? nameOverride.trim() : file.name;
    const filename = sanitizeFilename(filenameRaw);

    // Lightweight dedupe: same (name,size) per subscription
    const dup = await sql<{ id: number }>`
      SELECT id FROM attachments WHERE subscription_id=${subscriptionId} AND name=${filename} AND size=${file.size} LIMIT 1
    `;
    if (dup.rows.length) {
      return NextResponse.json({ error: 'Duplicate attachment (same name & size exists)' }, { status: 409 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const pgBuffer: any = buffer;

    const { rows } = await sql<{ id: number }>`
      INSERT INTO attachments (subscription_id, name, type, size, mime_type, data)
      VALUES (${subscriptionId}, ${filename}, ${type}, ${file.size || null}, ${mimeType}, ${pgBuffer})
      RETURNING id
    `;

    return NextResponse.json({ id: rows[0].id, name: filename, type, size: file.size, mimeType }, { status: 201 });
  } catch (e) {
    console.error('Upload attachment failed', e);
    return NextResponse.json({ error: 'Failed to upload attachment' }, { status: 500 });
  }
}
