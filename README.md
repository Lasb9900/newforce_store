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

4. Aplica migraciones SQL:
   - `supabase/migrations/202602240001_init.sql`
   - `supabase/migrations/202602240002_seed_support.sql`

Puedes usar SQL editor o CLI:

```bash
supabase db push
```

5. Ejecuta seed (crea categorías, productos demo, imágenes, variantes y usuario DEV owner):

```bash
npm run seed
```

6. Levanta app:

```bash
npm run dev
```

7. Stripe webhook local:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## Credenciales DEV

- **Email:** `julio123@example.com`
- **Password:** `Julio123`
- **Username UI:** `JULIO123`
- **Rol:** `owner`

> ⚠️ Solo para desarrollo. Cambia/rota credenciales en producción.

## Demo products

### Categorías
- Laundry
- TV & Audio
- Kitchen
- Small Appliances
- Cleaning
- Climate

### Productos seed
1. Lavadora Whirlpool 20kg (variantes 20kg, 24kg)
2. Secadora Samsung Heat Pump (variantes 7kg, 9kg)
3. Televisor LG UHD (variantes 50", 55", 65")
4. Televisor Samsung QLED (variantes 55", 65")
5. Microondas Panasonic Inverter (simple)
6. Nevera GE 20ft (simple)
7. Licuadora Ninja 1000W (simple)
8. Aspiradora Dyson V-series (variantes V8, V10)
9. Aire acondicionado Hisense (variantes 12k BTU, 18k BTU)
10. Lavavajillas Bosch (simple)
11. Cafetera Keurig (simple)
12. Robot aspirador iRobot (simple)

> Cada producto incluye 2 imágenes placeholder (URLs públicas, sin binarios).

## Funcionalidades

- Storefront: home, shop, detalle con variantes y galería, carrito, checkout, success/cancel.
- Admin: login, guard de `/admin/*`, dashboard, productos, órdenes, reviews.
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
