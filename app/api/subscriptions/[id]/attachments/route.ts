import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { AttachmentTypeEnum } from '@/app/lib/validation';

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

    return NextResponse.json({ attachments: data });
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

    const typeRaw = form.get('type');
    const type = typeof typeRaw === 'string' ? typeRaw : 'other';
    const parsed = AttachmentTypeEnum.safeParse(type);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid attachment type' }, { status: 400 });
    }

    // Size guard: 10 MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 413 });
    }

    const nameOverride = form.get('name');
    const filename = typeof nameOverride === 'string' && nameOverride.trim() ? nameOverride.trim() : file.name;
    const mimeType = file.type || null;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { rows } = await sql<{ id: number }>`
      INSERT INTO attachments (subscription_id, name, type, size, mime_type, data)
      VALUES (${subscriptionId}, ${filename}, ${type}, ${file.size || null}, ${mimeType}, ${buffer})
      RETURNING id
    `;

    return NextResponse.json({ id: rows[0].id, name: filename, type, size: file.size, mimeType }, { status: 201 });
  } catch (e) {
    console.error('Upload attachment failed', e);
    return NextResponse.json({ error: 'Failed to upload attachment' }, { status: 500 });
  }
}
