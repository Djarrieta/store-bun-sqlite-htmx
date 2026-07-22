# §5 — Folder structure

```
store-bun-sqlite-htmx/
  src/
    index.ts                       # entry point: auth → modules → routes → server
    config.ts                      # env var loading
    db.ts                          # bun:sqlite connection, PRAGMAs, newId(), now()
    core/
      router.ts                    # URL routing
      http.ts                      # html(), fragment(), notFound(), forbidden()
      permissions.ts               # can(), requirePermission(), registerPermissions()
      repository.ts                # base Repository<T> with paginate()
      modules.ts                   # AppModule, registerModule(), DashboardCard
      llm.ts                       # LLM provider (swappable)
      readonly-sql.ts              # read-only SQLite for admin NL→SQL
    modules/
      index.ts                     # imports all modules (triggers registration)
      <name>/
        index.ts                   # AppModule, registerModule(), dashboard card
        <n>.db.ts                  # CREATE TABLE IF NOT EXISTS, row types, repository
        <n>.rules.ts               # MODULE_KEY, PermissionMatrix, validators
        <n>.routes.ts              # register<Routes>(router)
        <n>.views.ts               # HTML/HTMX template functions
    auth/
      auth.db.ts                   # users, sessions, oauth_identities tables
      auth.service.ts              # hashing, sessions, account rules
      oauth.google.ts              # Google OAuth/OIDC flow
      auth.routes.ts               # /login, /logout, /auth/google, /auth/callback, /account
      auth.rules.ts                # admin allowlist, validations
      auth.views.ts                # login and /account screens
    chat/
      chat.service.ts              # shared brain (tools + LLM loop)
      chat.tools.ts                # curated customer tools
      chat.history.ts              # persistence + guest→auth migration
      chat.web.routes.ts           # /chat, /chat/send
      chat.api.routes.ts           # /api/chat (JSON)
    storefront/
      home.routes.ts
      catalog.routes.ts
      product.routes.ts
      cart.routes.ts
      checkout.routes.ts
    components/
      registry.ts                  # escapeHtml(), escapeAttr(), shared components
      layout.ts                    # shell HTML, @font-face, HTMX script, global CSS
      nav.ts                       # navigation
      table.ts                     # dataTable()
      forms.ts                     # form helpers
      card.ts, badge.ts, alert.ts
      storefront/                  # ProductCard, cart, chat FAB
    integrations/
      whatsapp/                    # webhook + Graph API send
      wompi/                       # (future) payment gateway
    migrations/                    # (v1.0+) versioned schema migrations
    scripts/
      seed.ts                      # single source of initial data
      reset.ts                     # reset DB
  data/
    app.sqlite                     # SQLite database
    backups/                       # pre-deploy backups
    uploads/
      proofs/                      # PRIVATE payment proofs (Nequi)
  public/
    fonts/                         # self-hosted woff2
    brand/                         # logo, no-image placeholder
    uploads/                       # PUBLIC product images
  docs/
    mockups/                       # visual reference (not served)
    tech-spec/
    ...
  AGENTS.md
  Dockerfile
  docker-compose.yml
  deploy.sh
  .env.example
  package.json
```

> This is a high-level guide. Exact file names within modules follow the pattern in [§6 — Module system](06-modules.md) and [docs/modules.md](../../docs/modules.md).
