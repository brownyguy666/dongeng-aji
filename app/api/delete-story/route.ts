import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { storyId } = body;

    if (!storyId) {
      return NextResponse.json(
        { error: 'storyId wajib disertakan.' },
        { status: 400 }
      );
    }

    // 1. List and remove all audio files in Supabase Storage for this story
    try {
      const { data: fileList, error: listError } = await supabaseAdmin.storage
        .from('story-audio')
        .list(`stories/${storyId}`);

      if (!listError && fileList && fileList.length > 0) {
        const filesToRemove = fileList.map((file) => `stories/${storyId}/${file.name}`);
        await supabaseAdmin.storage.from('story-audio').remove(filesToRemove);
      }
    } catch (storageErr) {
      console.warn('Storage cleanup notice:', storageErr);
    }

    // 2. Delete story record from database (Cascade deletes story_characters & story_segments)
    const { error: dbError } = await supabaseAdmin
      .from('stories')
      .delete()
      .eq('id', storyId);

    if (dbError) {
      return NextResponse.json(
        { error: `Gagal menghapus cerita dari database: ${dbError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'Cerita dan seluruh audio berhasil dihapus.' });
  } catch (error: any) {
    console.error('Delete Story API Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Terjadi kesalahan saat menghapus cerita.' },
      { status: 500 }
    );
  }
}
