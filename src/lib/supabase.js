import { createClient } from '@supabase/supabase-js';

// Browser client (used in components and client-side code)
// Exported as a singleton function instead of a module-level variable
// so it doesn't get executed during Next.js build time
let supabaseInstance = null;

export const getSupabase = () => {
  if (supabaseInstance) return supabaseInstance;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

  // Even with placeholders, createClient will succeed, but actual requests will fail
  // This prevents build errors without crashing the app at runtime
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  return supabaseInstance;
};

// Export a proxy object that lazily delegates to getSupabase() 
// This allows backwards compatibility with `import { supabase } from '@/lib/supabase'`
export const supabase = new Proxy({}, {
  get: (target, prop) => {
    // If it's a known non-method property or we're accessing it directly, handle it
    if (prop === 'auth') return getSupabase().auth;
    if (prop === 'channel') return getSupabase().channel.bind(getSupabase());
    if (prop === 'removeChannel') return getSupabase().removeChannel.bind(getSupabase());
    if (prop === 'from') return getSupabase().from.bind(getSupabase());
    
    // Fallback for everything else
    return Reflect.get(getSupabase(), prop);
  }
});

// Server client with service role (used in API routes for admin operations)
export function getServiceSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder';
  
  return createClient(supabaseUrl, serviceRoleKey);
}

// Verify that the request comes from an authenticated admin
// Returns the user object if valid, throws an error otherwise
export async function verifyAdmin(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized: No token provided');
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await getServiceSupabase().auth.getUser(token);

  if (error || !user) {
    throw new Error('Unauthorized: Invalid token');
  }

  return user;
}
