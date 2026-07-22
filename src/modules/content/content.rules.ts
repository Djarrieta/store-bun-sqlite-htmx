/** Content permissions + curated editable keys (tech-spec §12). */
import { registerPermissions, type PermissionMatrix } from "../../core/permissions.ts";

export const CONTENT_KEY = "content";

export const contentPermissions: PermissionMatrix = {
  view: ["admin", "manager"],
  edit: ["admin", "manager"],
};

registerPermissions(CONTENT_KEY, contentPermissions);

export interface ContentField {
  key: string;
  label: string;
  default: string;
  type?: "text" | "image_url";
  help?: string;
}

/** Curated content blocks surfaced in the storefront. */
export const CONTENT_FIELDS: ContentField[] = [
  {
    key: "nosotros",
    label: "Nosotros",
    default:
      "CRISTA es una marca de prendas de origen natural. Trabajamos con algodones nobles y procesos responsables para crear piezas atemporales.",
  },
  {
    key: "pagos_envios",
    label: "Pagos y envíos",
    default:
      "Aceptamos pago por Nequi (transferencia + comprobante). Enviamos a las principales ciudades de Colombia; el costo se calcula en el checkout según tu ciudad.",
  },
  {
    key: "hero_image",
    label: "Imagen principal",
    type: "image_url",
    default: "/uploads/hero.png",
    help: "URL relativa de la imagen principal del home (ej. /uploads/hero.png).",
  },
];


