export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      accesos_cliente: {
        Row: {
          canal: Database["public"]["Enums"]["canal_aviso"];
          created_at: string;
          destino: string;
          negocio_id: string;
          token_hash: string;
          vence_at: string;
        };
        ComputedFields: never;
        Insert: {
          canal: Database["public"]["Enums"]["canal_aviso"];
          created_at?: string;
          destino: string;
          negocio_id: string;
          token_hash: string;
          vence_at: string;
        };
        Update: {
          canal?: Database["public"]["Enums"]["canal_aviso"];
          created_at?: string;
          destino?: string;
          negocio_id?: string;
          token_hash?: string;
          vence_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "accesos_cliente_negocio_id_fkey";
            columns: ["negocio_id"];
            isOneToOne: false;
            referencedRelation: "negocios";
            referencedColumns: ["id"];
          },
        ];
      };
      ajustes: {
        Row: {
          aviso_correo: boolean;
          aviso_equipo_cambios: boolean;
          aviso_equipo_correo: string | null;
          aviso_equipo_reserva: boolean;
          aviso_whatsapp: boolean;
          bloque_min: number;
          bloquear_pasadas: boolean;
          caja_activa: boolean;
          caja_cliente_obligatorio: boolean;
          exigir_contacto: boolean;
          negocio_id: string;
          permitir_cliente_doble: boolean;
          permitir_fuera_horario: boolean;
          permitir_sobrecarga_recursos: boolean;
          permitir_sobrepuestas: boolean;
          recordatorio_correo: boolean;
          recordatorio_correo_dias: number;
          recordatorio_correo_hora: string;
          recordatorio_whatsapp: boolean;
          recordatorio_whatsapp_dias: number;
          recordatorio_whatsapp_hora: string;
          red_facebook: string | null;
          red_instagram: string | null;
          red_tiktok: string | null;
          sellos_activos: boolean;
          sellos_meta: number;
          sellos_premio: string;
          venta_prefijo: string;
          venta_siguiente: number;
          web_anticipacion_min: number;
          web_cliente_cambia: boolean;
          web_cliente_cancela: boolean;
          web_dias_max: number;
          web_limite_horas: number;
          web_politica: string;
          whatsapp_cupo_mes: number;
        };
        ComputedFields: never;
        Insert: {
          aviso_correo?: boolean;
          aviso_equipo_cambios?: boolean;
          aviso_equipo_correo?: string | null;
          aviso_equipo_reserva?: boolean;
          aviso_whatsapp?: boolean;
          bloque_min?: number;
          bloquear_pasadas?: boolean;
          caja_activa?: boolean;
          caja_cliente_obligatorio?: boolean;
          exigir_contacto?: boolean;
          negocio_id: string;
          permitir_cliente_doble?: boolean;
          permitir_fuera_horario?: boolean;
          permitir_sobrecarga_recursos?: boolean;
          permitir_sobrepuestas?: boolean;
          recordatorio_correo?: boolean;
          recordatorio_correo_dias?: number;
          recordatorio_correo_hora?: string;
          recordatorio_whatsapp?: boolean;
          recordatorio_whatsapp_dias?: number;
          recordatorio_whatsapp_hora?: string;
          red_facebook?: string | null;
          red_instagram?: string | null;
          red_tiktok?: string | null;
          sellos_activos?: boolean;
          sellos_meta?: number;
          sellos_premio?: string;
          venta_prefijo?: string;
          venta_siguiente?: number;
          web_anticipacion_min?: number;
          web_cliente_cambia?: boolean;
          web_cliente_cancela?: boolean;
          web_dias_max?: number;
          web_limite_horas?: number;
          web_politica?: string;
          whatsapp_cupo_mes?: number;
        };
        Update: {
          aviso_correo?: boolean;
          aviso_equipo_cambios?: boolean;
          aviso_equipo_correo?: string | null;
          aviso_equipo_reserva?: boolean;
          aviso_whatsapp?: boolean;
          bloque_min?: number;
          bloquear_pasadas?: boolean;
          caja_activa?: boolean;
          caja_cliente_obligatorio?: boolean;
          exigir_contacto?: boolean;
          negocio_id?: string;
          permitir_cliente_doble?: boolean;
          permitir_fuera_horario?: boolean;
          permitir_sobrecarga_recursos?: boolean;
          permitir_sobrepuestas?: boolean;
          recordatorio_correo?: boolean;
          recordatorio_correo_dias?: number;
          recordatorio_correo_hora?: string;
          recordatorio_whatsapp?: boolean;
          recordatorio_whatsapp_dias?: number;
          recordatorio_whatsapp_hora?: string;
          red_facebook?: string | null;
          red_instagram?: string | null;
          red_tiktok?: string | null;
          sellos_activos?: boolean;
          sellos_meta?: number;
          sellos_premio?: string;
          venta_prefijo?: string;
          venta_siguiente?: number;
          web_anticipacion_min?: number;
          web_cliente_cambia?: boolean;
          web_cliente_cancela?: boolean;
          web_dias_max?: number;
          web_limite_horas?: number;
          web_politica?: string;
          whatsapp_cupo_mes?: number;
        };
        Relationships: [
          {
            foreignKeyName: "ajustes_negocio_id_fkey";
            columns: ["negocio_id"];
            isOneToOne: true;
            referencedRelation: "negocios";
            referencedColumns: ["id"];
          },
        ];
      };
      audiencias: {
        Row: {
          created_at: string;
          filtro: NonNullable<Json>;
          id: string;
          negocio_id: string;
          nombre: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          filtro?: NonNullable<Json>;
          id?: string;
          negocio_id: string;
          nombre: string;
        };
        Update: {
          created_at?: string;
          filtro?: NonNullable<Json>;
          id?: string;
          negocio_id?: string;
          nombre?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audiencias_negocio_id_fkey";
            columns: ["negocio_id"];
            isOneToOne: false;
            referencedRelation: "negocios";
            referencedColumns: ["id"];
          },
        ];
      };
      avisos_demo: {
        Row: {
          asunto: string | null;
          campana_id: string | null;
          canal: Database["public"]["Enums"]["canal_aviso"];
          cita_id: string | null;
          created_at: string;
          cuerpo: string;
          destinatario: string | null;
          destino: string | null;
          enlace: string | null;
          estado: string;
          id: string;
          negocio_id: string;
          programado_para: string;
          tipo: string;
          venta_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          asunto?: string | null;
          campana_id?: string | null;
          canal: Database["public"]["Enums"]["canal_aviso"];
          cita_id?: string | null;
          created_at?: string;
          cuerpo: string;
          destinatario?: string | null;
          destino?: string | null;
          enlace?: string | null;
          estado?: string;
          id?: string;
          negocio_id: string;
          programado_para?: string;
          tipo: string;
          venta_id?: string | null;
        };
        Update: {
          asunto?: string | null;
          campana_id?: string | null;
          canal?: Database["public"]["Enums"]["canal_aviso"];
          cita_id?: string | null;
          created_at?: string;
          cuerpo?: string;
          destinatario?: string | null;
          destino?: string | null;
          enlace?: string | null;
          estado?: string;
          id?: string;
          negocio_id?: string;
          programado_para?: string;
          tipo?: string;
          venta_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "avisos_demo_campana_id_fkey";
            columns: ["campana_id"];
            isOneToOne: false;
            referencedRelation: "campanas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "avisos_demo_cita_id_fkey";
            columns: ["cita_id"];
            isOneToOne: false;
            referencedRelation: "citas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "avisos_demo_negocio_id_fkey";
            columns: ["negocio_id"];
            isOneToOne: false;
            referencedRelation: "negocios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "avisos_demo_venta_id_fkey";
            columns: ["venta_id"];
            isOneToOne: false;
            referencedRelation: "ventas";
            referencedColumns: ["id"];
          },
        ];
      };
      bloqueos: {
        Row: {
          created_at: string;
          fin: string;
          id: string;
          inicio: string;
          motivo: string;
          negocio_id: string;
          profesional_id: string;
          rango: unknown;
          serie_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          fin: string;
          id?: string;
          inicio: string;
          motivo?: string;
          negocio_id: string;
          profesional_id: string;
          rango?: never;
          serie_id?: string | null;
        };
        Update: {
          created_at?: string;
          fin?: string;
          id?: string;
          inicio?: string;
          motivo?: string;
          negocio_id?: string;
          profesional_id?: string;
          rango?: never;
          serie_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "bloqueos_negocio_id_fkey";
            columns: ["negocio_id"];
            isOneToOne: false;
            referencedRelation: "negocios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bloqueos_profesional_id_fkey";
            columns: ["profesional_id"];
            isOneToOne: false;
            referencedRelation: "profesionales";
            referencedColumns: ["id"];
          },
        ];
      };
      bonos: {
        Row: {
          anulado: boolean;
          cliente_id: string;
          created_at: string;
          cupo: number | null;
          id: string;
          inicio: string;
          negocio_id: string;
          nombre: string;
          plan_id: string | null;
          servicio_id: string | null;
          servicios: string[];
          tipo: string;
          vence: string;
          venta_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          anulado?: boolean;
          cliente_id: string;
          created_at?: string;
          cupo?: number | null;
          id?: string;
          inicio: string;
          negocio_id: string;
          nombre: string;
          plan_id?: string | null;
          servicio_id?: string | null;
          servicios?: string[];
          tipo: string;
          vence: string;
          venta_id?: string | null;
        };
        Update: {
          anulado?: boolean;
          cliente_id?: string;
          created_at?: string;
          cupo?: number | null;
          id?: string;
          inicio?: string;
          negocio_id?: string;
          nombre?: string;
          plan_id?: string | null;
          servicio_id?: string | null;
          servicios?: string[];
          tipo?: string;
          vence?: string;
          venta_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "bonos_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bonos_negocio_id_fkey";
            columns: ["negocio_id"];
            isOneToOne: false;
            referencedRelation: "negocios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bonos_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "planes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bonos_servicio_id_fkey";
            columns: ["servicio_id"];
            isOneToOne: false;
            referencedRelation: "servicios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bonos_venta_id_fkey";
            columns: ["venta_id"];
            isOneToOne: false;
            referencedRelation: "ventas";
            referencedColumns: ["id"];
          },
        ];
      };
      calificaciones: {
        Row: {
          cita_id: string;
          comentario: string | null;
          created_at: string;
          estrellas: number;
          negocio_id: string;
          profesional_id: string;
        };
        ComputedFields: never;
        Insert: {
          cita_id: string;
          comentario?: string | null;
          created_at?: string;
          estrellas: number;
          negocio_id: string;
          profesional_id: string;
        };
        Update: {
          cita_id?: string;
          comentario?: string | null;
          created_at?: string;
          estrellas?: number;
          negocio_id?: string;
          profesional_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "calificaciones_cita_id_fkey";
            columns: ["cita_id"];
            isOneToOne: true;
            referencedRelation: "citas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "calificaciones_negocio_id_fkey";
            columns: ["negocio_id"];
            isOneToOne: false;
            referencedRelation: "negocios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "calificaciones_profesional_id_fkey";
            columns: ["profesional_id"];
            isOneToOne: false;
            referencedRelation: "profesionales";
            referencedColumns: ["id"];
          },
        ];
      };
      campanas: {
        Row: {
          asunto: string;
          audiencia_id: string | null;
          created_at: string;
          cuerpo: string;
          destinatarios: number | null;
          enviada_at: string | null;
          estado: string;
          id: string;
          negocio_id: string;
        };
        ComputedFields: never;
        Insert: {
          asunto: string;
          audiencia_id?: string | null;
          created_at?: string;
          cuerpo: string;
          destinatarios?: number | null;
          enviada_at?: string | null;
          estado?: string;
          id?: string;
          negocio_id: string;
        };
        Update: {
          asunto?: string;
          audiencia_id?: string | null;
          created_at?: string;
          cuerpo?: string;
          destinatarios?: number | null;
          enviada_at?: string | null;
          estado?: string;
          id?: string;
          negocio_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campanas_audiencia_id_fkey";
            columns: ["audiencia_id"];
            isOneToOne: false;
            referencedRelation: "audiencias";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campanas_negocio_id_fkey";
            columns: ["negocio_id"];
            isOneToOne: false;
            referencedRelation: "negocios";
            referencedColumns: ["id"];
          },
        ];
      };
      canjes_sellos: {
        Row: {
          cliente_id: string;
          created_at: string;
          id: string;
          negocio_id: string;
          premio: string;
        };
        ComputedFields: never;
        Insert: {
          cliente_id: string;
          created_at?: string;
          id?: string;
          negocio_id: string;
          premio: string;
        };
        Update: {
          cliente_id?: string;
          created_at?: string;
          id?: string;
          negocio_id?: string;
          premio?: string;
        };
        Relationships: [
          {
            foreignKeyName: "canjes_sellos_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "canjes_sellos_negocio_id_fkey";
            columns: ["negocio_id"];
            isOneToOne: false;
            referencedRelation: "negocios";
            referencedColumns: ["id"];
          },
        ];
      };
      categorias: {
        Row: {
          id: string;
          negocio_id: string;
          nombre: string;
          orden: number;
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          negocio_id: string;
          nombre: string;
          orden?: number;
        };
        Update: {
          id?: string;
          negocio_id?: string;
          nombre?: string;
          orden?: number;
        };
        Relationships: [
          {
            foreignKeyName: "categorias_negocio_id_fkey";
            columns: ["negocio_id"];
            isOneToOne: false;
            referencedRelation: "negocios";
            referencedColumns: ["id"];
          },
        ];
      };
      citas: {
        Row: {
          aviso_correo: boolean;
          aviso_whatsapp: boolean;
          bono_id: string | null;
          cliente_id: string;
          confirmada_por: string | null;
          creada_por: string | null;
          created_at: string;
          duracion_min: number;
          estado: Database["public"]["Enums"]["estado_cita"];
          fecha: string;
          hora_fin: string;
          hora_inicio: string;
          id: string;
          local_id: string;
          motivo_cancelacion: string | null;
          negocio_id: string;
          nota_cliente: string | null;
          nota_interna: string | null;
          origen: Database["public"]["Enums"]["origen_cita"];
          precio: number;
          profesional_fijo: boolean;
          profesional_id: string;
          rango: unknown;
          recurso_id: string | null;
          reserva_id: string | null;
          serie_id: string | null;
          servicio_id: string;
          token: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          aviso_correo?: boolean;
          aviso_whatsapp?: boolean;
          bono_id?: string | null;
          cliente_id: string;
          confirmada_por?: string | null;
          creada_por?: string | null;
          created_at?: string;
          duracion_min: number;
          estado?: Database["public"]["Enums"]["estado_cita"];
          fecha: string;
          hora_fin: string;
          hora_inicio: string;
          id?: string;
          local_id: string;
          motivo_cancelacion?: string | null;
          negocio_id: string;
          nota_cliente?: string | null;
          nota_interna?: string | null;
          origen?: Database["public"]["Enums"]["origen_cita"];
          precio: number;
          profesional_fijo?: boolean;
          profesional_id: string;
          rango?: never;
          recurso_id?: string | null;
          reserva_id?: string | null;
          serie_id?: string | null;
          servicio_id: string;
          token?: string;
          updated_at?: string;
        };
        Update: {
          aviso_correo?: boolean;
          aviso_whatsapp?: boolean;
          bono_id?: string | null;
          cliente_id?: string;
          confirmada_por?: string | null;
          creada_por?: string | null;
          created_at?: string;
          duracion_min?: number;
          estado?: Database["public"]["Enums"]["estado_cita"];
          fecha?: string;
          hora_fin?: string;
          hora_inicio?: string;
          id?: string;
          local_id?: string;
          motivo_cancelacion?: string | null;
          negocio_id?: string;
          nota_cliente?: string | null;
          nota_interna?: string | null;
          origen?: Database["public"]["Enums"]["origen_cita"];
          precio?: number;
          profesional_fijo?: boolean;
          profesional_id?: string;
          rango?: never;
          recurso_id?: string | null;
          reserva_id?: string | null;
          serie_id?: string | null;
          servicio_id?: string;
          token?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "citas_bono_id_fkey";
            columns: ["bono_id"];
            isOneToOne: false;
            referencedRelation: "bonos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "citas_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "citas_creada_por_fkey";
            columns: ["creada_por"];
            isOneToOne: false;
            referencedRelation: "miembros";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "citas_local_id_fkey";
            columns: ["local_id"];
            isOneToOne: false;
            referencedRelation: "locales";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "citas_negocio_id_fkey";
            columns: ["negocio_id"];
            isOneToOne: false;
            referencedRelation: "negocios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "citas_profesional_id_fkey";
            columns: ["profesional_id"];
            isOneToOne: false;
            referencedRelation: "profesionales";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "citas_recurso_id_fkey";
            columns: ["recurso_id"];
            isOneToOne: false;
            referencedRelation: "recursos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "citas_servicio_id_fkey";
            columns: ["servicio_id"];
            isOneToOne: false;
            referencedRelation: "servicios";
            referencedColumns: ["id"];
          },
        ];
      };
      clase_inscritos: {
        Row: {
          bono_id: string | null;
          clase_id: string;
          cliente_id: string;
          created_at: string;
          estado: string;
          id: string;
          negocio_id: string;
        };
        ComputedFields: never;
        Insert: {
          bono_id?: string | null;
          clase_id: string;
          cliente_id: string;
          created_at?: string;
          estado?: string;
          id?: string;
          negocio_id: string;
        };
        Update: {
          bono_id?: string | null;
          clase_id?: string;
          cliente_id?: string;
          created_at?: string;
          estado?: string;
          id?: string;
          negocio_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clase_inscritos_bono_id_fkey";
            columns: ["bono_id"];
            isOneToOne: false;
            referencedRelation: "bonos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clase_inscritos_clase_id_fkey";
            columns: ["clase_id"];
            isOneToOne: false;
            referencedRelation: "clases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clase_inscritos_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clase_inscritos_negocio_id_fkey";
            columns: ["negocio_id"];
            isOneToOne: false;
            referencedRelation: "negocios";
            referencedColumns: ["id"];
          },
        ];
      };
      clases: {
        Row: {
          cancelada: boolean;
          created_at: string;
          cupo: number;
          fecha: string;
          hora_fin: string;
          hora_inicio: string;
          id: string;
          local_id: string;
          motivo_cancelacion: string | null;
          negocio_id: string;
          nota: string | null;
          precio: number;
          profesional_id: string;
          rango: unknown;
          servicio_id: string;
        };
        ComputedFields: never;
        Insert: {
          cancelada?: boolean;
          created_at?: string;
          cupo: number;
          fecha: string;
          hora_fin: string;
          hora_inicio: string;
          id?: string;
          local_id: string;
          motivo_cancelacion?: string | null;
          negocio_id: string;
          nota?: string | null;
          precio: number;
          profesional_id: string;
          rango?: never;
          servicio_id: string;
        };
        Update: {
          cancelada?: boolean;
          created_at?: string;
          cupo?: number;
          fecha?: string;
          hora_fin?: string;
          hora_inicio?: string;
          id?: string;
          local_id?: string;
          motivo_cancelacion?: string | null;
          negocio_id?: string;
          nota?: string | null;
          precio?: number;
          profesional_id?: string;
          rango?: never;
          servicio_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clases_local_id_fkey";
            columns: ["local_id"];
            isOneToOne: false;
            referencedRelation: "locales";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clases_negocio_id_fkey";
            columns: ["negocio_id"];
            isOneToOne: false;
            referencedRelation: "negocios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clases_profesional_id_fkey";
            columns: ["profesional_id"];
            isOneToOne: false;
            referencedRelation: "profesionales";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clases_servicio_id_fkey";
            columns: ["servicio_id"];
            isOneToOne: false;
            referencedRelation: "servicios";
            referencedColumns: ["id"];
          },
        ];
      };
      clientes: {
        Row: {
          apellido: string;
          barrio: string | null;
          correo: string | null;
          created_at: string;
          direccion: string | null;
          documento: string | null;
          fecha_nacimiento: string | null;
          genero: string | null;
          id: string;
          municipio: string | null;
          negocio_id: string;
          nombre: string;
          numero_cliente: string | null;
          recibe_campanas: boolean;
          telefono: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          apellido: string;
          barrio?: string | null;
          correo?: string | null;
          created_at?: string;
          direccion?: string | null;
          documento?: string | null;
          fecha_nacimiento?: string | null;
          genero?: string | null;
          id?: string;
          municipio?: string | null;
          negocio_id: string;
          nombre: string;
          numero_cliente?: string | null;
          recibe_campanas?: boolean;
          telefono?: string | null;
          updated_at?: string;
        };
        Update: {
          apellido?: string;
          barrio?: string | null;
          correo?: string | null;
          created_at?: string;
          direccion?: string | null;
          documento?: string | null;
          fecha_nacimiento?: string | null;
          genero?: string | null;
          id?: string;
          municipio?: string | null;
          negocio_id?: string;
          nombre?: string;
          numero_cliente?: string | null;
          recibe_campanas?: boolean;
          telefono?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clientes_negocio_id_fkey";
            columns: ["negocio_id"];
            isOneToOne: false;
            referencedRelation: "negocios";
            referencedColumns: ["id"];
          },
        ];
      };
      codigos_acceso: {
        Row: {
          canal: Database["public"]["Enums"]["canal_aviso"];
          codigo_hash: string;
          created_at: string;
          destino: string;
          id: string;
          intentos: number;
          negocio_id: string;
          usado_at: string | null;
          vence_at: string;
        };
        ComputedFields: never;
        Insert: {
          canal: Database["public"]["Enums"]["canal_aviso"];
          codigo_hash: string;
          created_at?: string;
          destino: string;
          id?: string;
          intentos?: number;
          negocio_id: string;
          usado_at?: string | null;
          vence_at: string;
        };
        Update: {
          canal?: Database["public"]["Enums"]["canal_aviso"];
          codigo_hash?: string;
          created_at?: string;
          destino?: string;
          id?: string;
          intentos?: number;
          negocio_id?: string;
          usado_at?: string | null;
          vence_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "codigos_acceso_negocio_id_fkey";
            columns: ["negocio_id"];
            isOneToOne: false;
            referencedRelation: "negocios";
            referencedColumns: ["id"];
          },
        ];
      };
      gift_card_modelos: {
        Row: {
          activo: boolean;
          color: string;
          created_at: string;
          id: string;
          monto: number;
          negocio_id: string;
          nombre: string;
          precio: number;
          vigencia_dias: number;
        };
        ComputedFields: never;
        Insert: {
          activo?: boolean;
          color?: string;
          created_at?: string;
          id?: string;
          monto: number;
          negocio_id: string;
          nombre: string;
          precio: number;
          vigencia_dias?: number;
        };
        Update: {
          activo?: boolean;
          color?: string;
          created_at?: string;
          id?: string;
          monto?: number;
          negocio_id?: string;
          nombre?: string;
          precio?: number;
          vigencia_dias?: number;
        };
        Relationships: [
          {
            foreignKeyName: "gift_card_modelos_negocio_id_fkey";
            columns: ["negocio_id"];
            isOneToOne: false;
            referencedRelation: "negocios";
            referencedColumns: ["id"];
          },
        ];
      };
      gift_cards: {
        Row: {
          anulada: boolean;
          codigo: string;
          comprador_id: string | null;
          created_at: string;
          id: string;
          modelo_id: string | null;
          negocio_id: string;
          nombre: string;
          para: string | null;
          saldo: number;
          saldo_inicial: number;
          vence: string;
          venta_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          anulada?: boolean;
          codigo: string;
          comprador_id?: string | null;
          created_at?: string;
          id?: string;
          modelo_id?: string | null;
          negocio_id: string;
          nombre: string;
          para?: string | null;
          saldo: number;
          saldo_inicial: number;
          vence: string;
          venta_id?: string | null;
        };
        Update: {
          anulada?: boolean;
          codigo?: string;
          comprador_id?: string | null;
          created_at?: string;
          id?: string;
          modelo_id?: string | null;
          negocio_id?: string;
          nombre?: string;
          para?: string | null;
          saldo?: number;
          saldo_inicial?: number;
          vence?: string;
          venta_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "gift_cards_comprador_id_fkey";
            columns: ["comprador_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gift_cards_modelo_id_fkey";
            columns: ["modelo_id"];
            isOneToOne: false;
            referencedRelation: "gift_card_modelos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gift_cards_negocio_id_fkey";
            columns: ["negocio_id"];
            isOneToOne: false;
            referencedRelation: "negocios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gift_cards_venta_id_fkey";
            columns: ["venta_id"];
            isOneToOne: false;
            referencedRelation: "ventas";
            referencedColumns: ["id"];
          },
        ];
      };
      horarios_local: {
        Row: {
          abierto: boolean;
          descanso_fin: string | null;
          descanso_inicio: string | null;
          dia_semana: number;
          fin: string | null;
          inicio: string | null;
          local_id: string;
        };
        ComputedFields: never;
        Insert: {
          abierto?: boolean;
          descanso_fin?: string | null;
          descanso_inicio?: string | null;
          dia_semana: number;
          fin?: string | null;
          inicio?: string | null;
          local_id: string;
        };
        Update: {
          abierto?: boolean;
          descanso_fin?: string | null;
          descanso_inicio?: string | null;
          dia_semana?: number;
          fin?: string | null;
          inicio?: string | null;
          local_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "horarios_local_local_id_fkey";
            columns: ["local_id"];
            isOneToOne: false;
            referencedRelation: "locales";
            referencedColumns: ["id"];
          },
        ];
      };
      horarios_profesional: {
        Row: {
          descanso_fin: string | null;
          descanso_inicio: string | null;
          dia_semana: number;
          fin: string | null;
          inicio: string | null;
          profesional_id: string;
          trabaja: boolean;
        };
        ComputedFields: never;
        Insert: {
          descanso_fin?: string | null;
          descanso_inicio?: string | null;
          dia_semana: number;
          fin?: string | null;
          inicio?: string | null;
          profesional_id: string;
          trabaja?: boolean;
        };
        Update: {
          descanso_fin?: string | null;
          descanso_inicio?: string | null;
          dia_semana?: number;
          fin?: string | null;
          inicio?: string | null;
          profesional_id?: string;
          trabaja?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "horarios_profesional_profesional_id_fkey";
            columns: ["profesional_id"];
            isOneToOne: false;
            referencedRelation: "profesionales";
            referencedColumns: ["id"];
          },
        ];
      };
      lista_espera: {
        Row: {
          avisado_at: string | null;
          cliente_id: string;
          created_at: string;
          estado: string;
          fecha: string;
          franja: string;
          id: string;
          local_id: string;
          negocio_id: string;
          profesional_id: string | null;
          servicios: string[];
        };
        ComputedFields: never;
        Insert: {
          avisado_at?: string | null;
          cliente_id: string;
          created_at?: string;
          estado?: string;
          fecha: string;
          franja?: string;
          id?: string;
          local_id: string;
          negocio_id: string;
          profesional_id?: string | null;
          servicios: string[];
        };
        Update: {
          avisado_at?: string | null;
          cliente_id?: string;
          created_at?: string;
          estado?: string;
          fecha?: string;
          franja?: string;
          id?: string;
          local_id?: string;
          negocio_id?: string;
          profesional_id?: string | null;
          servicios?: string[];
        };
        Relationships: [
          {
            foreignKeyName: "lista_espera_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lista_espera_local_id_fkey";
            columns: ["local_id"];
            isOneToOne: false;
            referencedRelation: "locales";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lista_espera_negocio_id_fkey";
            columns: ["negocio_id"];
            isOneToOne: false;
            referencedRelation: "negocios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lista_espera_profesional_id_fkey";
            columns: ["profesional_id"];
            isOneToOne: false;
            referencedRelation: "profesionales";
            referencedColumns: ["id"];
          },
        ];
      };
      locales: {
        Row: {
          acepta_whatsapp: boolean;
          activo: boolean;
          correo: string | null;
          created_at: string;
          direccion: string | null;
          id: string;
          negocio_id: string;
          nombre: string;
          portada_url: string | null;
          reservas_en_linea: boolean;
          telefono: string | null;
          updated_at: string;
          zona_horaria: string;
        };
        ComputedFields: never;
        Insert: {
          acepta_whatsapp?: boolean;
          activo?: boolean;
          correo?: string | null;
          created_at?: string;
          direccion?: string | null;
          id?: string;
          negocio_id: string;
          nombre: string;
          portada_url?: string | null;
          reservas_en_linea?: boolean;
          telefono?: string | null;
          updated_at?: string;
          zona_horaria?: string;
        };
        Update: {
          acepta_whatsapp?: boolean;
          activo?: boolean;
          correo?: string | null;
          created_at?: string;
          direccion?: string | null;
          id?: string;
          negocio_id?: string;
          nombre?: string;
          portada_url?: string | null;
          reservas_en_linea?: boolean;
          telefono?: string | null;
          updated_at?: string;
          zona_horaria?: string;
        };
        Relationships: [
          {
            foreignKeyName: "locales_negocio_id_fkey";
            columns: ["negocio_id"];
            isOneToOne: false;
            referencedRelation: "negocios";
            referencedColumns: ["id"];
          },
        ];
      };
      metodos_pago: {
        Row: {
          activo: boolean;
          id: string;
          negocio_id: string;
          nombre: string;
          orden: number;
          tipo: string;
        };
        ComputedFields: never;
        Insert: {
          activo?: boolean;
          id?: string;
          negocio_id: string;
          nombre: string;
          orden?: number;
          tipo: string;
        };
        Update: {
          activo?: boolean;
          id?: string;
          negocio_id?: string;
          nombre?: string;
          orden?: number;
          tipo?: string;
        };
        Relationships: [
          {
            foreignKeyName: "metodos_pago_negocio_id_fkey";
            columns: ["negocio_id"];
            isOneToOne: false;
            referencedRelation: "negocios";
            referencedColumns: ["id"];
          },
        ];
      };
      miembros: {
        Row: {
          correo: string;
          created_at: string;
          id: string;
          locales: string[];
          negocio_id: string;
          nombre: string;
          profesional_id: string | null;
          rol: Database["public"]["Enums"]["rol_miembro"];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          correo: string;
          created_at?: string;
          id?: string;
          locales?: string[];
          negocio_id: string;
          nombre: string;
          profesional_id?: string | null;
          rol: Database["public"]["Enums"]["rol_miembro"];
          user_id: string;
        };
        Update: {
          correo?: string;
          created_at?: string;
          id?: string;
          locales?: string[];
          negocio_id?: string;
          nombre?: string;
          profesional_id?: string | null;
          rol?: Database["public"]["Enums"]["rol_miembro"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "miembros_negocio_id_fkey";
            columns: ["negocio_id"];
            isOneToOne: false;
            referencedRelation: "negocios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "miembros_profesional_id_fkey";
            columns: ["profesional_id"];
            isOneToOne: false;
            referencedRelation: "profesionales";
            referencedColumns: ["id"];
          },
        ];
      };
      movimientos_caja: {
        Row: {
          concepto: string;
          contado: number | null;
          creado_por: string | null;
          created_at: string;
          efectivo: boolean;
          id: string;
          local_id: string;
          metodo: string | null;
          monto: number;
          negocio_id: string;
          pago_id: string | null;
          tipo: Database["public"]["Enums"]["tipo_movimiento"];
          venta_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          concepto: string;
          contado?: number | null;
          creado_por?: string | null;
          created_at?: string;
          efectivo?: boolean;
          id?: string;
          local_id: string;
          metodo?: string | null;
          monto: number;
          negocio_id: string;
          pago_id?: string | null;
          tipo: Database["public"]["Enums"]["tipo_movimiento"];
          venta_id?: string | null;
        };
        Update: {
          concepto?: string;
          contado?: number | null;
          creado_por?: string | null;
          created_at?: string;
          efectivo?: boolean;
          id?: string;
          local_id?: string;
          metodo?: string | null;
          monto?: number;
          negocio_id?: string;
          pago_id?: string | null;
          tipo?: Database["public"]["Enums"]["tipo_movimiento"];
          venta_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "movimientos_caja_creado_por_fkey";
            columns: ["creado_por"];
            isOneToOne: false;
            referencedRelation: "miembros";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "movimientos_caja_local_id_fkey";
            columns: ["local_id"];
            isOneToOne: false;
            referencedRelation: "locales";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "movimientos_caja_negocio_id_fkey";
            columns: ["negocio_id"];
            isOneToOne: false;
            referencedRelation: "negocios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "movimientos_caja_pago_id_fkey";
            columns: ["pago_id"];
            isOneToOne: false;
            referencedRelation: "pagos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "movimientos_caja_venta_id_fkey";
            columns: ["venta_id"];
            isOneToOne: false;
            referencedRelation: "ventas";
            referencedColumns: ["id"];
          },
        ];
      };
      movimientos_stock: {
        Row: {
          cantidad: number;
          creado_por: string | null;
          created_at: string;
          id: string;
          negocio_id: string;
          nota: string | null;
          producto_id: string;
          tipo: string;
          venta_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          cantidad: number;
          creado_por?: string | null;
          created_at?: string;
          id?: string;
          negocio_id: string;
          nota?: string | null;
          producto_id: string;
          tipo: string;
          venta_id?: string | null;
        };
        Update: {
          cantidad?: number;
          creado_por?: string | null;
          created_at?: string;
          id?: string;
          negocio_id?: string;
          nota?: string | null;
          producto_id?: string;
          tipo?: string;
          venta_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "movimientos_stock_creado_por_fkey";
            columns: ["creado_por"];
            isOneToOne: false;
            referencedRelation: "miembros";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "movimientos_stock_negocio_id_fkey";
            columns: ["negocio_id"];
            isOneToOne: false;
            referencedRelation: "negocios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "movimientos_stock_producto_id_fkey";
            columns: ["producto_id"];
            isOneToOne: false;
            referencedRelation: "productos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "movimientos_stock_venta_id_fkey";
            columns: ["venta_id"];
            isOneToOne: false;
            referencedRelation: "ventas";
            referencedColumns: ["id"];
          },
        ];
      };
      negocios: {
        Row: {
          created_at: string;
          descripcion: string | null;
          id: string;
          logo_url: string | null;
          moneda: string;
          nombre: string;
          pais: string;
          slug: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          descripcion?: string | null;
          id?: string;
          logo_url?: string | null;
          moneda?: string;
          nombre: string;
          pais?: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          descripcion?: string | null;
          id?: string;
          logo_url?: string | null;
          moneda?: string;
          nombre?: string;
          pais?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      numeracion_cambios: {
        Row: {
          creado_por: string | null;
          created_at: string;
          id: string;
          negocio_id: string;
          prefijo: string;
          prefijo_antes: string;
          siguiente: number;
          siguiente_antes: number;
        };
        ComputedFields: never;
        Insert: {
          creado_por?: string | null;
          created_at?: string;
          id?: string;
          negocio_id: string;
          prefijo: string;
          prefijo_antes: string;
          siguiente: number;
          siguiente_antes: number;
        };
        Update: {
          creado_por?: string | null;
          created_at?: string;
          id?: string;
          negocio_id?: string;
          prefijo?: string;
          prefijo_antes?: string;
          siguiente?: number;
          siguiente_antes?: number;
        };
        Relationships: [
          {
            foreignKeyName: "numeracion_cambios_creado_por_fkey";
            columns: ["creado_por"];
            isOneToOne: false;
            referencedRelation: "miembros";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "numeracion_cambios_negocio_id_fkey";
            columns: ["negocio_id"];
            isOneToOne: false;
            referencedRelation: "negocios";
            referencedColumns: ["id"];
          },
        ];
      };
      pagos: {
        Row: {
          abono: boolean;
          comprobante: string | null;
          creado_por: string | null;
          created_at: string;
          gift_card_id: string | null;
          id: string;
          metodo_id: string;
          monto: number;
          negocio_id: string;
          propina: number;
          recibido: number | null;
          venta_id: string;
        };
        ComputedFields: never;
        Insert: {
          abono?: boolean;
          comprobante?: string | null;
          creado_por?: string | null;
          created_at?: string;
          gift_card_id?: string | null;
          id?: string;
          metodo_id: string;
          monto: number;
          negocio_id: string;
          propina?: number;
          recibido?: number | null;
          venta_id: string;
        };
        Update: {
          abono?: boolean;
          comprobante?: string | null;
          creado_por?: string | null;
          created_at?: string;
          gift_card_id?: string | null;
          id?: string;
          metodo_id?: string;
          monto?: number;
          negocio_id?: string;
          propina?: number;
          recibido?: number | null;
          venta_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pagos_creado_por_fkey";
            columns: ["creado_por"];
            isOneToOne: false;
            referencedRelation: "miembros";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pagos_gift_card_id_fkey";
            columns: ["gift_card_id"];
            isOneToOne: false;
            referencedRelation: "gift_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pagos_metodo_id_fkey";
            columns: ["metodo_id"];
            isOneToOne: false;
            referencedRelation: "metodos_pago";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pagos_negocio_id_fkey";
            columns: ["negocio_id"];
            isOneToOne: false;
            referencedRelation: "negocios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pagos_venta_id_fkey";
            columns: ["venta_id"];
            isOneToOne: false;
            referencedRelation: "ventas";
            referencedColumns: ["id"];
          },
        ];
      };
      planes: {
        Row: {
          activo: boolean;
          created_at: string;
          descripcion: string | null;
          id: string;
          negocio_id: string;
          nombre: string;
          precio: number;
          servicios: string[];
          sesiones: number | null;
          vigencia_dias: number;
        };
        ComputedFields: never;
        Insert: {
          activo?: boolean;
          created_at?: string;
          descripcion?: string | null;
          id?: string;
          negocio_id: string;
          nombre: string;
          precio: number;
          servicios?: string[];
          sesiones?: number | null;
          vigencia_dias: number;
        };
        Update: {
          activo?: boolean;
          created_at?: string;
          descripcion?: string | null;
          id?: string;
          negocio_id?: string;
          nombre?: string;
          precio?: number;
          servicios?: string[];
          sesiones?: number | null;
          vigencia_dias?: number;
        };
        Relationships: [
          {
            foreignKeyName: "planes_negocio_id_fkey";
            columns: ["negocio_id"];
            isOneToOne: false;
            referencedRelation: "negocios";
            referencedColumns: ["id"];
          },
        ];
      };
      plantillas_whatsapp: {
        Row: {
          activo: boolean;
          created_at: string;
          cuerpo: string;
          id: string;
          negocio_id: string;
          nombre: string;
          orden: number;
        };
        ComputedFields: never;
        Insert: {
          activo?: boolean;
          created_at?: string;
          cuerpo: string;
          id?: string;
          negocio_id: string;
          nombre: string;
          orden?: number;
        };
        Update: {
          activo?: boolean;
          created_at?: string;
          cuerpo?: string;
          id?: string;
          negocio_id?: string;
          nombre?: string;
          orden?: number;
        };
        Relationships: [
          {
            foreignKeyName: "plantillas_whatsapp_negocio_id_fkey";
            columns: ["negocio_id"];
            isOneToOne: false;
            referencedRelation: "negocios";
            referencedColumns: ["id"];
          },
        ];
      };
      productos: {
        Row: {
          activo: boolean;
          categoria: string | null;
          created_at: string;
          existencias: number;
          id: string;
          negocio_id: string;
          nombre: string;
          precio: number;
          stock_minimo: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          activo?: boolean;
          categoria?: string | null;
          created_at?: string;
          existencias?: number;
          id?: string;
          negocio_id: string;
          nombre: string;
          precio: number;
          stock_minimo?: number;
          updated_at?: string;
        };
        Update: {
          activo?: boolean;
          categoria?: string | null;
          created_at?: string;
          existencias?: number;
          id?: string;
          negocio_id?: string;
          nombre?: string;
          precio?: number;
          stock_minimo?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "productos_negocio_id_fkey";
            columns: ["negocio_id"];
            isOneToOne: false;
            referencedRelation: "negocios";
            referencedColumns: ["id"];
          },
        ];
      };
      profesionales: {
        Row: {
          activo: boolean;
          color: string | null;
          created_at: string;
          foto_url: string | null;
          id: string;
          local_id: string;
          negocio_id: string;
          nombre: string;
          orden: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          activo?: boolean;
          color?: string | null;
          created_at?: string;
          foto_url?: string | null;
          id?: string;
          local_id: string;
          negocio_id: string;
          nombre: string;
          orden?: number;
          updated_at?: string;
        };
        Update: {
          activo?: boolean;
          color?: string | null;
          created_at?: string;
          foto_url?: string | null;
          id?: string;
          local_id?: string;
          negocio_id?: string;
          nombre?: string;
          orden?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profesionales_local_id_fkey";
            columns: ["local_id"];
            isOneToOne: false;
            referencedRelation: "locales";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profesionales_negocio_id_fkey";
            columns: ["negocio_id"];
            isOneToOne: false;
            referencedRelation: "negocios";
            referencedColumns: ["id"];
          },
        ];
      };
      recursos: {
        Row: {
          activo: boolean;
          created_at: string;
          descripcion: string | null;
          id: string;
          local_id: string;
          negocio_id: string;
          nombre: string;
          orden: number;
        };
        ComputedFields: never;
        Insert: {
          activo?: boolean;
          created_at?: string;
          descripcion?: string | null;
          id?: string;
          local_id: string;
          negocio_id: string;
          nombre: string;
          orden?: number;
        };
        Update: {
          activo?: boolean;
          created_at?: string;
          descripcion?: string | null;
          id?: string;
          local_id?: string;
          negocio_id?: string;
          nombre?: string;
          orden?: number;
        };
        Relationships: [
          {
            foreignKeyName: "recursos_local_id_fkey";
            columns: ["local_id"];
            isOneToOne: false;
            referencedRelation: "locales";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recursos_negocio_id_fkey";
            columns: ["negocio_id"];
            isOneToOne: false;
            referencedRelation: "negocios";
            referencedColumns: ["id"];
          },
        ];
      };
      sellos: {
        Row: {
          cita_id: string;
          cliente_id: string;
          created_at: string;
          id: string;
          negocio_id: string;
        };
        ComputedFields: never;
        Insert: {
          cita_id: string;
          cliente_id: string;
          created_at?: string;
          id?: string;
          negocio_id: string;
        };
        Update: {
          cita_id?: string;
          cliente_id?: string;
          created_at?: string;
          id?: string;
          negocio_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sellos_cita_id_fkey";
            columns: ["cita_id"];
            isOneToOne: true;
            referencedRelation: "citas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sellos_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sellos_negocio_id_fkey";
            columns: ["negocio_id"];
            isOneToOne: false;
            referencedRelation: "negocios";
            referencedColumns: ["id"];
          },
        ];
      };
      servicio_profesional: {
        Row: {
          profesional_id: string;
          servicio_id: string;
        };
        ComputedFields: never;
        Insert: {
          profesional_id: string;
          servicio_id: string;
        };
        Update: {
          profesional_id?: string;
          servicio_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "servicio_profesional_profesional_id_fkey";
            columns: ["profesional_id"];
            isOneToOne: false;
            referencedRelation: "profesionales";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "servicio_profesional_servicio_id_fkey";
            columns: ["servicio_id"];
            isOneToOne: false;
            referencedRelation: "servicios";
            referencedColumns: ["id"];
          },
        ];
      };
      servicios: {
        Row: {
          activo: boolean;
          categoria_id: string;
          created_at: string;
          cupo: number | null;
          descripcion: string | null;
          duracion_min: number;
          en_linea: boolean;
          id: string;
          imagenes: string[];
          incluye: string[];
          mostrar_duracion: boolean;
          mostrar_precio: boolean;
          negocio_id: string;
          nombre: string;
          orden: number;
          precio: number;
          recursos: string[];
          sesiones: number | null;
          tipo: string;
          updated_at: string;
          vigencia_dias: number | null;
        };
        ComputedFields: never;
        Insert: {
          activo?: boolean;
          categoria_id: string;
          created_at?: string;
          cupo?: number | null;
          descripcion?: string | null;
          duracion_min: number;
          en_linea?: boolean;
          id?: string;
          imagenes?: string[];
          incluye?: string[];
          mostrar_duracion?: boolean;
          mostrar_precio?: boolean;
          negocio_id: string;
          nombre: string;
          orden?: number;
          precio: number;
          recursos?: string[];
          sesiones?: number | null;
          tipo?: string;
          updated_at?: string;
          vigencia_dias?: number | null;
        };
        Update: {
          activo?: boolean;
          categoria_id?: string;
          created_at?: string;
          cupo?: number | null;
          descripcion?: string | null;
          duracion_min?: number;
          en_linea?: boolean;
          id?: string;
          imagenes?: string[];
          incluye?: string[];
          mostrar_duracion?: boolean;
          mostrar_precio?: boolean;
          negocio_id?: string;
          nombre?: string;
          orden?: number;
          precio?: number;
          recursos?: string[];
          sesiones?: number | null;
          tipo?: string;
          updated_at?: string;
          vigencia_dias?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "servicios_categoria_id_fkey";
            columns: ["categoria_id"];
            isOneToOne: false;
            referencedRelation: "categorias";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "servicios_negocio_id_fkey";
            columns: ["negocio_id"];
            isOneToOne: false;
            referencedRelation: "negocios";
            referencedColumns: ["id"];
          },
        ];
      };
      venta_items: {
        Row: {
          cantidad: number;
          cita_id: string | null;
          descripcion: string;
          gift_card_modelo_id: string | null;
          id: string;
          plan_id: string | null;
          precio_unitario: number;
          producto_id: string | null;
          profesional_id: string | null;
          servicio_id: string | null;
          total: number;
          venta_id: string;
          vigente: boolean;
        };
        ComputedFields: never;
        Insert: {
          cantidad?: number;
          cita_id?: string | null;
          descripcion: string;
          gift_card_modelo_id?: string | null;
          id?: string;
          plan_id?: string | null;
          precio_unitario: number;
          producto_id?: string | null;
          profesional_id?: string | null;
          servicio_id?: string | null;
          total: number;
          venta_id: string;
          vigente?: boolean;
        };
        Update: {
          cantidad?: number;
          cita_id?: string | null;
          descripcion?: string;
          gift_card_modelo_id?: string | null;
          id?: string;
          plan_id?: string | null;
          precio_unitario?: number;
          producto_id?: string | null;
          profesional_id?: string | null;
          servicio_id?: string | null;
          total?: number;
          venta_id?: string;
          vigente?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "venta_items_cita_id_fkey";
            columns: ["cita_id"];
            isOneToOne: false;
            referencedRelation: "citas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "venta_items_gift_card_modelo_id_fkey";
            columns: ["gift_card_modelo_id"];
            isOneToOne: false;
            referencedRelation: "gift_card_modelos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "venta_items_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "planes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "venta_items_producto_id_fkey";
            columns: ["producto_id"];
            isOneToOne: false;
            referencedRelation: "productos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "venta_items_profesional_id_fkey";
            columns: ["profesional_id"];
            isOneToOne: false;
            referencedRelation: "profesionales";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "venta_items_servicio_id_fkey";
            columns: ["servicio_id"];
            isOneToOne: false;
            referencedRelation: "servicios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "venta_items_venta_id_fkey";
            columns: ["venta_id"];
            isOneToOne: false;
            referencedRelation: "ventas";
            referencedColumns: ["id"];
          },
        ];
      };
      ventas: {
        Row: {
          anulada_at: string | null;
          anulada_por: string | null;
          cliente_id: string | null;
          correlativo: number;
          creada_por: string | null;
          created_at: string;
          descuento: number;
          estado: Database["public"]["Enums"]["estado_venta"];
          id: string;
          local_id: string;
          motivo_anulacion: string | null;
          negocio_id: string;
          numero: string | null;
          pagado: number;
          prefijo: string;
          subtotal: number;
          total: number;
        };
        ComputedFields: never;
        Insert: {
          anulada_at?: string | null;
          anulada_por?: string | null;
          cliente_id?: string | null;
          correlativo: number;
          creada_por?: string | null;
          created_at?: string;
          descuento?: number;
          estado: Database["public"]["Enums"]["estado_venta"];
          id?: string;
          local_id: string;
          motivo_anulacion?: string | null;
          negocio_id: string;
          numero?: never;
          pagado?: number;
          prefijo?: string;
          subtotal: number;
          total: number;
        };
        Update: {
          anulada_at?: string | null;
          anulada_por?: string | null;
          cliente_id?: string | null;
          correlativo?: number;
          creada_por?: string | null;
          created_at?: string;
          descuento?: number;
          estado?: Database["public"]["Enums"]["estado_venta"];
          id?: string;
          local_id?: string;
          motivo_anulacion?: string | null;
          negocio_id?: string;
          numero?: never;
          pagado?: number;
          prefijo?: string;
          subtotal?: number;
          total?: number;
        };
        Relationships: [
          {
            foreignKeyName: "ventas_anulada_por_fkey";
            columns: ["anulada_por"];
            isOneToOne: false;
            referencedRelation: "miembros";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ventas_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ventas_creada_por_fkey";
            columns: ["creada_por"];
            isOneToOne: false;
            referencedRelation: "miembros";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ventas_local_id_fkey";
            columns: ["local_id"];
            isOneToOne: false;
            referencedRelation: "locales";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ventas_negocio_id_fkey";
            columns: ["negocio_id"];
            isOneToOne: false;
            referencedRelation: "negocios";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      acceso_de: {
        Args: { p_token: string };
        Returns: {
          canal: Database["public"]["Enums"]["canal_aviso"];
          created_at: string;
          destino: string;
          negocio_id: string;
          token_hash: string;
          vence_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "accesos_cliente";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      agenda_citas: {
        Args: { p_desde: string; p_hasta: string; p_local: string };
        Returns: {
          aviso_correo: boolean;
          aviso_whatsapp: boolean;
          bono_id: string;
          bono_nombre: string;
          cliente_correo: string;
          cliente_desde: string;
          cliente_id: string;
          cliente_nombre: string;
          cliente_telefono: string;
          duracion_min: number;
          estado: Database["public"]["Enums"]["estado_cita"];
          fecha: string;
          hora_fin: string;
          hora_inicio: string;
          id: string;
          motivo_cancelacion: string;
          nota_cliente: string;
          nota_interna: string;
          origen: Database["public"]["Enums"]["origen_cita"];
          precio: number;
          profesional_fijo: boolean;
          profesional_id: string;
          recurso_id: string;
          serie_id: string;
          servicio_id: string;
          servicio_nombre: string;
          venta_estado: string;
          venta_id: string;
        }[];
      };
      agenda_clases: {
        Args: { p_desde: string; p_hasta: string; p_local: string };
        Returns: {
          cancelada: boolean;
          cupo: number;
          fecha: string;
          hora_fin: string;
          hora_inicio: string;
          id: string;
          inscritos: number;
          nota: string;
          precio: number;
          profesional_id: string;
          servicio_id: string;
          servicio_nombre: string;
        }[];
      };
      ajustar_numeracion: { Args: { p_prefijo: string; p_siguiente: number }; Returns: Json };
      anular_venta: { Args: { p_motivo: string; p_venta: string }; Returns: Json };
      audiencia_clientes: { Args: { p_filtro: Json; p_negocio: string }; Returns: string[] };
      audiencias_con_conteo: { Args: Record<PropertyKey, never>; Returns: Json };
      avisar_cita: {
        Args: { p_cita: string; p_extra?: string; p_tipo: string };
        Returns: undefined;
      };
      avisar_equipo: { Args: { p_ids: string[]; p_que: string }; Returns: undefined };
      avisar_lista_espera: { Args: { p_fecha: string; p_local: string }; Returns: undefined };
      bono_no_sirve: {
        Args: {
          b: Omit<
            Database["public"]["Tables"]["bonos"]["Row"],
            Database["public"]["Tables"]["bonos"]["ComputedFields"]
          >;
          c: Omit<
            Database["public"]["Tables"]["citas"]["Row"],
            Database["public"]["Tables"]["citas"]["ComputedFields"]
          >;
        };
        Returns: string;
      };
      bono_usadas: { Args: { p_bono: string; p_servicio?: string }; Returns: number };
      buscar_clientes: {
        Args: { p_texto: string };
        Returns: {
          apellido: string;
          barrio: string | null;
          correo: string | null;
          created_at: string;
          direccion: string | null;
          documento: string | null;
          fecha_nacimiento: string | null;
          genero: string | null;
          id: string;
          municipio: string | null;
          negocio_id: string;
          nombre: string;
          numero_cliente: string | null;
          recibe_campanas: boolean;
          telefono: string | null;
          updated_at: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "clientes";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      buscar_horas_libres: {
        Args: {
          p_cantidad?: number;
          p_desde: string;
          p_local: string;
          p_profesional?: string;
          p_servicio: string;
        };
        Returns: Json;
      };
      cambiar_estado_cita: {
        Args: { p_cita: string; p_estado: Database["public"]["Enums"]["estado_cita"] };
        Returns: Json;
      };
      cancelar_cita: {
        Args: { p_alcance: string; p_cita: string; p_motivo?: string };
        Returns: Json;
      };
      cancelar_clase: { Args: { p_clase: string; p_motivo?: string }; Returns: Json };
      canjear_premio: { Args: { p_cliente: string }; Returns: Json };
      cerrar_venta: { Args: { p: Json }; Returns: Json };
      choques_base: {
        Args: {
          p_cliente: string;
          p_duracion: number;
          p_excluir: string[];
          p_fecha: string;
          p_inicio: string;
          p_local: string;
          p_negocio: string;
          p_profesional: string;
        };
        Returns: Json;
      };
      choques_cita: {
        Args: {
          p_cita: string;
          p_cliente: string;
          p_duracion: number;
          p_fecha: string;
          p_inicio: string;
          p_local: string;
          p_profesional: string;
        };
        Returns: Json;
      };
      choques_permitidos: {
        Args: {
          a: Omit<
            Database["public"]["Tables"]["ajustes"]["Row"],
            Database["public"]["Tables"]["ajustes"]["ComputedFields"]
          >;
          p_choques: Json;
        };
        Returns: boolean;
      };
      choques_recurso: {
        Args: {
          p_cita: string;
          p_dur: number;
          p_fecha: string;
          p_hora: string;
          p_local: string;
          p_recurso: string;
          p_servicio: string;
        };
        Returns: Json;
      };
      clientes_de_contacto: {
        Args: { p_canal: string; p_negocio: string; p_valor: string };
        Returns: string[];
      };
      cobros_pendientes: {
        Args: { p_desde: string; p_hasta: string; p_profesional?: string };
        Returns: {
          cita_id: string;
          cliente_id: string;
          cliente_nombre: string;
          descripcion: string;
          estado: string;
          fecha: string;
          hora: string;
          monto: number;
          numero: string;
          profesional_id: string;
          tipo: string;
          total: number;
          venta_id: string;
        }[];
      };
      confirmar_cita_base: { Args: { p_cita: string }; Returns: undefined };
      contacto_normalizado: { Args: { p_dato: string }; Returns: string[] };
      contacto_oculto: { Args: { p_canal: string; p_valor: string }; Returns: string };
      contar_audiencia: { Args: { p_filtro: Json }; Returns: Json };
      crear_lo_vendido: {
        Args: {
          p_item: Omit<
            Database["public"]["Tables"]["venta_items"]["Row"],
            Database["public"]["Tables"]["venta_items"]["ComputedFields"]
          >;
          p_venta: Omit<
            Database["public"]["Tables"]["ventas"]["Row"],
            Database["public"]["Tables"]["ventas"]["ComputedFields"]
          >;
        };
        Returns: Json;
      };
      cupo_campanas: { Args: Record<PropertyKey, never>; Returns: number };
      demo_cerrar_inventario: { Args: { p_negocio: string }; Returns: undefined };
      demo_ids: { Args: { clave: string }; Returns: string };
      demo_sembrar: { Args: { p_negocio: string }; Returns: undefined };
      demo_sembrar_catalogo: { Args: { p_negocio: string }; Returns: undefined };
      demo_sembrar_citas: { Args: { p_negocio: string }; Returns: undefined };
      demo_sembrar_clases: { Args: { p_negocio: string }; Returns: undefined };
      demo_sembrar_clientes: { Args: { p_negocio: string }; Returns: undefined };
      demo_sembrar_espera: { Args: { p_negocio: string }; Returns: undefined };
      demo_sembrar_marketing: { Args: { p_negocio: string }; Returns: undefined };
      demo_sembrar_metodos: { Args: { p_negocio: string }; Returns: undefined };
      demo_sembrar_planes: { Args: { p_negocio: string }; Returns: undefined };
      demo_sembrar_productos: { Args: { p_negocio: string }; Returns: undefined };
      demo_sembrar_recordatorios: { Args: { p_negocio: string }; Returns: undefined };
      demo_sembrar_recursos: { Args: { p_negocio: string }; Returns: undefined };
      demo_sembrar_sede: { Args: { p_negocio: string }; Returns: undefined };
      demo_sembrar_ventas: { Args: { p_negocio: string }; Returns: undefined };
      demo_vaciar: { Args: { p_negocio: string }; Returns: undefined };
      demo_venta: {
        Args: {
          p_anulada: boolean;
          p_cita: Omit<
            Database["public"]["Tables"]["citas"]["Row"],
            Database["public"]["Tables"]["citas"]["ComputedFields"]
          >;
          p_cuando: string;
          p_h: number;
          p_negocio: string;
          p_numero: number;
        };
        Returns: undefined;
      };
      detalle_reserva: { Args: { p_cancelada?: boolean; p_ids: string[] }; Returns: string };
      dias_libres: {
        Args: {
          p_desde: string;
          p_dias: number;
          p_duracion: number;
          p_excluir?: string[];
          p_local: string;
          p_profesionales: string[];
        };
        Returns: Json;
      };
      enlace_espera: {
        Args: { p_fecha: string; p_profesional: string; p_servicios: string[]; p_slug: string };
        Returns: string;
      };
      enviar_campana: { Args: { p_campana: string }; Returns: Json };
      enviar_comprobante: { Args: { p_canal?: string; p_venta: string }; Returns: Json };
      enviar_plantilla: { Args: { p_cita: string; p_plantilla: string }; Returns: Json };
      error_clase: { Args: { p_code: string; p_field?: string; p_message: string }; Returns: Json };
      error_venta: { Args: { p_code: string; p_field?: string; p_message: string }; Returns: Json };
      estadisticas_recordatorios: { Args: { p_desde: string; p_hasta: string }; Returns: Json };
      estadisticas_reservas: { Args: { p_desde: string; p_hasta: string }; Returns: Json };
      estadisticas_ventas: { Args: { p_desde: string; p_hasta: string }; Returns: Json };
      estado_inscrito: { Args: { p_estado: string; p_inscrito: string }; Returns: Json };
      fecha_larga: { Args: { p_fecha: string }; Returns: string };
      grupo_reserva: { Args: { p_cita: string }; Returns: string[] };
      guardar_cita: { Args: { p: Json }; Returns: Json };
      guardar_clase: { Args: { p: Json }; Returns: Json };
      hhmm: { Args: { p: string }; Returns: string };
      horas_libres: {
        Args: {
          p_duracion: number;
          p_excluir?: string[];
          p_fecha: string;
          p_local: string;
          p_profesionales: string[];
        };
        Returns: {
          hora: string;
          profesional_id: string;
        }[];
      };
      hoy_bogota: { Args: Record<PropertyKey, never>; Returns: string };
      inscribir_clase: {
        Args: { p_bono?: string; p_clase: string; p_cliente: string };
        Returns: Json;
      };
      inscritos_clase: {
        Args: { p_clase: string };
        Returns: {
          bono_id: string;
          bono_nombre: string;
          cliente: string;
          cliente_id: string;
          estado: string;
          id: string;
          telefono: string;
        }[];
      };
      insertar_pagos: {
        Args: {
          p_abono: boolean;
          p_miembro: string;
          p_pagos: Json;
          p_venta: Omit<
            Database["public"]["Tables"]["ventas"]["Row"],
            Database["public"]["Tables"]["ventas"]["ComputedFields"]
          >;
        };
        Returns: undefined;
      };
      lista_espera_equipo: {
        Args: Record<PropertyKey, never>;
        Returns: {
          avisado_at: string;
          cliente: string;
          cliente_id: string;
          created_at: string;
          estado: string;
          fecha: string;
          franja: string;
          id: string;
          profesional: string;
          servicios: string;
          telefono: string;
        }[];
      };
      listar_bonos: {
        Args: { p_cliente?: string };
        Returns: {
          anulado: boolean;
          cliente: string;
          cliente_id: string;
          created_at: string;
          cupo: number;
          id: string;
          inicio: string;
          nombre: string;
          servicios: string[];
          tipo: string;
          usadas: number;
          vence: string;
          venta: string;
        }[];
      };
      listar_clientes: {
        Args: { p: Json };
        Returns: {
          apellido: string;
          correo: string;
          documento: string;
          id: string;
          nombre: string;
          telefono: string;
          total: number;
        }[];
      };
      listar_gift_cards: {
        Args: Record<PropertyKey, never>;
        Returns: {
          anulada: boolean;
          codigo: string;
          comprador: string;
          created_at: string;
          id: string;
          nombre: string;
          para: string;
          saldo: number;
          saldo_inicial: number;
          usos: number;
          vence: string;
          venta: string;
        }[];
      };
      listar_pagos: {
        Args: { p: Json };
        Returns: {
          abono: boolean;
          cliente_nombre: string;
          comprobante: string;
          created_at: string;
          filas: number;
          id: string;
          metodo: string;
          monto: number;
          propina: number;
          venta_estado: Database["public"]["Enums"]["estado_venta"];
          venta_id: string;
          venta_numero: string;
        }[];
      };
      listar_ventas: {
        Args: { p: Json };
        Returns: {
          cliente_id: string;
          cliente_nombre: string;
          created_at: string;
          estado: Database["public"]["Enums"]["estado_venta"];
          filas: number;
          id: string;
          metodos: string;
          numero: string;
          pagado: number;
          total: number;
        }[];
      };
      mi_negocio: { Args: Record<PropertyKey, never>; Returns: string };
      mi_profesional: { Args: Record<PropertyKey, never>; Returns: string };
      mi_rol: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Enums"]["rol_miembro"];
      };
      mover_existencias: {
        Args: { p_cantidad: number; p_nota: string; p_producto: string; p_tipo: string };
        Returns: Json;
      };
      nuevo_codigo_gift_card: { Args: { p_negocio: string }; Returns: string };
      pagar_saldo: { Args: { p: Json }; Returns: Json };
      pagos_filtrados: {
        Args: { p: Json };
        Returns: {
          abono: boolean;
          cliente_nombre: string;
          comprobante: string;
          created_at: string;
          id: string;
          metodo: string;
          metodo_tipo: string;
          monto: number;
          propina: number;
          venta_estado: Database["public"]["Enums"]["estado_venta"];
          venta_id: string;
          venta_numero: string;
        }[];
      };
      pesos_texto: { Args: { p: number }; Returns: string };
      plan_reserva: {
        Args: { p_profesional: string; p_servicios: string[]; p_slug: string };
        Returns: Json;
      };
      programar_recordatorios: { Args: { p_cita: string }; Returns: undefined };
      publico_calificar: {
        Args: { p_comentario?: string; p_estrellas: number; p_token: string };
        Returns: Json;
      };
      publico_cambiar_cita: {
        Args: { p_fecha: string; p_hora: string; p_token: string };
        Returns: Json;
      };
      publico_cancelar_cita: { Args: { p_motivo?: string; p_token: string }; Returns: Json };
      publico_cita: { Args: { p_token: string }; Returns: Json };
      publico_confirmar_cita: { Args: { p_token: string }; Returns: Json };
      publico_disponibilidad: {
        Args: {
          p_desde: string;
          p_dias: number;
          p_profesional: string;
          p_servicios: string[];
          p_slug: string;
        };
        Returns: Json;
      };
      publico_entrar_codigo: {
        Args: { p_codigo: string; p_dato: string; p_slug: string };
        Returns: Json;
      };
      publico_error: {
        Args: { p_code: string; p_field?: string; p_message: string };
        Returns: Json;
      };
      publico_horas_cita: {
        Args: { p_desde: string; p_dias: number; p_token: string };
        Returns: Json;
      };
      publico_lista_espera: { Args: { p: Json }; Returns: Json };
      publico_mis_citas: { Args: { p_token: string }; Returns: Json };
      publico_negocio: { Args: { p_slug: string }; Returns: Json };
      publico_pedir_codigo: { Args: { p_dato: string; p_slug: string }; Returns: Json };
      publico_quitar_espera: { Args: { p_id: string; p_token: string }; Returns: Json };
      publico_reservar: { Args: { p: Json }; Returns: Json };
      publico_salir: { Args: { p_token: string }; Returns: undefined };
      quitar_de_espera: { Args: { p_id: string }; Returns: Json };
      rectificar_caja: { Args: { p_contado: number; p_local: string }; Returns: Json };
      recurso_libre: {
        Args: {
          p_dur: number;
          p_excluir: string;
          p_fecha: string;
          p_hora: string;
          p_local: string;
          p_servicio: string;
        };
        Returns: string;
      };
      recurso_ocupado: {
        Args: {
          p_dur: number;
          p_excluir: string;
          p_fecha: string;
          p_hora: string;
          p_recurso: string;
        };
        Returns: string;
      };
      registrar_movimiento: { Args: { p: Json }; Returns: Json };
      reiniciar_demo: { Args: Record<PropertyKey, never>; Returns: undefined };
      responder_aviso_demo: { Args: { p_aviso: string }; Returns: Json };
      resumen_caja: { Args: { p_desde: string; p_hasta: string; p_local: string }; Returns: Json };
      resumen_pagos: { Args: { p: Json }; Returns: Json };
      resumen_ventas: { Args: { p: Json }; Returns: Json };
      revisar_item_extra: {
        Args: { p_item: Json; p_negocio: string };
        Returns: Record<string, unknown>;
      };
      revisar_pagos: { Args: { p_negocio: string; p_pagos: Json; p_saldo: number }; Returns: Json };
      soltar_bono: { Args: { p_cita: string }; Returns: Json };
      tarjetas_sellos: {
        Args: Record<PropertyKey, never>;
        Returns: {
          canjes: number;
          cliente: string;
          cliente_id: string;
          sellos: number;
          telefono: string;
          ultimo: string;
        }[];
      };
      turnos_periodo: {
        Args: { p_desde: string; p_hasta: string };
        Returns: {
          dia: number;
          fecha: string;
          minutos: number;
          profesional_id: string;
        }[];
      };
      usar_bono: { Args: { p_bono: string; p_cita: string }; Returns: Json };
      ventas_filtradas: {
        Args: { p: Json };
        Returns: {
          anulada_at: string | null;
          anulada_por: string | null;
          cliente_id: string | null;
          correlativo: number;
          creada_por: string | null;
          created_at: string;
          descuento: number;
          estado: Database["public"]["Enums"]["estado_venta"];
          id: string;
          local_id: string;
          motivo_anulacion: string | null;
          negocio_id: string;
          numero: string | null;
          pagado: number;
          prefijo: string;
          subtotal: number;
          total: number;
        }[];
        SetofOptions: {
          from: "*";
          to: "ventas";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
    };
    Enums: {
      canal_aviso: "correo" | "whatsapp";
      estado_cita:
        | "reservado"
        | "confirmado"
        | "asiste"
        | "no_asistio"
        | "pendiente"
        | "en_espera"
        | "cancelado";
      estado_venta: "pagada" | "parcial" | "anulada";
      origen_cita: "agenda" | "en_linea";
      rol_miembro: "dueno" | "recepcion" | "profesional";
      tipo_movimiento: "ingreso" | "egreso" | "traspaso" | "rectificacion";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      canal_aviso: ["correo", "whatsapp"],
      estado_cita: [
        "reservado",
        "confirmado",
        "asiste",
        "no_asistio",
        "pendiente",
        "en_espera",
        "cancelado",
      ],
      estado_venta: ["pagada", "parcial", "anulada"],
      origen_cita: ["agenda", "en_linea"],
      rol_miembro: ["dueno", "recepcion", "profesional"],
      tipo_movimiento: ["ingreso", "egreso", "traspaso", "rectificacion"],
    },
  },
} as const;
