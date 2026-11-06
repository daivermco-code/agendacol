-- 0015_indices.sql · AgedaCol
-- Auditoría del 1-nov-2026 (AUDIT-2026-11-01.md, top fix 1): un índice por cada llave foránea que no tenía uno que
-- la cubriera (advisor `unindexed_foreign_keys`, 41 llaves). Sin ellos, borrar o cambiar una fila de la tabla de
-- arriba recorre la de abajo completa, y los filtros por esas columnas leen la tabla entera. No cambia datos ni
-- permisos.

create index accesos_cliente_negocio_id_idx on public.accesos_cliente (negocio_id);
create index bloqueos_negocio_id_idx on public.bloqueos (negocio_id);
create index bonos_negocio_id_idx on public.bonos (negocio_id);
create index bonos_plan_id_idx on public.bonos (plan_id);
create index bonos_servicio_id_idx on public.bonos (servicio_id);
create index calificaciones_negocio_id_idx on public.calificaciones (negocio_id);
create index campanas_audiencia_id_idx on public.campanas (audiencia_id);
create index canjes_sellos_negocio_id_idx on public.canjes_sellos (negocio_id);
create index citas_creada_por_idx on public.citas (creada_por);
create index citas_negocio_id_idx on public.citas (negocio_id);
create index citas_servicio_id_idx on public.citas (servicio_id);
create index clase_inscritos_negocio_id_idx on public.clase_inscritos (negocio_id);
create index clases_negocio_id_idx on public.clases (negocio_id);
create index clases_servicio_id_idx on public.clases (servicio_id);
create index gift_cards_comprador_id_idx on public.gift_cards (comprador_id);
create index gift_cards_modelo_id_idx on public.gift_cards (modelo_id);
create index lista_espera_negocio_id_idx on public.lista_espera (negocio_id);
create index lista_espera_profesional_id_idx on public.lista_espera (profesional_id);
create index miembros_negocio_id_idx on public.miembros (negocio_id);
create index miembros_profesional_id_idx on public.miembros (profesional_id);
create index movimientos_caja_creado_por_idx on public.movimientos_caja (creado_por);
create index movimientos_caja_negocio_id_idx on public.movimientos_caja (negocio_id);
create index movimientos_caja_pago_id_idx on public.movimientos_caja (pago_id);
create index movimientos_stock_creado_por_idx on public.movimientos_stock (creado_por);
create index movimientos_stock_negocio_id_idx on public.movimientos_stock (negocio_id);
create index movimientos_stock_venta_id_idx on public.movimientos_stock (venta_id);
create index numeracion_cambios_creado_por_idx on public.numeracion_cambios (creado_por);
create index pagos_creado_por_idx on public.pagos (creado_por);
create index pagos_metodo_id_idx on public.pagos (metodo_id);
create index profesionales_negocio_id_idx on public.profesionales (negocio_id);
create index recursos_negocio_id_idx on public.recursos (negocio_id);
create index sellos_negocio_id_idx on public.sellos (negocio_id);
create index servicio_profesional_profesional_id_idx on public.servicio_profesional (profesional_id);
create index servicios_negocio_id_idx on public.servicios (negocio_id);
create index venta_items_gift_card_modelo_id_idx on public.venta_items (gift_card_modelo_id);
create index venta_items_plan_id_idx on public.venta_items (plan_id);
create index venta_items_profesional_id_idx on public.venta_items (profesional_id);
create index venta_items_servicio_id_idx on public.venta_items (servicio_id);
create index ventas_anulada_por_idx on public.ventas (anulada_por);
create index ventas_creada_por_idx on public.ventas (creada_por);
create index ventas_local_id_idx on public.ventas (local_id);
