# Tech Spec — `store-bun-sqlite-htmx`

Tienda en línea + panel de administración + asistente/chat multicanal, construidos
sobre un stack **Bun + HTMX + SQLite**: server-rendered, sin paso de build,
autoalojado y publicado por **Cloudflare Tunnel** sobre un dominio propio.

> **Estado:** documento de diseño. **Aún no se implementa nada** salvo esta carpeta
> y este archivo. Sirve como contrato para la implementación posterior.

---

## Tabla de contenido

1. [Objetivos y no-objetivos](#1-objetivos-y-no-objetivos)
2. [Decisiones fijadas y supuestos](#2-decisiones-fijadas-y-supuestos)
3. [Stack tecnológico](#3-stack-tecnológico)
4. [Arquitectura general](#4-arquitectura-general)
5. [Estructura de carpetas](#5-estructura-de-carpetas)
6. [Sistema de módulos](#6-sistema-de-módulos)
7. [Modelo de datos (SQLite)](#7-modelo-de-datos-sqlite)
8. [Almacenamiento de imágenes/archivos](#8-almacenamiento-de-imágenesarchivos)
9. [Storefront público](#9-storefront-público)
10. [Carrito y checkout](#10-carrito-y-checkout)
11. [Pagos](#11-pagos)
12. [Panel de administración](#12-panel-de-administración)
13. [Autenticación y autorización](#13-autenticación-y-autorización)
14. [Chat / Asistente IA (multicanal)](#14-chat--asistente-ia-multicanal)
15. [UI / Theming](#15-ui--theming)
16. [Seguridad (transversal)](#16-seguridad-transversal)
17. [Despliegue (Cloudflare Tunnel)](#17-despliegue-cloudflare-tunnel)
18. [Variables de entorno](#18-variables-de-entorno)
19. [Plan de implementación por fases](#19-plan-de-implementación-por-fases)
20. [Decisiones abiertas / pendientes](#20-decisiones-abiertas--pendientes)

---

## 1. Objetivos y no-objetivos

### Objetivos

- **Tienda pública** con catálogo de productos, variantes, categorías, carrito y
  compra con **pago manual vía Nequi** (COP): en el checkout el cliente transfiere y
  envía el **comprobante de pago (imagen)** por el chat. *(Pasarela **Wompi**: fase
  futura, ver §11 y §20.)*
- **Panel de administración** construido con un **sistema de módulos** (un módulo
  por dominio, permisos por rol, listas con búsqueda/paginación).
- **Control de inventario/stock** para el catálogo.
- **Chat / asistente** que responde consultando la base de datos, expuesto como
  un **endpoint reutilizable** por la web y por **WhatsApp** (Cloud API de Meta).
- **Auth** con Google OAuth (admin y cliente opcional), sesiones propias.
- **Autoalojado** en un servidor propio, publicado con **Cloudflare Tunnel** sobre
  un dominio ya configurado.
- **Sin paso de build**: HTML server-rendered + HTMX, SQLite embebido, TypeScript
  estricto ejecutado directamente por Bun.

### No-objetivos (v1)

- **Personalización visual de productos** (editor de lienzo/canvas donde el cliente
  sube y posiciona imágenes sobre el producto): **fuera de v1**, documentado como
  fase futura (ver §20).
- **Pasarela de pago automática (Wompi)**: fuera de v1; el pago es **manual vía
  Nequi** con verificación por staff (ver §11). Se integrará en una fase futura.
- Migración de datos desde sistemas previos (proyecto nuevo, base vacía).
- Alta disponibilidad multi-nodo / réplica de escritura (SQLite es de un solo
  escritor; ver §17 sobre escalabilidad).
- App móvil nativa. La UI es web responsive (mobile-first).

---

## 2. Decisiones fijadas y supuestos

Decisiones tomadas con el dueño del producto (fuente de verdad para el diseño):

| # | Tema | Decisión |
|---|------|----------|
| D1 | Identidad del **cliente** | **Checkout como invitado** + **cuenta opcional con Google OAuth** para historial de pedidos y chat persistente. |
| D2 | Personalización de productos | **Fuera de v1.** Fase futura (§20). |
| D3 | Alcance del **admin** | Módulos de tienda **+ control de inventario/stock**: productos, variantes, categorías, órdenes, envíos, contenido, stock, usuarios, reportes. |
| D4 | **WhatsApp** | **WhatsApp Cloud API oficial de Meta**, webhook dentro de la misma app. |
| D5 | Acceso a datos del **chat** | **Cliente:** solo herramientas curadas seguras (catálogo, envíos, estado de *su* orden). **Admin:** chat analítico con **NL→SQL de solo lectura**. |
| D6 | Auth del **admin/staff** | **Google OAuth** con **lista blanca** de correos + **roles en la BD**. |
| D7 | **Pagos** | **v1: pago manual vía Nequi** — el cliente transfiere y envía el **comprobante (imagen)** por el chat; un admin verifica y marca la orden como pagada. **Wompi** (pasarela automática) queda para **fase futura** (§11, §20). |

Supuestos **confirmados** con el dueño del producto:

- **S1 — Idioma:** **español como único idioma soportado** (sin i18n en v1). Aplica
  tanto a la **UI** como al **LLM**: el asistente responde siempre en español.
- **S2 — LLM:** en v1 **DeepSeek** (OpenAI-compatible). El **core no depende de
  DeepSeek**: el modelo se usa solo a través de `core/llm.ts` (abstracción del “LLM”),
  de modo que versiones futuras pueden cambiar de proveedor OpenAI-compatible sin
  tocar la arquitectura.
- **S3 — Moneda:** **COP** únicamente. Montos en **centavos enteros** (ver §7).
- **S4 — Servidor:** Linux (Docker + `cloudflared`). El desarrollo puede ser
  Windows/macOS/Linux con Bun instalado.
- **S5 — Un solo proceso** para web + chat + webhook de WhatsApp (suficiente por
  ahora). El chat corre en el mismo proceso HTTP; se puede separar en un worker
  aparte más adelante si hiciera falta. *(La pasarela Wompi futura añadirá su webhook
  al mismo proceso.)*

---

## 3. Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Runtime | **Bun** 1.3.14 (ejecuta TypeScript directo, sin bundler) |
| Lenguaje | TypeScript estricto, `verbatimModuleSyntax`, imports con extensión `.ts` |
| HTTP | `Bun.serve` + router propio (`core/router.ts`) |
| UI | HTML desde template strings en el servidor + **HTMX** para parciales |
| Datos | **SQLite** vía `bun:sqlite` (conexión única compartida) |
| Auth | Sesiones en cookie + **Google OAuth / OIDC** (`arctic`) |
| Pagos | **v1:** manual vía **Nequi** (transferencia + comprobante por chat, verificación en admin). *(Futuro: **Wompi** — Widget + webhook.)* |
| IA | **DeepSeek** (OpenAI-compatible) vía `@langchain/openai`; abstraído en `core/llm.ts` (v1; proveedor swappable) |
| Mensajería | **WhatsApp Cloud API** (Meta Graph API) |
| Publicación | **Cloudflare Tunnel** (`cloudflared`) → dominio propio |
| Empaquetado | Docker (imagen `oven/bun`) + volumen para `data/` |

Dependencias previstas (npm/bun):

- `@langchain/openai`, `@langchain/core` — cliente LLM.
- `arctic` — OAuth2/OIDC (Authorization Code + PKCE) para Google. *(Alternativa:
  `openid-client`.)*
- (Opcional) `@oslojs/crypto` / `@oslojs/encoding` — utilidades de tokens/estado
  si se quiere endurecer el manejo de `state`/PKCE sin `arctic`.

Sin frameworks de UI en el cliente, sin ORM, sin bundler.

---

## 4. Arquitectura general

Un **único proceso Bun** sirve todo. Cloudflare está delante (TLS, WAF, caché,
rate-limit) y enruta el tráfico por un túnel al puerto local.

```
                Internet (HTTPS, tu-dominio.com)
                          │
                 ┌────────▼─────────┐
                 │   Cloudflare      │  TLS, DDoS/WAF, caché de estáticos,
                 │   (edge)          │  rate limiting
                 └────────┬─────────┘
                          │  cloudflared tunnel (saliente desde el server)
                 ┌────────▼─────────────────────────────────────┐
                 │  Servidor (Bun.serve  ·  127.0.0.1:PORT)      │
                 │                                               │
                 │  Guard de auth  ─────────────────────────────│
                 │   ├─ Storefront público  (/ , /productos, …)  │
                 │   ├─ Carrito + checkout  (/carrito, /checkout)│
                 │   ├─ Admin (módulos)     (/admin/*)           │
                 │   ├─ Chat web (HTMX)     (/chat)              │
                 │   ├─ API chat            (/api/chat)          │  ← reutilizable
                 │   ├─ Webhook WhatsApp    (/api/whatsapp/…)    │
                 │   └─ OAuth               (/login, /auth/…)    │
                 │                                               │
                 │  Servicios: chatService · authService ·       │
                 │             orderService · repos (SQLite)     │
                 └───────────────┬───────────────────────────────┘
                                 │
                        ┌────────▼────────┐   ┌──────────────┐
                        │ data/app.sqlite │   │ DeepSeek API │
                        │ (WAL)           │   │ (LLM)        │
                        └─────────────────┘   └──────────────┘
```

Puntos clave:

- **Punto de entrada único:** `index.ts` construye el `Router`, registra los
  módulos (`registerModule`), monta las rutas de auth y despacha las peticiones. Las
  ramas públicas (storefront, webhooks, estáticos) se resuelven **antes** del guard
  de sesión.
- El **chat** es un servicio (`chatService`) invocado desde: la UI web (HTMX), el
  endpoint JSON `/api/chat` y el webhook de WhatsApp. Un solo cerebro, varias
  bocas.
- **Dinero, stock y órdenes** viven en SQLite; las mutaciones sensibles (pago,
  stock) pasan por servicios idempotentes.

---

## 5. Estructura de carpetas

```text
store-bun-sqlite-htmx/
  tech-spec.md              # este documento
  docs/
    mockups/                # mockups de referencia visual para los componentes (§15)
  package.json
  Dockerfile                # base oven/bun
  docker-compose.yml        # web (+ opcional cloudflared)
  .env.example
  data/                     # SQLite + comprobantes privados (git-ignored; .gitkeep)
    uploads/proofs/         # comprobantes de pago PRIVADOS (ver §8.2)
  public/
    fonts/                  # fuentes self-hosted (woff2)
    brand/                  # activos de marca (logo del nav, etc.)
      logo-htal.png         # logo usado en la barra de navegación (§15)
    uploads/                # imágenes de PRODUCTO públicas (ver §8.1)
  src/
    index.ts                # servidor: registra módulos, monta auth, despacha
    db.ts                   # conexión SQLite compartida + PRAGMAs (WAL)
    theme.ts                # tokens de diseño (única fuente de verdad)
    config.ts               # lectura tipada de env (PUBLIC_BASE_URL, secretos…)
    views.ts                # home del admin / dashboard
    globals.d.ts

    core/                   # plumbing (sin lógica de negocio)
      http.ts               # html / redirect / notFound / forbidden / json
      router.ts             # router ":param" + RouteContext
      modules.ts            # AppModule + registerModule / getModules
      permissions.ts        # can() / registerPermissions (Role, Action)
      repository.ts         # base Repository + paginate()
      readonly-sql.ts       # motor SELECT de solo lectura (chat admin/reportes)
      llm.ts                # cliente LLM compartido (v1: DeepSeek, OpenAI-compatible)
      dates.ts · csv.ts     # utilidades

    components/             # UI reutilizable (server-rendered)
      layout.ts             # shell HTML + @font-face + HTMX + escapeHtml
      nav.ts · card.ts · table.ts (dataTable) · forms.ts · badge.ts · alert.ts
      storefront/           # componentes públicos (ProductCard, carrito, chat FAB)

    auth/                   # subsistema de auth (NO es módulo)
      index.ts              # barrel: authService, guards, rutas
      auth.db.ts            # tablas users + sessions + oauth_identities; tipo User
      auth.service.ts       # hashing (fallback), sesiones, reglas de cuenta
      oauth.google.ts       # flujo OAuth/OIDC con Google (arctic)
      auth.routes.ts        # /login, /logout, /auth/google, /auth/callback, /account
      auth.rules.ts         # allowlist de admin, validaciones
      auth.views.ts         # pantalla de login + /account

    modules/                # dominios de la tienda (uno por carpeta)
      products/             # catálogo (admin CRUD + lectura pública)
      variants/             # variantes/ítems vendibles de cada producto
      categories/
      inventory/            # stock y movimientos de stock
      orders/               # órdenes + líneas + estados
      shipping/             # tarifas por ciudad + umbral de envío gratis
      content/              # textos editables (CMS ligero)
      feature-flags/
      users/               # gestión de cuentas/roles (admin)
      reports/              # NL→SQL de solo lectura (analítica admin)

    storefront/             # rutas públicas de la tienda (no admin)
      home.routes.ts · catalog.routes.ts · product.routes.ts
      cart.routes.ts · checkout.routes.ts

    chat/                   # asistente
      chat.service.ts       # cerebro compartido (tools + LLM loop)
      chat.tools.ts         # herramientas curadas (cliente)
      chat.history.ts       # persistencia + migración invitado→auth
      chat.web.routes.ts    # UI web (HTMX): /chat, /chat/send
      chat.api.routes.ts    # /api/chat (JSON, secreto compartido)

    integrations/
      whatsapp/             # webhook (verify + inbound) + envío (Graph API)
      # (futuro) wompi/     # firma de integridad + verificación de webhook

    migrations/             # migraciones versionadas para producción (ver §7)

    scripts/                # seed.ts, reset.ts, download-fonts.ts, backup.ts
```

---

## 6. Sistema de módulos

Cada dominio del admin es una carpeta en `src/modules/<nombre>/`. Todos los módulos
comparten la misma estructura, de modo que un módulo existente sirve de plantilla
para el siguiente:

| Archivo | Responsabilidad |
|---------|-----------------|
| `<n>.db.ts` | Subclase de `Repository`, `CREATE TABLE`, tipos de fila/entrada (solo si el módulo posee tabla). |
| `<n>.rules.ts` | Matriz `ModulePermissions` (por rol), constante-clave del módulo, validación de formularios. |
| `<n>.views.ts` | Funciones que renderizan HTML/HTMX. |
| `<n>.routes.ts` | `register<N>Routes(router)` — un handler por ruta. |
| `<n>.seed.ts` | Semilla de desarrollo opcional (usada por `bun seeddb`). |
| `index.ts` | `class <N>Module extends AppModule` + singleton exportado; `import "./<n>.db.ts"` como side-effect para crear la tabla al cargar. |

Reglas (obligatorias):

- **Permisos en dos lugares:** ocultar el control en la vista **y** devolver
  `forbidden()` en la ruta. La matriz por rol en `<n>.rules.ts` es la única fuente
  de verdad.
- **Acceso a datos solo por `Repository`** (conexión única `src/db.ts`). Listas
  paginadas en SQL (`paginate()`), nunca cargar tablas enteras en memoria.
- **Escapar** todo texto de usuario con `escapeHtml()` antes de interpolarlo.
- **Tokens de tema** en `theme.ts`; los componentes referencian `var(--token)`,
  nunca colores hardcodeados.
- **Listas con `dataTable()`** (responsive, búsqueda, filtros, paginación en SQL).

### Módulos "master data" vs. por-usuario

Hay dos tipos de módulos:

- **Master data compartida (no por-usuario):** `products`, `variants`,
  `categories`, `inventory`, `shipping`, `content` → todos ven lo mismo;
  `created_by` es solo auditoría.
- **Por-usuario:** `orders` se filtra por el cliente dueño (para "mis pedidos" y
  para el chat); en el admin, el staff con permiso ve todas.

---

## 7. Modelo de datos (SQLite)

### Convenciones

- **IDs:** **UUID texto** (`crypto.randomUUID()`) como `PRIMARY KEY` (`TEXT`) en
  **todas las tablas** de entidad. **No** se usan enteros autoincrementales en ninguna
  tabla: los IDs no son adivinables, lo que hace seguras las URLs, recibos y webhooks.
  Las **claves foráneas** son `TEXT` que referencian esos UUID. El ID lo **genera la
  app** al insertar (SQLite no lo autogenera); como los UUID no son secuenciales, el
  **orden** se hace por `created_at`.
  - *Excepciones (clave natural, nunca expuestas como ID secuencial):* `content.key`,
    `feature_flags.key`, `chat_migration_log.guest_ref` y la fila única de
    `shipping_config` (`id = 1`).
- **Dinero:** enteros en **centavos COP** (`*_cents`). Evita floats; el formateo a
  pesos ocurre solo en la vista. *(Encaja con `amount_in_cents` de Wompi cuando se
  integre.)*
- **Fechas:** texto ISO-8601 en columnas `*_at`. `date()` / `strftime()` para
  agrupar.
- **JSON:** columnas `text` con JSON serializado (p. ej. `images`, `attributes`).
- **Búsqueda sin acentos:** columna normalizada `*_search` (minúsculas + sin
  diacríticos, calculada en la app al escribir) consultada con `LIKE`, consistente
  con `paginate()`. *(Alternativa a futuro: FTS5 con `remove_diacritics`.)*
- **Aislamiento de datos:** lo dan los **permisos** (`can()`), el **scoping por
  `user_id`** en los repositorios y el **motor SELECT de solo lectura sobre vistas
  en allowlist** para la analítica (§14.2). No hay un mecanismo de seguridad a nivel
  de fila en la base; toda consulta pasa por un repositorio que aplica el scope.

### Estrategia de esquema (dev vs prod)

- **Desarrollo:** `CREATE TABLE IF NOT EXISTS` en cada `<n>.db.ts` + borrar
  `data/app.sqlite` para reiniciar el esquema desde cero.
- **Producción:** la tienda guarda datos reales (órdenes, pagos) que no se pueden
  perder, así que se aplica un mecanismo mínimo de **migraciones versionadas**
  (`PRAGMA user_version` + carpeta `src/migrations/NN_*.ts` aplicadas en orden al
  arrancar). *(Decisión O-6 en §20.)*

### Tablas (esquema propuesto)

> DDL ilustrativo, no final. Cada tabla vive en el `<n>.db.ts` de su módulo.

**Auth (subsistema `auth/`)**

```sql
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,           -- crypto.randomUUID()
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT,                     -- NULL si solo usa OAuth
  role          TEXT NOT NULL DEFAULT 'customer',  -- admin|manager|staff|customer
  display_name  TEXT NOT NULL DEFAULT '',
  avatar_url    TEXT,
  phone         TEXT,                     -- WhatsApp verificado (opcional; ver §14.5)
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_identities (
  id           TEXT PRIMARY KEY,           -- crypto.randomUUID()
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider     TEXT NOT NULL,             -- 'google'
  subject      TEXT NOT NULL,             -- 'sub' del id_token
  email        TEXT,
  created_at   TEXT NOT NULL,
  UNIQUE (provider, subject)
);

CREATE TABLE IF NOT EXISTS sessions (
  -- id = SHA-256 (hex) del token de sesión, NO el token en claro. El token
  -- (32 bytes aleatorios / crypto.randomUUID()) viaja solo en la cookie; en la BD
  -- se guarda su hash, así una fuga o lectura de la BD no permite secuestrar
  -- sesiones. Lookup: se hashea la cookie y se busca la fila (comparación en
  -- tiempo constante).
  id         TEXT PRIMARY KEY,            -- sha256(token) en hex
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
```

**Catálogo**

```sql
CREATE TABLE IF NOT EXISTS categories (
  id    TEXT PRIMARY KEY,                  -- crypto.randomUUID()
  name  TEXT NOT NULL,
  slug  TEXT NOT NULL UNIQUE,
  name_search TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS products (
  id           TEXT PRIMARY KEY,             -- crypto.randomUUID()
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  price_cents  INTEGER NOT NULL DEFAULT 0,   -- precio base
  discount_pct INTEGER NOT NULL DEFAULT 0,   -- 0..100 (opcional)
  category_id  TEXT REFERENCES categories(id),
  tags         TEXT NOT NULL DEFAULT '[]',   -- JSON array
  images       TEXT NOT NULL DEFAULT '[]',   -- JSON: [{url, alt?}]
  active       INTEGER NOT NULL DEFAULT 1,   -- publicado sí/no
  title_search TEXT NOT NULL DEFAULT '',
  created_by   TEXT,                         -- auditoría (user id)
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

-- Variante vendible (SKU). Si un producto no maneja variantes, tiene 1 "default".
CREATE TABLE IF NOT EXISTS variants (
  id             TEXT PRIMARY KEY,           -- crypto.randomUUID()
  product_id     TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku            TEXT UNIQUE,
  name           TEXT NOT NULL DEFAULT '',   -- p.ej. "Talla M / Rojo"
  attributes     TEXT NOT NULL DEFAULT '{}', -- JSON {talla:"M", color:"Rojo"}
  price_cents    INTEGER,                    -- override opcional; si NULL usa el del producto
  stock          INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 0,  -- alerta de bajo stock (0 = sin alerta)
  active         INTEGER NOT NULL DEFAULT 1
);
```

**Inventario / stock**

```sql
-- Bitácora de movimientos de stock (auditoría + fuente de verdad del stock).
CREATE TABLE IF NOT EXISTS stock_movements (
  id          TEXT PRIMARY KEY,            -- crypto.randomUUID()
  variant_id  TEXT NOT NULL REFERENCES variants(id),
  delta       INTEGER NOT NULL,             -- +entrada / -salida
  reason      TEXT NOT NULL,                -- 'purchase'|'sale'|'adjust'|'return'
  order_id    TEXT,                         -- si aplica
  created_by  TEXT,                         -- user id
  created_at  TEXT NOT NULL
);
```

> `variants.stock` es el saldo denormalizado; `stock_movements` es el histórico.
> Toda variación de stock escribe un movimiento **y** actualiza el saldo en una
> transacción. Semántica de descuento de stock en compra: ver §11 y O-1 (§20).

**Órdenes**

```sql
CREATE TABLE IF NOT EXISTS orders (
  id             TEXT PRIMARY KEY,          -- UUID (expuesto)
  user_id        TEXT REFERENCES users(id),     -- NULL si invitado
  guest_ref      TEXT,                      -- UUID de invitado (cookie / WhatsApp)
  customer_name  TEXT NOT NULL DEFAULT '',
  customer_phone TEXT,
  customer_email TEXT,
  status         TEXT NOT NULL DEFAULT 'pending',
                  -- pending|payment_review|paid|preparing|shipped|delivered|cancelled|refunded
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  shipping_cents INTEGER NOT NULL DEFAULT 0,
  total_cents    INTEGER NOT NULL DEFAULT 0,
  shipping_dept  TEXT,
  shipping_city  TEXT,
  shipping_addr  TEXT,
  notes          TEXT,
  tracking_code  TEXT,
  payment_method TEXT NOT NULL DEFAULT 'nequi',   -- v1: 'nequi' (manual). Futuro: 'wompi'
  payment_ref    TEXT UNIQUE,               -- referencia del pago (mostrada al cliente)
  payment_proof_url TEXT,                    -- ruta INTERNA del comprobante (privado, §8.2), no URL pública
  payment_verified_by TEXT REFERENCES users(id),     -- admin que verificó la transferencia
  paid_at        TEXT,                       -- cuándo se confirmó el pago
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id              TEXT PRIMARY KEY,          -- crypto.randomUUID()
  order_id        TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  variant_id      TEXT REFERENCES variants(id),
  product_title   TEXT NOT NULL,            -- snapshot al momento de comprar
  variant_name    TEXT NOT NULL DEFAULT '',
  sku             TEXT,
  qty             INTEGER NOT NULL,
  unit_price_cents INTEGER NOT NULL
);
```

**Envíos**

```sql
CREATE TABLE IF NOT EXISTS shipping_rates (
  id             TEXT PRIMARY KEY,           -- crypto.randomUUID()
  department     TEXT NOT NULL,
  city           TEXT NOT NULL,
  price_cents    INTEGER NOT NULL,
  estimated_days INTEGER,
  UNIQUE (department, city)
);

CREATE TABLE IF NOT EXISTS shipping_config (
  id              INTEGER PRIMARY KEY CHECK (id = 1),  -- fila única
  free_above_cents INTEGER                              -- umbral de envío gratis
);
```

**Contenido (CMS ligero) y flags**

```sql
CREATE TABLE IF NOT EXISTS content (
  key        TEXT PRIMARY KEY,   -- p.ej. 'logistics_payment', 'logistics_shipping'
  value      TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feature_flags (
  key     TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0
);
```

**Chat**

```sql
CREATE TABLE IF NOT EXISTS chat_messages (
  id          TEXT PRIMARY KEY,   -- crypto.randomUUID()
  ref         TEXT NOT NULL,      -- identidad de conversación (user_id o guest UUID)
  channel     TEXT NOT NULL,      -- 'auth' | 'web_guest' | 'whatsapp'
  role        TEXT NOT NULL,      -- 'user' | 'assistant'
  content     TEXT NOT NULL DEFAULT '',
  attachment_url  TEXT,           -- imagen adjunta (p. ej. comprobante de pago Nequi)
  attachment_type TEXT,           -- MIME del adjunto (image/jpeg, image/png)
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_ref ON chat_messages(ref, created_at);

CREATE TABLE IF NOT EXISTS chat_migration_log (
  guest_ref    TEXT PRIMARY KEY,
  auth_user_id TEXT NOT NULL REFERENCES users(id),
  created_at   TEXT NOT NULL
);
```

**Reportes (analítica admin)**

```sql
CREATE TABLE IF NOT EXISTS reports (
  id         TEXT PRIMARY KEY,             -- crypto.randomUUID()
  title      TEXT NOT NULL,
  prompt     TEXT NOT NULL DEFAULT '',
  sql        TEXT NOT NULL,
  chart_type TEXT NOT NULL DEFAULT 'table',
  config     TEXT NOT NULL DEFAULT '{}',   -- JSON {labelColumn, valueColumns}
  created_by TEXT,                         -- user id
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

---

## 8. Almacenamiento de imágenes/archivos

Hay **dos clases de archivos** con requisitos de acceso distintos.

### 8.1 Imágenes de producto (públicas)

**Recomendado (v1):** **disco local** del servidor bajo `public/uploads/` (o un
directorio en el volumen `data/`), servido por Bun con `cache-control` inmutable y
**cacheado por Cloudflare** en el edge. Los nombres se generan con hash/UUID.

- Subida: formulario del admin → handler que valida (§8.3) y guarda la URL relativa
  en `products.images` (JSON).
- Servido: ruta estática con verificación estricta del nombre (bloquear path
  traversal, sin `/` en el nombre resuelto).

### 8.2 Comprobantes de pago Nequi (privados)

Los comprobantes contienen **PII financiera** (transferencia, teléfono, saldo) y
**NO** pueden vivir en `public/` ni cachearse en el edge:

- Se guardan **fuera de la raíz pública** (p. ej. `data/uploads/proofs/`); **nunca**
  se sirven como estáticos.
- Se sirven **solo por una ruta con guard** (`GET /orden/:id/comprobante`) que exige
  que el solicitante sea el **dueño de la orden** (por sesión / `guest_ref`) o un
  **admin** con permiso en `orders`. Respuesta con `Cache-Control: private, no-store`
  y `X-Content-Type-Options: nosniff`.
- `orders.payment_proof_url` guarda una **clave/ruta interna**, no una URL pública.

### 8.3 Validación de subidas (ambas clases)

- **Tipo real por *magic bytes*** (cabecera del archivo), **no** por el `content-type`
  del cliente ni por la extensión (ambos falsificables).
- **Allowlist ráster:** `image/jpeg`, `image/png`, `image/webp`. **SVG rechazado**
  (puede llevar scripts → XSS si se sirviera inline).
- **Tamaño máximo** por archivo; re-encode/normalización de la imagen cuando sea
  posible (elimina payloads embebidos).
- Nombre de destino generado por la app (hash/UUID); nunca se usa el nombre del
  cliente.

### 8.4 Alternativa (escala/durabilidad)

**Cloudflare R2** (S3-compatible) u otro almacén de objetos; la app guarda solo la
clave/URL. Los comprobantes irían a un bucket **privado** con URLs firmadas de corta
duración. Migrable después sin tocar el modelo (la columna sigue siendo una
referencia).

*(Decisión O-2 en §20.)*

---

## 9. Storefront público

Rutas públicas (sin sesión), servidas **antes** del guard de auth:

| Ruta | Descripción |
|------|-------------|
| `GET /` | Home: grilla de productos destacados/activos. |
| `GET /productos` | Catálogo con búsqueda + filtro por categoría + paginación (HTMX). |
| `GET /productos/:id` | Detalle: imágenes, descripción, selector de variante, precio, stock, botón agregar/comprar. |
| `GET /categorias/:slug` | Catálogo filtrado por categoría. |
| `GET /carrito` | Carrito. |
| `GET /checkout` | Datos de envío + resumen + **instrucciones de pago Nequi** (monto + `payment_ref`). |
| `GET /checkout/resultado` | Estado de la orden + recordatorio de enviar el comprobante por el chat. |
| `GET /orden/:id` · `POST /orden/:id/comprobante` | Estado de una orden y **subida del comprobante Nequi** (imagen, §8.2/§8.3); disponible sin depender del chat (F4). |
| `GET /nosotros` , `GET /pagos-envios` | Páginas de contenido (desde `content`). |

Patrón: cada página es una función que devuelve HTML server-rendered. La
interactividad (buscar, paginar, agregar al carrito, chat) usa **HTMX** (`hx-get`,
`hx-post` que devuelven fragmentos). El catálogo se cachea en Cloudflare.

---

## 10. Carrito y checkout

**Carrito** (dos opciones, se recomienda la primera):

- **Cookie/servidor:** el carrito se guarda server-side referenciado por la cookie
  **única de invitado** (`guest_ref`, la misma que usan el chat y `orders.guest_ref`),
  de modo que HTMX puede renderizar el mini-carrito y el total sin estado en el
  cliente. Simple y consistente con el enfoque server-rendered.
- *(Alternativa:* `localStorage` + un poco de JS; se aleja del estilo HTMX puro.)*

**Checkout (v1 — pago manual Nequi):**

1. Cliente completa datos de envío (departamento/ciudad → calcula
   `shipping_cents` con `shipping_rates` y el umbral `free_above_cents`).
2. Se **crea la orden en estado `pending`** con snapshot de líneas y totales, y se
   genera `payment_ref` (UUID) para identificar la transferencia (§11).
3. Se muestran las **instrucciones de pago Nequi** (número/QR, monto exacto y
   `payment_ref`) y se ofrece **subir el comprobante (imagen)** desde la propia
   página de la orden (`POST /orden/:id/comprobante`) o, adicionalmente, **por el
   chat** (§14).
4. El cliente transfiere y sube el comprobante (página de orden o chat) → la orden
   pasa a `payment_review`; un **admin verifica** y la marca `paid` (§11).
   `/checkout/resultado` muestra el estado actual de la orden.

Validaciones de servidor: recalcular precios y envío **en el servidor** (nunca
confiar en montos del cliente), verificar stock disponible antes de crear la orden.

---

## 11. Pagos

### v1 — Pago manual vía Nequi

En v1 **no hay pasarela automática**: el cobro es una **transferencia Nequi**
verificada manualmente por el staff.

1. Al confirmar el checkout se crea la orden en `pending` con `payment_ref` (UUID),
   `payment_method='nequi'` y los totales calculados en el servidor.
2. Se muestran las **instrucciones de pago**: número/QR de Nequi, **monto exacto**
   (`total_cents`) y la referencia `payment_ref`.
3. El cliente transfiere desde su app Nequi y **envía el comprobante (imagen)**. Hay
   **dos vías equivalentes**: (a) el **endpoint de subida propio de la página de
   orden/checkout** (`POST /orden/:id/comprobante`, disponible desde F4 sin depender
   del chat) y (b) **adjuntarlo por el chat** (web siempre; WhatsApp solo clientes
   `auth` con teléfono verificado, §14.7), disponible a partir de F6. El chat es un
   canal **adicional**, no el único.
4. Al recibir el comprobante, la app lo valida y guarda (§8), lo asocia a la orden
   (`payment_proof_url`) y mueve la orden a **`payment_review`**.
5. Un **admin/staff** con permiso revisa el comprobante en el módulo `orders` y:
   - **Aprueba** → orden `paid`, con `paid_at` y `payment_verified_by`, y se
     **descuenta stock** (escribe `stock_movements` reason `sale` + baja saldo) en
     **una transacción** SQLite.
   - **Rechaza** → la orden vuelve a `pending` (o `cancelled`), con nota del motivo.

**Idempotencia y seguridad:**

- El stock se descuenta **una sola vez**, al pasar a `paid` (condicionado al estado
  previo para evitar doble descuento).
- Los **montos se recalculan en el servidor**; el comprobante es evidencia, no la
  fuente de verdad del monto.
- La verificación es **humana** en v1: no se interpreta el contenido de la imagen de
  forma automática.
- El comprobante (imagen) se valida por **magic bytes**/tamaño (§8.3) y se guarda en
  almacenamiento **privado** con acceso por guard (§8.2, §16); nunca es público.

### Semántica de stock

- Se descuenta **al aprobar el pago** (paso a `paid`), no al crear la orden
  `pending`, para no bloquear inventario por checkouts abandonados.
- Opcional: "reserva blanda" con expiración durante el checkout activo. *(O-1, §20.)*

### Futuro — Pasarela Wompi (automática)

Cuando se integre Wompi (COP) se sustituye la verificación manual por confirmación
automática, reutilizando el mismo modelo de órdenes (`payment_method='wompi'`):

- **Firma de integridad (checkout):** SHA-256 de `reference + amount_in_cents +
  currency + WOMPI_INTEGRITY_SECRET`; el Widget recibe `public-key`, `currency=COP`,
  `amount-in-cents`, `reference`, `signature:integrity` y `redirect-url`.
- **Webhook autoritativo** (`POST /api/wompi/webhook`): verificar `signature.checksum`
  (SHA-256 de las propiedades + `timestamp` + `WOMPI_EVENTS_SECRET`), buscar la orden
  por `payment_ref` y, si `transaction.status == APPROVED`, marcar `paid` + descontar
  stock en una transacción. **Idempotente** por id de transacción.
- **Defensa en profundidad:** en `/checkout/resultado`, confirmar el estado también
  contra la **API de transacciones de Wompi** (no confiar solo en el redirect).
- Variables `WOMPI_*` (§18) y carpeta `integrations/wompi/` (§5).

---

## 12. Panel de administración

`/admin/*`, detrás del guard de sesión y de `requireAdmin`/permisos. Cada área es un
**módulo** (§6). Alcance v1 (D3):

| Módulo | Ruta base | Funciones | Acciones típicas por rol |
|--------|-----------|-----------|--------------------------|
| `products` | `/admin/productos` | CRUD de productos, imágenes, activar/desactivar | admin/manager: todo; sales/logistic: ver |
| `variants` | anidado en producto | CRUD de variantes (SKU, atributos, precio, stock inicial) | admin/manager |
| `categories` | `/admin/categorias` | CRUD categorías | admin/manager |
| `inventory` | `/admin/inventario` | Ajustes de stock, ver movimientos, **alertas de bajo stock** (`variants.low_stock_threshold`) | admin/manager/logistic |
| `orders` | `/admin/ordenes` | Listar/filtrar, ver detalle, cambiar estado, tracking | admin/manager/logistic/sales |
| `shipping` | `/admin/envios` | Tarifas por ciudad + umbral gratis | admin/manager |
| `content` | `/admin/contenido` | Editar textos (pagos, envíos, nosotros…) | admin/manager |
| `feature-flags` | `/admin/flags` | Activar/desactivar features | admin |
| `users` | `/admin/usuarios` | Gestionar cuentas y **roles**, allowlist admin | admin |
| `reports` | `/admin/reportes` | **Chat analítico NL→SQL** + guardar reportes/gráficas | admin/manager/financial |

Patrones:

- Todas las listas usan `dataTable()` (responsive, búsqueda debounced por HTMX,
  filtros, paginación en SQL).
- Cada capacidad gateada en vista **y** ruta con `can(user, MODULE, action)`.
- Formularios con los componentes compartidos (`textField`, `selectField`, …); los
  fragmentos HTMX reutilizan el CSS global (no `<style>` por fragmento).

El **dashboard** (`/`) del admin muestra tarjetas por módulo según permisos (cada
módulo aporta su propia tarjeta).

---

## 13. Autenticación y autorización

El subsistema `auth/` combina **sesiones propias en cookie** (tabla `sessions`) con
**login por OAuth**. La clave del diseño: **cualquier método de login termina
creando una sesión en la tabla `sessions`**, así el resto de la app no distingue el
método.

### 13.1 Identidad del cliente (D1)

- **Invitado por defecto:** puede navegar, agregar al carrito y **comprar** sin
  cuenta. Se le asigna **un único `guest_ref` (UUID)** en una sola cookie
  (`guest_ref`, larga duración) que identifica **carrito, chat y `orders.guest_ref`**
  a la vez, de modo que el comprobante enviado por el chat siempre puede asociarse a
  la orden del invitado (§14.7).
- **Cuenta opcional con Google OAuth:** al iniciar sesión se crea/vincula un `user`
  con `role='customer'`, y se **migra** su historial de chat y (opcional) sus
  órdenes de invitado (por `guest_ref`) a la cuenta (§14, migración).

### 13.2 Admin/staff (D6)

- **Google OAuth** con **lista blanca** de correos autorizados (`ADMIN_ALLOWLIST`)
  y/o dominio corporativo. Al primer login de un correo en la allowlist se crea el
  `user` con el rol correspondiente (o se promueve desde `users`).
- Los **roles** viven en la BD (`users.role`) y gobiernan permisos vía `can()`.

### 13.3 Flujo OAuth / OIDC en Bun

Authorization Code + **PKCE** con `arctic` (o `openid-client`):

```
GET /login              → pantalla con "Entrar con Google"
GET /auth/google        → genera state + PKCE, setea cookies temporales,
                          redirige a Google
GET /auth/callback      → valida state, intercambia code por tokens,
                          valida id_token (sub, email, email_verified),
                          upsert user + oauth_identity, crea sesión, redirige
GET /logout             → destruye sesión, limpia cookie
```

- **Redirect URI** (registrado en Google Cloud Console):
  `https://tu-dominio/auth/callback` (Cloudflare termina TLS).
- **Protección de open redirect:** validar el parámetro `next` (debe empezar por
  `/` y no por `//`).
- **Cookies de sesión:** `HttpOnly`, `SameSite=Lax`, `Secure` en producción (la app
  está detrás de HTTPS de Cloudflare), `Path=/`, `Max-Age` = TTL de sesión.
- **Token opaco hasheado:** la cookie lleva un token aleatorio (≥128 bits); en
  `sessions` se guarda **solo su SHA-256** (§7). Al leer, se hashea la cookie y se
  busca la fila (comparación en tiempo constante). Una fuga de la BD no revela
  tokens de sesión válidos.

### 13.4 Roles y permisos

Motor `can()` / `registerPermissions`. Conjunto de roles propuesto (extensible):

| Rol | Uso |
|-----|-----|
| `admin` | Control total (incl. flags, usuarios). |
| `manager` | Gestión de catálogo, órdenes, envíos, contenido, reportes. |
| `sales` | Órdenes (ver/gestionar), sin borrar catálogo. |
| `logistic` | Inventario y despacho de órdenes. |
| `financial` | Reportes/analítica. |
| `customer` | Sin acceso a `/admin`; solo su perfil, sus órdenes y el chat. |

Deny-by-default: si un módulo no lista el rol, no puede.

### 13.5 Opciones de auth documentadas (para decisión final)

Aunque D1/D6 fijan la vía recomendada (**OAuth Google**), se dejan las alternativas
por si cambian los requisitos:

| Opción | Descripción | Pros | Contras |
|--------|-------------|------|---------|
| **A. Email+contraseña** | Argon2id vía `Bun.password` + sesiones. | Cero dependencias externas; autoalojado; funciona offline. | Gestionas contraseñas/reset; sin MFA de fábrica; más superficie de phishing. |
| **B. OAuth/OIDC** (Google) — **elegida** | Authorization Code + PKCE con `arctic`; sesión propia. | No almacenas contraseñas; MFA lo da Google; mejor UX/seguridad. | Dependes del proveedor; requiere config de client id/secret y redirect URIs. |
| **C. Híbrida** | OAuth para la mayoría + contraseña como respaldo de emergencia (feature-flag). | Continuidad si el proveedor falla. | Más código y dos caminos que mantener. |

**Recomendación:** **B** (OAuth Google) para admin y cliente, con `sessions`
unificadas. Mantener el servicio de contraseñas presente pero **desactivado por
defecto** (permite habilitar C sin reescribir nada).

---

## 14. Chat / Asistente IA (multicanal)

Un **servicio único** (`chat.service.ts`) es el cerebro; se invoca desde la web
(HTMX), desde `/api/chat` (JSON) y desde el webhook de WhatsApp. Frontera de
seguridad clara según el canal (D5).

### 14.1 Canales e identidad

| Canal | Identidad (`ref`) | Almacenamiento |
|-------|-------------------|----------------|
| `auth` | `user_id` | `chat_messages` |
| `web_guest` | UUID en cookie única `guest_ref` (larga duración; la misma del carrito) | `chat_messages` |
| `whatsapp` | UUID derivado/asociado al número de teléfono | `chat_messages` |

### 14.2 Acceso a datos (frontera de seguridad, D5)

- **Cliente (`auth`, `web_guest`, `whatsapp`): solo herramientas curadas.** Nada de
  SQL libre. Herramientas (function-calling):

  | Herramienta | Descripción | Restricción |
  |-------------|-------------|-------------|
  | `query_products` | Catálogo con stock. | Pública |
  | `query_categories` | Categorías. | Pública |
  | `query_variants` | Variantes/SKU. | Pública |
  | `query_shipping` | Tarifas por ciudad + umbral gratis. | Pública |
  | `query_content(key)` | Texto de contenido por clave (pagos, envíos…). | Pública |
  | `create_order(...)` | Crea orden `pending` para el usuario de la sesión. | **Solo `auth`** |
  | `get_my_orders()` | Últimas órdenes del propio usuario. | **Solo `auth`** |
  | `get_order_status(order_id)` | Estado/tracking de *su* orden. | **Solo `auth`** |

  **Identidad NO expuesta al LLM (anti-IDOR):** ninguna herramienta recibe `ref` /
  `user_id` como argumento. La identidad se **inyecta server-side** desde la sesión
  al ejecutar el handler (closure sobre el contexto de la petición), de modo que un
  *prompt injection* no puede pedir datos de otra cuenta. El modelo solo aporta datos
  no sensibles (p. ej. `order_id`) y el handler **valida en el servidor** que ese
  `order_id` pertenece al `ref` autenticado antes de devolver nada; si no, responde
  "no encontrado". Las herramientas de orden se **bloquean para invitados**
  (`web_guest`, `whatsapp`), devolviendo "requiere iniciar sesión".

- **Admin (`reports`): NL→SQL de solo lectura.** Motor `core/readonly-sql.ts`:
  - Conexión SQLite **separada de solo lectura** (`readonly: true` + `PRAGMA
    query_only`).
  - **Control primario = allowlist positiva sobre VISTAS de analítica** (p. ej.
    `v_orders`, `v_order_items`, `v_products`, `v_stock`), no sobre las tablas base.
    Las vistas **excluyen por construcción** tablas y columnas sensibles: `users`,
    `sessions`, `oauth_identities`, `password_hash` y PII de clientes
    (teléfono/email/dirección). El generador solo "conoce" esas vistas; jamás recibe
    el esquema de las tablas base.
  - El SQL se **parsea (AST)**, no se filtra por strings: se exige **una sola
    sentencia `SELECT`/`WITH`** y se **rechaza** cualquier referencia a un objeto
    fuera del allowlist de vistas, así como `PRAGMA`/`ATTACH`/acceso a `sqlite_*`.
    *(El blocklist de tokens es solo defensa en profundidad, nunca el control
    principal: es evadible con alias, `hex()`, CTEs, subconsultas, etc.)*
  - **Reautorización en ejecución:** el allowlist efectivo de vistas se deriva de los
    permisos del usuario admin **al ejecutar** (no al crear el reporte), para que un
    reporte guardado no eleve privilegios.
  - Límite de filas (`MAX_REPORT_ROWS`) y **timeout** para evitar consultas costosas
    (joins cartesianos → DoS).
  - Solo accesible a roles con permiso en `reports`. **Un cliente nunca ejecuta
    SQL generado.**

### 14.3 Bucle del asistente (function-calling)

Mensajes → LLM con `bindTools(TOOLS)` → si hay `tool_calls`, ejecutar handlers (con
el gate por canal) → repetir hasta `MAX_STEPS` o respuesta final. El prompt incluye
un *snapshot* del estado de la tienda (categorías, claves de contenido disponibles,
políticas). El LLM se accede vía `core/llm.ts` (v1: DeepSeek, proveedor swappable) y
responde siempre en **español** (S1).

### 14.4 Endpoints

| Ruta | Uso | Auth |
|------|-----|------|
| `GET /chat` | UI del chat (web), abre el panel/FAB. | Sesión o invitado |
| `POST /chat/send` | Envía mensaje (texto o **imagen**: comprobante de pago); devuelve **fragmento HTML** (burbujas) por HTMX. | Cookie sesión / `guest_ref` |
| `POST /api/chat` | Superficie **reutilizable** JSON: `{ channel, ref, message } → { reply }`. Canal de **confianza server-to-server de clase invitado**: **rechaza `channel:'auth'`** y **no habilita** las tools `auth`-only (§14.2); `ref` solo agrupa la conversación, nunca concede acceso a órdenes de un `user`. | **Secreto compartido** (`Authorization: Bearer CHAT_API_SECRET`) |

El webhook de WhatsApp llama a `chatService` **directamente** (mismo proceso). El
endpoint `/api/chat` existe para otros canales/integraciones/pruebas y para cumplir
el requisito de "un endpoint de la misma app reutilizable". Como el secreto
compartido **no autentica a un cliente concreto**, este endpoint opera siempre en
**clase invitado**: no puede pasar `channel:'auth'` ni un `ref` que corresponda a un
`user`, de modo que un poseedor del secreto **no puede suplantar** ni leer órdenes de
otra cuenta (anti-IDOR, §14.8). Los canales autenticados llegan únicamente por la web
(sesión) o por WhatsApp con teléfono verificado (§14.5).

### 14.5 WhatsApp Cloud API (D4)

Dentro de `integrations/whatsapp/`:

- **Verificación (GET `/api/whatsapp/webhook`):** comparar `hub.mode=subscribe` y
  `hub.verify_token == WHATSAPP_VERIFY_TOKEN`; responder `hub.challenge`.
- **Entrada (POST `/api/whatsapp/webhook`):**
  1. Verificar `X-Hub-Signature-256` = HMAC-SHA256 del **cuerpo crudo** con
     `WHATSAPP_APP_SECRET`.
  2. Extraer teléfono + texto del mensaje.
  3. Resolver `ref` (UUID por teléfono; si el número está vinculado a un `user`,
     usar canal `auth`).
  4. `reply = await chatService.generateResponse({ channel: 'whatsapp', ref, text })`.
  5. Enviar respuesta con **Graph API**: `POST /{PHONE_NUMBER_ID}/messages` con
     `WHATSAPP_TOKEN`.
- **Vinculación teléfono→cuenta (self-service, verificada):** un número solo se
  asocia a un `user` tras **verificación**: desde `/account` el cliente registra su
  teléfono y la app envía un **código por WhatsApp** que el cliente confirma; recién
  entonces se guarda `users.phone` y el webhook trata ese número como canal `auth`.
  Sin verificación, el número opera como invitado (sin acceso a órdenes). Así nadie
  puede reclamar el teléfono de otra persona.
- URL pública del webhook: `https://tu-dominio/api/whatsapp/webhook` (Cloudflare).

### 14.6 Persistencia, historial y migración

- Cada turno guarda `user` y `assistant` en `chat_messages` (por `ref`+`channel`).
- El prompt usa el historial reciente por `ref`.
- **Migración invitado→auth:** al iniciar sesión, `migrateChatSession(guestRef,
  userId)` reasigna los mensajes del invitado al `user` y registra el mapeo en
  `chat_migration_log`. **Vinculación tardía de WhatsApp:** si un número ya migró,
  el webhook usa el `user` correcto (consulta `chat_migration_log`).

### 14.7 Comprobante de pago (Nequi manual, v1)

El chat es el canal por el que el cliente **envía el comprobante** de su
transferencia Nequi (§11):

- **Web:** el compositor admite **adjuntar una imagen** (`input file`, `hx-post`
  multipart); disponible para invitado y `auth`. **WhatsApp (solo clientes `auth` con
  teléfono verificado, §14.5):** se recibe el `image` del mensaje entrante y se
  descarga el media por la Graph API. Un número **no vinculado** no puede asociar
  comprobantes a una orden (opera como invitado sin acceso a órdenes); ese cliente
  usa la **web** (chat o página de orden) para enviar el comprobante.
- La imagen se **valida** (magic bytes/tamaño, §8.3) y se **guarda en almacenamiento
  privado** (§8.2); el mensaje se registra en `chat_messages` con
  `attachment_url`/`attachment_type` (referencia interna, servida por guard, no URL
  pública).
- Si el `ref` tiene una orden en `pending` esperando pago, se asocia como
  `payment_proof_url` y la orden pasa a **`payment_review`**; el asistente confirma
  la recepción e informa que un asesor validará el pago.
- Un **admin** verifica el comprobante en el módulo `orders` (→ `paid` + descuento de
  stock, §11). El adjunto se maneja **fuera del LLM** (la imagen no se envía al
  modelo); el bucle de tools no cambia.

### 14.8 Seguridad del chat (resumen)

- **Identidad server-side (anti-IDOR):** las tools **no** reciben `ref`/`user_id`; se
  inyecta desde la sesión y el handler valida pertenencia antes de responder.
- Invitados: herramientas de orden bloqueadas.
- Cliente: **sin** SQL generado por IA.
- Admin: SQL **solo lectura** sobre **vistas en allowlist** (sin `users`/`sessions`/
  PII), parseado por AST; conexión de solo lectura; reautorización por rol en
  ejecución.
- `/api/chat`: secreto compartido; rate-limit (Cloudflare + app).
- Comprobantes: almacenamiento **privado** con guard (§8.2); la imagen no se envía al
  LLM.
- Todo texto renderizado en la web pasa por `escapeHtml()`.

---

## 15. UI / Theming

- **HTMX** para toda interactividad (buscar, paginar, agregar al carrito, enviar
  mensajes de chat, cambiar estado de orden). Respuestas = fragmentos HTML.
- **Tokens de diseño en `theme.ts`** (colores, espaciado, tipografía, radios) como
  variables CSS en `:root`; los componentes referencian `var(--token)`, nunca colores
  hardcodeados. La identidad es el tema **CRISTA**: tipografía **serif** para
  titulares y **sans** para el cuerpo (fuentes self-hosted) y la **paleta** definida
  abajo.
- **Componentes compartidos** (`components/`): `layout`, `nav`, `card`,
  `dataTable`, `forms`, `badge`, `alert`, + `storefront/` (ProductCard, carrito,
  chat FAB). Cada componente **posee su CSS**, agregado globalmente por `layout.ts`
  (así los fragmentos HTMX quedan estilizados sin enviar `<style>`).
- **Logo / marca:** el componente `nav.ts` muestra el logo de la tienda desde
  `public/brand/logo-htal.png` (servido por Bun con caché inmutable, igual que las
  fuentes). Enlaza a `/` (home), usa `alt` descriptivo y `width`/`height` fijos para
  evitar *layout shift*. Otras variantes de logo viven en `public/brand/`.
- **Mobile-first:** listas colapsan a tarjetas `label: valor` bajo 640px
  (`dataTable`).
- Fuentes self-hosted en `public/fonts/` servidas por Bun con caché inmutable.

### Paleta y tokens (tema CRISTA)

Valores canónicos del tema (marfil de fondo, acento burdeos, marrones cálidos,
hairlines y sombras suaves). `theme.ts` los expone en `:root` como **única fuente de
verdad**; los componentes usan `var(--token)`:

```css
:root {
  /* Paleta base */
  --bg: #f8f5f0;                 /* marfil / off-white */
  --fg: #3f2f27;                 /* marrón cálido profundo (texto) */
  --card: #efe7dc;               /* panel arena */
  --muted: #8b7565;              /* marrón apagado (texto secundario) */
  --accent: #7b1e2e;             /* burdeos / vino */
  --accent-foreground: #f8f5f0;  /* marfil sobre burdeos */
  --accent-hover: #651825;       /* burdeos más oscuro */

  /* Extras de marca */
  --sage: #aab7a0;
  --terracotta: #c47d5a;
  --gold: #8b6f4d;

  /* Estructura (hairlines + tinta suave) */
  --surface: #fffdfa;            /* superficie de tarjeta casi blanca */
  --border: #d8ccbb;             /* hairline botánico */
  --border-strong: #c9b9a4;
  --border-disabled: #cbc3b8;
  --shadow: rgba(107, 86, 72, 0.16);

  /* Semántica: estados y feedback */
  --danger: #d9a7a2;
  --success: #aab7a0;            /* sage */
  --warning: #d8b46a;
  --error-bg: #f7ebe9;  --error-border: #9b3b2c;  --error-text: #9b3b2c;
  --ok-bg: #eef1ea;     --ok-border: #6f7d61;     --ok-text: #5c6a4e;

  /* Radios (modestos, editoriales) */
  --radius-btn-sm: 0.125rem;  --radius-btn-md: 0.125rem;
  --radius-btn-lg: 0.125rem;  --radius-btn-xl: 0.125rem;  /* CTA rectangular */
  --radius-btn-icon: 0.25rem; --radius-card: 0.375rem;

  /* Sombras suaves (desenfocadas) */
  --shadow-soft-sm: 0 1px 3px rgba(107, 86, 72, 0.10);
  --shadow-soft:    0 2px 10px rgba(107, 86, 72, 0.12);
  --shadow-soft-lg: 0 8px 28px rgba(107, 86, 72, 0.16);
  --shadow-card:    var(--shadow-soft);
}
```

### Referencias visuales (mockups)

Mockups de referencia del tema CRISTA para guiar la construcción de los componentes.
Son **solo referencia de diseño** (no se sirven al público); viven en `docs/mockups/`:

| Archivo | Pantalla | Notas |
|---------|----------|-------|
| `storefront-home.png` | Home público | Nav con logo CRISTA, hero “Colección CRISTA” + CTA burdeos, grilla de productos. |
| `storefront-catalog.png` | Catálogo | Panel de filtros (buscar + tags), tarjetas de producto con precio y “Ver detalle”. |
| `storefront-product-cards.png` | Tarjetas de producto | Selectores de variante (talla/color/modelo) + botón “AGREGAR AL CARRITO”. |
| `chat-assistant.png` | Chat / Asistente | Vista `/chat` con saludo inicial y compositor “Escribe tu pregunta…”. |
| `admin-products.png` | Admin → Productos | Tabs de módulos, “Gestionar productos”, lista con Editar/Eliminar y “NUEVO PRODUCTO”. |

> Guardar los PNG en `docs/mockups/` con exactamente esos nombres.

---

## 16. Seguridad (transversal)

| Área | Medida |
|------|--------|
| Transporte | HTTPS terminado en Cloudflare; app en `127.0.0.1`; `Secure` cookies en prod; HSTS en Cloudflare. |
| Sesiones | Cookie `HttpOnly` + `SameSite=Lax`; **token opaco hasheado (SHA-256) en la BD**, nunca en claro; comparación en tiempo constante; TTL con expiración validada en cada lectura; limpieza de expiradas. |
| OAuth | `state` + PKCE; validación de `id_token` (`sub`, `email_verified`); allowlist para admin. |
| XSS | `escapeHtml()` en todo texto de usuario interpolado. |
| CSRF | Cookies `SameSite=Lax` (no viajan en POST cross-site) **+ token CSRF** por sesión en todos los formularios/acciones mutantes (checkout, admin, `/chat/send`, subida de comprobante): campo oculto/encabezado validado en el servidor. Webhooks y `/api/chat` usan firma/secreto en vez de cookie, así que no dependen de CSRF. |
| Cabeceras / CSP | `Content-Security-Policy` restrictiva (`default-src 'self'`; sin JS inline salvo hashes; `frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`; HSTS en Cloudflare. |
| SQL | Repos parametrizados; motor de reportes de **solo lectura** sobre **vistas de analítica en allowlist** (sin `users`/`sessions`/PII), SQL parseado por AST; blocklist de tokens solo como defensa en profundidad. |
| Pagos (v1) | Verificación **manual** del comprobante Nequi por staff; montos recalculados en el servidor; descuento de stock idempotente al aprobar; comprobante validado por tipo/tamaño. *(Futuro Wompi: firma de integridad + firma de webhook + confirmación server-side.)* |
| Webhooks | Verificación de firma del webhook de WhatsApp (`X-Hub-Signature-256`); rechazo si no coincide. *(Wompi `checksum`: al integrar la pasarela.)* |
| Autorización | `can()` en vista **y** ruta; deny-by-default. |
| Subidas | Validación por **magic bytes** (no solo `content-type`/extensión); solo ráster jpeg/png/webp, **SVG rechazado**; re-encode cuando se pueda; nombres con hash; anti path-traversal; servido con `X-Content-Type-Options: nosniff`. |
| Comprobantes de pago | **Privados**: almacenados fuera de `public/`, servidos por ruta con guard (dueño de la orden o admin), `Cache-Control: private, no-store`, sin caché de edge (contienen PII financiera). |
| Rate limiting | Reglas de Cloudflare (login, `/api/chat`, webhooks) + límites en la app. |
| Secretos | En `.env` (git-ignored); nunca en el repo. |
| Datos sensibles | `password_hash`/`sessions`/`oauth_identities` y PII de clientes nunca expuestos al chat ni a reportes (excluidos de las vistas de analítica). |

---

## 17. Despliegue (Cloudflare Tunnel)

### Topología

- La app corre como **un proceso Bun** escuchando en `127.0.0.1:${PORT}` (p. ej.
  4010). **No** expone el puerto a Internet directamente.
- **`cloudflared`** abre un túnel saliente y mapea `https://tu-dominio` →
  `http://localhost:${PORT}`. Cloudflare aporta **TLS, DDoS/WAF, caché y
  rate-limit**.

### `cloudflared` (túnel con nombre)

```yaml
# ~/.cloudflared/config.yml  (en el servidor)
tunnel: <TUNNEL_ID>
credentials-file: /root/.cloudflared/<TUNNEL_ID>.json
ingress:
  - hostname: tu-dominio.com
    service: http://localhost:4010
  - service: http_status:404
```

```bash
cloudflared tunnel run <TUNNEL_ID>      # o como servicio: cloudflared service install
```

El DNS (`tu-dominio.com`) apunta al túnel en Cloudflare (registro CNAME de proxy).
Como Cloudflare termina TLS, la app debe: (a) marcar cookies `Secure` en prod, (b)
leer la IP real de `CF-Connecting-IP` para logging/rate-limit.

### Docker

- `Dockerfile` base `oven/bun:1.3.14-slim`, `CMD ["bun","src/index.ts"]`, `VOLUME
  ["/app/data"]`.
- `docker-compose.yml`: servicio `web` (la app) + **opcional** servicio
  `cloudflared` (imagen `cloudflare/cloudflared`) con `command: tunnel run` y el
  token del túnel; o correr `cloudflared` como servicio del host (systemd).
- `data/` en volumen persistente (SQLite).
- `deploy.sh` — **script de release y despliegue** en el servidor (se ejecuta a
  mano o por cron/webhook). **No se crea ahora**; se añade en la fase de
  implementación **F10** (§19). El proceso completo se documenta en
  `docs/despliegue.md`.

**Especificación de `deploy.sh`** (referencia; el archivo se crea en F10). Dos modos:

- **Release** (`./deploy.sh release patch|minor|major`): publica `dev` → `main`
  en **un solo commit** (`git merge --squash`), con bump de versión en
  `package.json`, tag anotado `vX.Y.Z` (semver) y *merge-back* a `dev` para
  mantener el ancestro común. `main` acumula un commit por release; la historia
  detallada vive en `dev`. `main` nunca se reescribe (sin force-push): los
  reverts se hacen con `git revert`.
- **Deploy** (`./deploy.sh`, en el checkout de producción): valida que `.env`
  existe → **respalda** `data/app.sqlite` en `data/backups/` (conserva los
  últimos 10; defensa puntual — Litestream sigue siendo la réplica continua
  recomendada) → `git pull --ff-only` → `docker compose up -d --build`
  (reconstruye la imagen y recrea el contenedor `web`; `cloudflared` sigue
  arriba) → *health check* HTTP. Las **migraciones** versionadas corren solas al
  arrancar la app (`PRAGMA user_version`, §7) **antes** de servir tráfico.

```bash
#!/usr/bin/env bash
set -euo pipefail                     # aborta ante cualquier error
cd "$(dirname "$0")"                  # raíz del repo

# ... validar .env; backup de data/app.sqlite (retener los últimos 10) ...
git pull --ff-only                    # última versión (sin merges sorpresa)
docker compose up -d --build          # reconstruye y recrea 'web'
docker image prune -f                 # limpia imágenes viejas
# ... health check en http://127.0.0.1:4010 ...
```

Rollback: `git revert` del commit de release + redeploy, y/o restaurar un
backup de `data/backups/` (procedimiento en `docs/despliegue.md`).

### SQLite en producción

- **PRAGMAs** en `db.ts`: `journal_mode=WAL`, `synchronous=NORMAL`,
  `busy_timeout=5000`, `foreign_keys=ON`.
- **Backups:** **Litestream** (replicación continua a R2/S3) recomendado; o cron
  `sqlite3 data/app.sqlite ".backup data/backup-$(date).sqlite"`.
- **Migraciones** versionadas (`PRAGMA user_version`, §7) para no perder datos.

### Escalabilidad

- SQLite es de **un solo escritor** pero soporta **mucha lectura concurrente** con
  WAL; para una tienda en un servidor es ampliamente suficiente. La mayoría del
  tráfico público (catálogo) lo absorbe la **caché de Cloudflare**.
- Escalado **vertical** (más CPU/RAM/IO) es el camino natural. El techo aparece si
  se necesita **alta disponibilidad multi-nodo con escritura concurrente**; ahí se
  evaluaría un motor cliente-servidor. No es un objetivo de v1 (§1).
- El LLM (DeepSeek) es un servicio externo; su latencia/costo es el factor de
  escala del chat, no la base de datos.

---

## 18. Variables de entorno

```env
# --- App ---
PORT=4010
NODE_ENV=production
PUBLIC_BASE_URL=https://tu-dominio.com     # para redirect URIs y webhooks

# --- Auth / OAuth (Google) ---
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
OAUTH_REDIRECT_URI=https://tu-dominio.com/auth/callback
ADMIN_ALLOWLIST=correo1@dominio.com,correo2@dominio.com   # correos admin/staff
# (Opcional, solo si se habilita la opción A/C de contraseña)
ADMIN_EMAIL=
ADMIN_PASSWORD=

# --- LLM (DeepSeek, OpenAI-compatible) ---
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_BASE_URL=https://api.deepseek.com

# --- Pagos (v1: Nequi manual) ---
NEQUI_NUMBER=                              # número/línea Nequi mostrada al cliente
NEQUI_QR_URL=                              # (opcional) imagen QR de pago
# --- Pagos (futuro: Wompi) ---
# WOMPI_ENV=test                           # test | prod
# WOMPI_PUBLIC_KEY=
# WOMPI_INTEGRITY_SECRET=
# WOMPI_EVENTS_SECRET=

# --- WhatsApp Cloud API (Meta) ---
WHATSAPP_VERIFY_TOKEN=                     # el que registras en el webhook
WHATSAPP_APP_SECRET=                       # para verificar X-Hub-Signature-256
WHATSAPP_TOKEN=                            # token de Graph API
WHATSAPP_PHONE_NUMBER_ID=

# --- Chat API (canal server-to-server) ---
CHAT_API_SECRET=                           # bearer para POST /api/chat

# --- (Opcional) Almacenamiento de objetos R2/S3 ---
# R2_ACCOUNT_ID= / R2_ACCESS_KEY_ID= / R2_SECRET_ACCESS_KEY= / R2_BUCKET=
```

Bun autocarga `.env`. `data/` y `.env` van git-ignored.

---

## 19. Plan de implementación por fases

Cada fase entrega algo funcional y verificable arrancando con `bun src/index.ts`
(Bun valida tipos/imports al bootear; no hay paso de `tsc`).

| Fase | Entregable | Depende de |
|------|-----------|-----------|
| **F0 — Esqueleto** | Núcleo de la app: `core/`, `components/`, `auth/` (solo sesiones), `theme.ts`, `db.ts`, `index.ts`, Docker. Arranca vacío. | — |
| **F1 — Catálogo (admin + público)** | Módulos `categories`, `products`, `variants`; storefront `/`, `/productos`, `/productos/:id`. Imágenes en disco (§8). | F0 |
| **F2 — Inventario/stock** | Módulo `inventory` (`stock_movements` + saldo), ajustes y alertas. | F1 |
| **F3 — Carrito + checkout** | Carrito server-side, cálculo de envío (`shipping`), creación de orden `pending`. | F1, F2 |
| **F4 — Pago manual (Nequi)** | Checkout con instrucciones Nequi + `payment_ref`; endpoint de **subida de comprobante** (imagen → §8) que lo asocia a la orden y la pasa a `payment_review`. | F3 |
| **F5 — Órdenes (admin) + envíos + contenido + flags** | Módulos `orders` (incl. **verificación de comprobante** → `paid` + descuento de stock idempotente), `shipping`, `content`, `feature-flags`. | F3, F4 |
| **F6 — Chat cliente (web)** | `chatService` + herramientas curadas + UI HTMX (`/chat`, `/chat/send`) + persistencia + **envío del comprobante por el chat** (adjunto imagen, reutiliza F4). | F1, F3, F4 |
| **F7 — Endpoint `/api/chat` + WhatsApp** | Endpoint reutilizable (secreto) + webhook Meta (verify+inbound+envío) + migración invitado→auth. | F6 |
| **F8 — Auth Google (OAuth)** | `oauth.google.ts`, `/auth/*`, allowlist admin, cuenta opcional cliente, `users` módulo/roles. | F0 |
| **F9 — Reportes (NL→SQL admin)** | Módulo `reports` con `readonly-sql` + gráficas. | F5, F8 |
| **F10 — Producción** | Cloudflare Tunnel, script de release/despliegue `deploy.sh` (§17, `docs/despliegue.md`), migraciones versionadas, backups (Litestream), endurecimiento, rate-limits. | todas |

> El orden es una guía; F8 (auth) puede adelantarse si se quiere gatear el admin
> desde temprano. Para desarrollo, un "dev login" temporal permite avanzar sin
> Google hasta F8.

---

## 20. Decisiones abiertas / pendientes

| # | Tema | Opciones / recomendación |
|---|------|--------------------------|
| **O-1** | Momento de descuento de stock | **Rec.:** descontar al **aprobar el pago** (verificación manual del comprobante en v1; webhook Wompi a futuro). ¿Se quiere además reserva blanda con expiración durante el checkout? |
| **O-2** | Almacenamiento de imágenes | **Rec.:** disco local + caché Cloudflare (v1). ¿O Cloudflare R2 desde el inicio por durabilidad? |
| **O-3** | Impuestos / IVA | ¿Los precios incluyen IVA? ¿Se muestra desglose? (Afecta cálculo de totales y recibo.) |
| **O-4** | Devoluciones / cancelaciones / reembolsos | ¿Flujo en v1 o solo estados manuales por admin? En v1 el reembolso sería una **transferencia Nequi manual**; Wompi soportará anulaciones a futuro. |
| **O-5** | Notificaciones al cliente | ¿Confirmación de pedido/envío por WhatsApp/email? (Reutilizable con la integración de WhatsApp.) |
| **O-6** | Migraciones en prod | **Rec.:** `user_version` + `src/migrations/NN_*.ts`. Confirmar que se acepta este mecanismo. |
| **O-7** | Roles finales | **v1 mantiene** `admin/manager/sales/logistic/financial/customer` (no existe un rol `staff`: es término genérico). ¿Se simplifica a `admin/staff/customer` más adelante? |
| **O-8** | Cuenta de cliente vincula órdenes de invitado | ¿Se migran también las órdenes de invitado (por `guest_ref`) al hacer login, o solo el chat? |
| **O-9** | LLM | **Resuelto:** DeepSeek en v1 (OpenAI-compatible), abstraído en `core/llm.ts`; proveedor cambiable en versiones futuras sin tocar el core (S2). |
| **O-10** | Multi-idioma | **Resuelto:** **solo español** en v1, sin i18n (S1). Aplica a UI y al LLM. |
| **O-11** | Personalización — fase futura | Cuando entre: requiere una "isla" de JS en el cliente (un editor de lienzo/canvas) embebida en la página HTMX + subida de assets; definir alcance entonces. |

---

*Fin del documento. Siguiente paso sugerido: resolver las decisiones abiertas (§20)
y arrancar por la Fase 0 (§19).*
