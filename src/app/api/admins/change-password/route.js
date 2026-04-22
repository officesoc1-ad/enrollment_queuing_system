import { NextResponse } from 'next/server';
import { verifyAdmin, getServiceSupabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// POST /api/admins/change-password — Change the calling admin's password
export async function POST(request) {
  try {
    const callingUser = await verifyAdmin(request);

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current password and new password are required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'New password must be at least 6 characters' },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: 'New password must be different from your current password' },
        { status: 400 }
      );
    }

    // Verify the current password by attempting to sign in with it
    const tempClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { error: authError } = await tempClient.auth.signInWithPassword({
      email: callingUser.email,
      password: currentPassword
    });

    if (authError) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 403 }
      );
    }

    // Update the password via service role (bypasses all restrictions)
    const { error } = await getServiceSupabase().auth.admin.updateUserById(
      callingUser.id,
      { password: newPassword }
    );

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    if (error.message.startsWith('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
