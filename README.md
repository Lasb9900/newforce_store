# NewForce Store

E-commerce con **Next.js App Router + TypeScript + Tailwind + Supabase + Stripe**.

## Setup rápido

1. Instala dependencias:

```bash
npm install
```

2. Crea `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://okitgnhswmyuxzzobdou.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
STRIPE_SUCCESS_URL=http://localhost:3000/success?session_id={CHECKOUT_SESSION_ID}
STRIPE_CANCEL_URL=http://localhost:3000/cancel
SUPABASE_STORAGE_BUCKET=product-images
```

3. En Supabase Storage, crea bucket `product-images` con **public ON**.

4. Aplica migración SQL (`supabase/migrations/202602240001_init.sql`):
   - SQL editor de Supabase, o
   - CLI:

```bash
supabase db push
```

5. Crea owner (después de registrarte con Auth):

```sql
insert into profiles (user_id, role)
values ('<USER_UUID>', 'owner')
on conflict (user_id) do update set role = 'owner';
```

6. Seed de datos demo:

```bash
npm run seed
```

7. Levanta app:

```bash
npm run dev
```

8. Stripe webhook local:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## Funcionalidades

- Storefront: home, shop, detalle con variantes, carrito, checkout, success/cancel.
- Admin: login, guard de /admin/*, dashboard, productos, órdenes, reviews.
- Stripe: Checkout Sessions + webhook con verificación de firma e idempotencia por `stripe_session_id`.
- Supabase: RLS y políticas owner/customer/public.

## Troubleshooting

- **“No se ve estilo / colores raros”**
  - Verifica `tailwind.config.ts` en `content` (`src/app`, `src/components`, `src/lib`).
  - Verifica `src/app/globals.css` con `@tailwind base; @tailwind components; @tailwind utilities;`.
  - Verifica import de `./globals.css` en `src/app/layout.tsx`.

- **“Webhook signature error”**
  - `STRIPE_WEBHOOK_SECRET` no coincide con el valor emitido por `stripe listen`.

- **“Admin no entra”**
  - El usuario no tiene `profiles.role = 'owner'`.
  - Revisa sesión activa y cookie de Supabase.

## Checks

```bash
npm run lint
npm run build
```
