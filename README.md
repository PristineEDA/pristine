# pristine

## Account integration

The desktop app now integrates with the sibling `pristine-auth` service through the MenuBar avatar.

By default, the desktop app targets the hosted production auth service.

Set these environment variables to override the defaults, for example when developing against a local auth stack:
- `PRISTINE_AUTH_SERVICE_URL`
- `PRISTINE_SUPABASE_URL`
- `PRISTINE_SUPABASE_PUBLISHABLE_KEY`

The desktop app opens the system browser for sign-in and receives the callback on `pristine://auth/callback`.

For the full Supabase and Cloudflare setup flow, use the documentation in the sibling `pristine-auth` repo.