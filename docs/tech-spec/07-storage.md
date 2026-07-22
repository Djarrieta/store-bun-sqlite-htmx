# §7 — Storage (uploads, images, proofs)

## Directories

```
public/
  uploads/               # PUBLIC product images
  brand/
    logo-htal.png         # logo
    no-image.jpeg          # placeholder for products without image
data/
  uploads/
    proofs/               # PRIVATE payment proofs (Nequi)
```

## Public files (`/uploads/...`)

- Served by a static route **without authentication** (from `public/uploads/`).
- Anyone can access product images directly via URL.
- Paths stored in DB are relative to the web root (e.g., `/uploads/abc.jpg`).

## Private files (`/proofs/...`)

- **Never served publicly.**
- Accessible only through a **guarded download endpoint** (e.g., `GET /admin/proof/:filename`).
- Endpoint requires admin session or owner of the related order.
- Used for Nequi payment proof images.

## Upload constraints

| Rule | Value |
| --- | --- |
| Max file size | 5 MB |
| Allowed types | `image/jpeg`, `image/png`, `image/webp` |
| Validation | Magic bytes (file signature), not just extension |
| Storage path | `public/uploads/` (products) or `data/uploads/proofs/` (proofs) |
| Filename | UUID + original extension (no user-supplied names) |
| Re-encoding | Consider sharp/libvips for JPEG/WebP normalization |

## How uploads work

1. Admin form sends `multipart/form-data`.
2. Server validates: magic bytes, size, type.
3. If product image → store in `public/uploads/` (public).
4. If proof → store in `data/uploads/proofs/` (private).
5. Return relative URL; store in DB column.
