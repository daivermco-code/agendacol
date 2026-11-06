-- 0018_extensiones.sql · AgedaCol
-- Auditoría del 1-nov-2026 (AUDIT-2026-11-01.md, baja prioridad): `btree_gist` sale del esquema `public` (advisor
-- `extension_in_public`) y pasa a `extensions`, junto a las demás extensiones de Supabase.
-- Los 4 índices GiST de la agenda (`citas_profesional_rango`, `citas_cliente_rango`, `bloqueos_profesional_rango`,
-- `clases_profesional_rango`) guardan sus clases de operadores por identificador, así que siguen igual.

alter extension btree_gist set schema extensions;
