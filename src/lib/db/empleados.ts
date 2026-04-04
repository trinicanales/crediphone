import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Empleado,
  UserRole,
  DesempenoVendedor,
  DesempenoCobrador,
} from "@/types";

/**
 * Obtiene todos los empleados
 * @param distribuidorId - Si se proporciona, filtra por distribuidor (admin); si es undefined, devuelve todos (super_admin)
 */
export async function getEmpleados(distribuidorId?: string): Promise<Empleado[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("users")
    .select("*")
    .order("name", { ascending: true });

  if (distribuidorId) {
    query = query.eq("distribuidor_id", distribuidorId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return mapEmpleadosFromDB(data);
}

/**
 * Obtiene solo empleados activos
 * @param distribuidorId - Si se proporciona, filtra por distribuidor (admin); si es undefined, devuelve todos (super_admin)
 */
export async function getEmpleadosActivos(distribuidorId?: string): Promise<Empleado[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("users")
    .select("*")
    .eq("activo", true)
    .order("name", { ascending: true });

  if (distribuidorId) {
    query = query.eq("distribuidor_id", distribuidorId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return mapEmpleadosFromDB(data);
}

/**
 * Obtiene un empleado por ID
 * @param distribuidorId - Si se proporciona, verifica que el empleado pertenezca a ese distribuidor (admin);
 *                         si es undefined, devuelve el empleado sin importar distribuidor (super_admin)
 */
export async function getEmpleadoById(id: string, distribuidorId?: string): Promise<Empleado | null> {
  const supabase = createAdminClient();
  let query = supabase
    .from("users")
    .select("*")
    .eq("id", id);

  if (distribuidorId) {
    query = query.eq("distribuidor_id", distribuidorId);
  }

  const { data, error } = await query.single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return mapEmpleadoFromDB(data);
}

/**
 * Obtiene empleados por rol específico
 * @param rol - Rol a filtrar
 * @param distribuidorId - Si se proporciona, filtra por distribuidor (admin); si es undefined, devuelve todos (super_admin)
 */
export async function getEmpleadosPorRol(rol: UserRole, distribuidorId?: string): Promise<Empleado[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("users")
    .select("*")
    .eq("role", rol)
    .eq("activo", true)
    .order("name", { ascending: true });

  if (distribuidorId) {
    query = query.eq("distribuidor_id", distribuidorId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return mapEmpleadosFromDB(data);
}

/**
 * Crea un nuevo empleado.
 * Primero crea el usuario en Supabase Auth, luego inserta en public.users.
 * Retorna el empleado creado y una contraseña temporal.
 */
export async function createEmpleado(
  empleado: Omit<Empleado, "id" | "createdAt" | "updatedAt">,
  distribuidorId?: string,
  customPassword?: string
): Promise<Empleado & { tempPassword: string }> {
  const supabase = createAdminClient();

  // Usar contraseña personalizada si es válida (mínimo 8 chars), o generar una
  const { randomBytes } = await import("crypto");
  const tempPassword =
    customPassword && customPassword.length >= 8
      ? customPassword
      : randomBytes(10).toString("base64url").slice(0, 12) + "A1!";

  // 1. Crear usuario en Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: empleado.email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { name: empleado.name },
  });

  if (authError) throw authError;
  if (!authData.user) throw new Error("No se pudo crear el usuario de autenticación");

  const userId = authData.user.id;

  // 2. Insertar en public.users con el id de Auth
  const { data, error } = await supabase
    .from("users")
    .insert({
      id: userId,
      email: empleado.email,
      name: empleado.name,
      role: empleado.role,
      telefono: empleado.telefono,
      direccion: empleado.direccion,
      fecha_ingreso: empleado.fechaIngreso,
      sueldo_base: empleado.sueldoBase ?? 0,
      comision_porcentaje: empleado.comisionPorcentaje ?? 0,
      foto_perfil: empleado.fotoPerfil,
      activo: empleado.activo ?? true,
      notas: empleado.notas,
      distribuidor_id: distribuidorId || null,
    })
    .select()
    .single();

  if (error) {
    // Rollback: eliminar usuario de Auth si falla la inserción en public.users
    await supabase.auth.admin.deleteUser(userId);
    throw error;
  }

  return { ...mapEmpleadoFromDB(data), tempPassword };
}

/**
 * Actualiza un empleado existente
 */
export async function updateEmpleado(
  id: string,
  empleado: Partial<Empleado>
): Promise<Empleado> {
  const supabase = createAdminClient();

  const updateData: Record<string, any> = {};

  if (empleado.email !== undefined) updateData.email = empleado.email;
  if (empleado.name !== undefined) updateData.name = empleado.name;
  if (empleado.role !== undefined) updateData.role = empleado.role;
  if (empleado.telefono !== undefined) updateData.telefono = empleado.telefono;
  if (empleado.direccion !== undefined)
    updateData.direccion = empleado.direccion;
  if (empleado.fechaIngreso !== undefined)
    updateData.fecha_ingreso = empleado.fechaIngreso;
  if (empleado.sueldoBase !== undefined)
    updateData.sueldo_base = empleado.sueldoBase;
  if (empleado.comisionPorcentaje !== undefined)
    updateData.comision_porcentaje = empleado.comisionPorcentaje;
  if (empleado.fotoPerfil !== undefined)
    updateData.foto_perfil = empleado.fotoPerfil;
  if (empleado.activo !== undefined) updateData.activo = empleado.activo;
  if (empleado.notas !== undefined) updateData.notas = empleado.notas;

  const { data, error } = await supabase
    .from("users")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return mapEmpleadoFromDB(data);
}

/**
 * Desactiva un empleado (soft delete)
 */
export async function deleteEmpleado(id: string): Promise<void> {
  const supabase = createAdminClient();

  // Soft delete: marcar como inactivo
  const { error } = await supabase
    .from("users")
    .update({ activo: false })
    .eq("id", id);

  if (error) throw error;
}

/**
 * Reactiva un empleado
 */
export async function reactivarEmpleado(id: string): Promise<Empleado> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("users")
    .update({ activo: true })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return mapEmpleadoFromDB(data);
}

/**
 * Busca empleados por nombre, email o teléfono
 * @param distribuidorId - Si se proporciona, filtra por distribuidor (admin); si es undefined, busca en todos (super_admin)
 */
export async function searchEmpleados(query: string, distribuidorId?: string): Promise<Empleado[]> {
  const supabase = createAdminClient();
  let dbQuery = supabase
    .from("users")
    .select("*")
    .or(
      `name.ilike.%${query}%,email.ilike.%${query}%,telefono.ilike.%${query}%`
    )
    .order("name", { ascending: true });

  if (distribuidorId) {
    dbQuery = dbQuery.eq("distribuidor_id", distribuidorId);
  }

  const { data, error } = await dbQuery;
  if (error) throw error;
  return mapEmpleadosFromDB(data);
}

/**
 * Calcula la comisión ganada por un vendedor en un período
 */
export async function calcularComisionVendedor(
  vendedorId: string,
  fechaInicio: Date,
  fechaFin: Date
): Promise<DesempenoVendedor> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("calcular_comision_vendedor", {
    vendedor_uuid: vendedorId,
    fecha_inicio: fechaInicio.toISOString().split("T")[0],
    fecha_fin: fechaFin.toISOString().split("T")[0],
  });

  if (error) throw error;

  const result = Array.isArray(data) ? data[0] : data;

  return {
    totalCreditos: result.total_creditos || 0,
    montoTotalVendido: parseFloat(result.monto_total_vendido || "0"),
    comisionGanada: parseFloat(result.comision_ganada || "0"),
  };
}

/**
 * Calcula el desempeño de un cobrador en un período
 */
export async function calcularDesempenoCobrador(
  cobradorId: string,
  fechaInicio: Date,
  fechaFin: Date
): Promise<DesempenoCobrador> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("calcular_desempeno_cobrador", {
    cobrador_uuid: cobradorId,
    fecha_inicio: fechaInicio.toISOString().split("T")[0],
    fecha_fin: fechaFin.toISOString().split("T")[0],
  });

  if (error) throw error;

  const result = Array.isArray(data) ? data[0] : data;

  return {
    totalPagos: result.total_pagos || 0,
    montoTotalCobrado: parseFloat(result.monto_total_cobrado || "0"),
  };
}

/**
 * Obtiene estadísticas generales de empleados
 * @param distribuidorId - Si se proporciona, filtra por distribuidor (admin); si es undefined, estadísticas globales (super_admin)
 */
export async function getEstadisticasEmpleados(distribuidorId?: string): Promise<{
  total: number;
  activos: number;
  inactivos: number;
  porRol: {
    admin: number;
    vendedor: number;
    cobrador: number;
    tecnico: number;
  };
}> {
  const supabase = createAdminClient();

  // Obtener empleados (filtrado por distribuidor si aplica)
  let query = supabase.from("users").select("role, activo");
  if (distribuidorId) {
    query = query.eq("distribuidor_id", distribuidorId);
  }
  const { data, error } = await query;

  if (error) throw error;

  const total = data.length;
  const activos = data.filter((e) => e.activo).length;
  const inactivos = total - activos;

  const porRol = {
    admin: data.filter((e) => e.role === "admin" && e.activo).length,
    vendedor: data.filter((e) => e.role === "vendedor" && e.activo).length,
    cobrador: data.filter((e) => e.role === "cobrador" && e.activo).length,
    tecnico: data.filter((e) => e.role === "tecnico" && e.activo).length,
  };

  return { total, activos, inactivos, porRol };
}

// =============================================
// FUNCIONES HELPER PARA MAPEO DB <-> TS
// =============================================

/**
 * Mapea un empleado de formato DB (snake_case) a TS (camelCase)
 */
function mapEmpleadoFromDB(dbEmpleado: any): Empleado {
  return {
    id: dbEmpleado.id,
    email: dbEmpleado.email,
    name: dbEmpleado.name,
    role: dbEmpleado.role,
    telefono: dbEmpleado.telefono,
    direccion: dbEmpleado.direccion,
    fechaIngreso: dbEmpleado.fecha_ingreso
      ? new Date(dbEmpleado.fecha_ingreso)
      : undefined,
    sueldoBase: dbEmpleado.sueldo_base
      ? parseFloat(dbEmpleado.sueldo_base)
      : 0,
    comisionPorcentaje: dbEmpleado.comision_porcentaje
      ? parseFloat(dbEmpleado.comision_porcentaje)
      : 0,
    fotoPerfil: dbEmpleado.foto_perfil,
    activo: dbEmpleado.activo ?? true,
    notas: dbEmpleado.notas,
    distribuidorId: dbEmpleado.distribuidor_id || null,
    createdAt: new Date(dbEmpleado.created_at),
    updatedAt: new Date(dbEmpleado.updated_at),
  };
}

/**
 * Mapea un array de empleados de DB a TS
 */
function mapEmpleadosFromDB(dbEmpleados: any[]): Empleado[] {
  return dbEmpleados.map(mapEmpleadoFromDB);
}
