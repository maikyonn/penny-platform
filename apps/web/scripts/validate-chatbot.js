import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRole) {
  console.error('Missing Supabase configuration in environment.');
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

const email = `chatbot-e2e-${Date.now()}@example.com`;
const password = `Test-${Math.random().toString(36).slice(2, 8)}!`; // simple unique password

console.log('Creating user', email);
const { data: created, error: createError } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true
});

if (createError) {
  console.error('Failed to create user:', createError);
  process.exit(1);
}

console.log('User created', created?.user?.id);

const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
console.log('Signing in user');
const { data: signInData, error: signInError } = await client.auth.signInWithPassword({ email, password });

if (signInError || !signInData?.session) {
  console.error('Failed to sign in newly created user:', signInError);
  process.exit(1);
}

console.log('Signed in, calling chatbot');

const accessToken = signInData.session.access_token;
const chatbotUrl = `${supabaseUrl}/functions/v1/chatbot-stub`;

const response = await fetch(chatbotUrl, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    apikey: anonKey,
    'content-type': 'application/json'
  },
  body: JSON.stringify({
    message: 'Validate JWT flow',
    campaign: { name: 'Validation Run' },
    user_id: created.user?.id
  })
});

const bodyText = await response.text();

console.log('Chatbot response status:', response.status);
console.log('Chatbot response body:', bodyText);

if (!response.ok) {
  process.exit(1);
}
