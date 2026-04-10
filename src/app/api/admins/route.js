import { NextResponse } from 'next/server';
import { verifyAdmin, getServiceSupabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// GET /api/admins — List all admin users (admin only)
export async function GET(request) {
  try {
    await verifyAdmin(request);

    const { data, error } = await getServiceSupabase().auth.admin.listUsers();
    if (error) throw error;

    // Return only the fields the UI needs
    const admins = data.users.map(u => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at
    }));

    return NextResponse.json(admins);
  } catch (error) {
    if (error.message.startsWith('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/admins — Create a new admin user (admin only, requires password re-confirmation)
export async function POST(request) {
  try {
    const callingUser = await verifyAdmin(request);

    const body = await request.json();
    const { email, password, currentPassword } = body;

    if (!email || !password || !currentPassword) {
      return NextResponse.json(
        { error: 'Email, password, and your current password are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'New admin password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Re-authenticate the calling admin to confirm identity
    // Use a temporary client so we don't affect the existing session
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

    // Create the new admin user via service role
    const { data, error } = await getServiceSupabase().auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (error) throw error;

    return NextResponse.json({
      id: data.user.id,
      email: data.user.email,
      created_at: data.user.created_at
    }, { status: 201 });
  } catch (error) {
    if (error.message.startsWith('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
