import { createHandler } from './handler.mjs';
Deno.serve(createHandler({
  secret: Deno.env.get('BOOK_ORIGIN_WEBHOOK_SECRET'),
  url: Deno.env.get('SUPABASE_URL'),
  key: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
}));
