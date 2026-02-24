# NewForce Store

E-commerce full-stack con **Next.js App Router + TypeScript + Tailwind**, **Supabase (Postgres/Auth/Storage)** y **Stripe Checkout + Webhooks**.

## Funcionalidades implementadas

- Storefront: home con destacados, shop, detalle de producto, variantes, carrito localStorage, wishlist invitado/local, reviews, success/cancel.
- Checkout invitado con Stripe Checkout Session, colección de shipping US y teléfono.
- Admin owner: dashboard, lista de productos/órdenes/reviews, endpoints CRUD de productos, variantes e imágenes.
- API route handlers (`/app/api/*`) con validación Zod en payloads principales.
- Base de datos SQL completa + RLS + políticas owner/customer/public.
- Webhook Stripe idempotente para creación de órdenes pagadas y decremento de stock.

## Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS
- Supabase JS + SSR helpers
- Stripe SDK
- Zod

## Requisitos

- Node.js 20+
- Proyecto Supabase
- Cuenta Stripe

## Variables de entorno

Crea `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
STRIPE_SUCCESS_URL=http://localhost:3000/success?session_id={CHECKOUT_SESSION_ID}
STRIPE_CANCEL_URL=http://localhost:3000/cancel
SUPABASE_STORAGE_BUCKET=product-images
```

## Instalación y ejecución

```bash
npm install
npm run dev
```

## Migraciones SQL

Archivo principal:

- `supabase/migrations/202602240001_init.sql`

Aplicar con Supabase CLI:

```bash
supabase db push
```

o pegando SQL en el SQL editor de Supabase.

## Seed demo data

```bash
npm run seed
```

Inserta:
- categorías
- 12 productos (6 simples + 6 con variantes)
- 4 destacados
- imágenes placeholder

## Stripe Webhook local

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## Crear owner admin

1. Regístrate (Supabase Auth email/password).
2. Ejecuta en SQL editor:

```sql
insert into profiles (user_id, role)
values ('<USER_UUID>', 'owner')
on conflict (user_id) do update set role='owner';
```

## Endpoints principales

### Públicos
- `GET /api/products`
- `GET /api/products/:id`
- `GET /api/products/:id/related`
- `GET /api/products/:id/reviews`

### Auth
- `GET /api/me/wishlist`
- `POST /api/me/wishlist/:productId`
- `DELETE /api/me/wishlist/:productId`
- `POST /api/products/:id/reviews`

### Admin (owner)
- `POST /api/admin/products`
- `PUT /api/admin/products/:id`
- `PATCH /api/admin/products/:id/active`
- `PATCH /api/admin/products/:id/featured`
- `POST /api/admin/products/:id/images`
- `DELETE /api/admin/product-images/:id`
- `POST /api/admin/products/:id/variants`
- `PUT /api/admin/variants/:id`
- `PATCH /api/admin/variants/:id/active`
- `DELETE /api/admin/variants/:id`
- `GET /api/admin/orders`
- `GET /api/admin/orders/:id`
- `GET /api/admin/reviews`
- `PATCH /api/admin/reviews/:id`
- `GET /api/admin/dashboard?range=7|30|90`

### Stripe
- `POST /api/stripe/checkout`
- `POST /api/stripe/webhook`

## Notas MVP

- Todos los montos están en centavos (`*_cents`).
- Backend recalcula precios/stock en checkout.
- Stock se descuenta al recibir `checkout.session.completed`.
- Soft delete con `products.active=false`.
