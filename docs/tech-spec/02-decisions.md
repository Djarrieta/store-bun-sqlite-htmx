# §2 — Fixed decisions and assumptions

1. Server renders HTML; HTMX handles dynamic parts; **no SPA, no heavy JS**.
2. SQLite via `bun:sqlite` as the sole database, with WAL mode enabled.
3. Auth via **Google OAuth** (primary); email/password is documented as an alternative but not active in v1.
4. Admin routes are protected; customers access only public routes.
5. Nequi is the initial payment method. **Wompi** will be evaluated in a future phase.
6. File storage will start on **local disk**; cloud storage can be added later (no architectural changes needed).

## Assumptions

- Bun runtime available in production (Docker or native).
- Domain available (e.g., `crista.click` or similar).
- Google OAuth credentials can be created.
- SMTP email service available (Gmail, Mailgun, Brevo, etc.).
- **Time horizon:** short; v1 is a limited-functional MVP.
- Admin panel exists, but does **not** include a traditional inventory system — only catalog and orders.
- **Admin analytics:** an AI assistant (LLM) queries the database via prebuilt, read-only SQL views. No row-level security; no direct user access to the underlying data.
- **Language:** the only UI language is Spanish (ES).
- **Currency:** COP (Colombian pesos) only. All amounts stored in **whole cents** (integer arithmetic) and displayed as `$ 15.000` (dot thousands separator, no decimals).
- **Payments:** v1 = manual Nequi transfer (image proof). Wompi (automatic) = future phase.
