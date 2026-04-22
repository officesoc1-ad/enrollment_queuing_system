import { NextResponse } from 'next/server';
import { verifyAdmin, getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET /api/admins/me — Get the calling admin's profile (including role metadata)
export async function GET(request) {
  try {
    const callingUser = await verifyAdmin(request);

    // Fetch the full user record via service role to get user_metadata
    const { data: { user }, error } = await getServiceSupabase().auth.admin.getUserById(callingUser.id);
    if (error) throw error;

    return NextResponse.json({
      id: user.id,
      email: user.email,
      is_temporary: user.user_metadata?.is_temporary === true,
      created_at: user.created_at
    });
  } catch (error) {
    if (error.message.startsWith('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
