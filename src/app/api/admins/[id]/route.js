import { NextResponse } from 'next/server';
import { verifyAdmin, getServiceSupabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// DELETE /api/admins/[id] — Delete an admin user (admin only, requires password re-confirmation)
export async function DELETE(request, { params }) {
  try {
    const callingUser = await verifyAdmin(request);
    const { id } = await params;

    // Prevent self-deletion
    if (id === callingUser.id) {
      return NextResponse.json(
        { error: 'You cannot delete your own account' },
        { status: 400 }
      );
    }

    // Parse the password from the request body
    const body = await request.json();
    const { currentPassword } = body;

    if (!currentPassword) {
      return NextResponse.json(
        { error: 'Your current password is required to delete an admin' },
        { status: 400 }
      );
    }

    // Re-authenticate the calling admin to confirm identity
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
        { error: 'Incorrect password. Please enter your current admin password.' },
        { status: 403 }
      );
    }

    // Delete the target admin user
    const { error } = await getServiceSupabase().auth.admin.deleteUser(id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error.message.startsWith('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
