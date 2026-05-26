"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import {
  X, ExternalLink, Edit, Loader2, Wrench, Clock, AlertCircle,
  MessageSquare, Package, Timer, FileText, Image as ImageIcon,
  DollarSign, Phone, CheckCircle, GitBranch, Printer, Plus, PackageCheck, PackagePlus,
  Download, History, ShieldAlert, UserCog, Link2, Copy, MessageCircle, RotateCcw, Pencil,
} from "lucide-react";
import { EstadoBadge, PrioridadBadge } from "@/components/reparaciones/EstadoBadge";
import { PresupuestoSummary } from "@/components/reparaciones/detail/PresupuestoSummary";
import { TimelineOrden } from "@/components/reparaciones/TimelineOrden";
import { GaleriaFotosOrden } from "@/components/reparaciones/GaleriaFotosOrden";
import { HistorialNotificaciones } from "@/components/reparaciones/HistorialNotificaciones";
import { ModalEditarOrden } from "@/components/reparaciones/ModalEditarOrden";
import { ModalEditarPresupuesto } from "@/components/reparaciones/ModalEditarPresupuesto";
import { ModalCambiarEstado } from "@/components/reparaciones/ModalCambiarEstado";
import { ModalWhatsAppEstado } from "@/components/reparaciones/ModalWhatsAppEstado";
import { PiezasInventarioPanel } from "@/components/reparaciones/PiezasInventarioPanel";
import { AnticipoCajaPanel } from "@/components/reparaciones/anticipos/AnticipoCajaPanel";
import { CentroMensajesPanel } from "@/components/reparaciones/mensajeria/CentroMensajesPanel";
import { BitacoraTiempoPanel } from "@/components/reparaciones/BitacoraTiempoPanel";
import { Card } from "@/components/ui/Card";
import type { OrdenReparacionDetallada, ReparacionDiagnostico } from "@/types";
import { generarMensajePromocion, generarMensajePresupuesto, generarMensajeSeguimiento, generarLinkWhatsApp } from "@/lib/whatsapp-reparaciones";

interface OrdenDrawerProps {
  ordenId: string | null;
  onClose: () => void;
  onRefresh: () => void;
  defaultTab?: string;
}

const TABS = [
  { id: "resumen",     label: "Resumen",    icon: FileText },
  { id: "diagnostico", label: "Diagnóstico", icon: Wrench },
  { id: "presupuesto", label: "Presupuesto", icon: DollarSign },
  { id: "historial",   label: "Historial",  icon: Clock },
  { id: "fotos",       label: "Fotos",      icon: ImageIcon },
  { id: "piezas",      label: "Piezas",     icon: Package },
  { id: "mensajeria",  label: "Mensajes",   icon: MessageSquare },
  { id: "tiempo",      label: "Tiempo",     icon: Timer },
];

// ─── Hook: detect mobile viewport ──────────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

// ─── Check if order is overdue ──────────────────────────────────────────────
function isOverdue(orden: OrdenReparacionDetallada): boolean {
  if (!orden.fechaEstimadaEntrega) return false;
  const terminal = ["entregado", "cancelado", "no_reparable"];
  if (terminal.includes(orden.estado)) return false;
  const estimate = new Date(orden.fechaEstimadaEntrega);
  return estimate < new Date();
}

export function OrdenDrawer({ ordenId, onClose, onRefresh, defaultTab = "resumen" }: OrdenDrawerProps) {
  const router = useRouter();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const [orden, setOrden] = useState<OrdenReparacionDetallada | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [drawerError, setDrawerError] = useState(false);
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [modalEditarOpen, setModalEditarOpen] = useState(false);
  const [modalPresupuestoOpen, setModalPresupuestoOpen] = useState(false);
  const [modalCambiarEstadoOpen, setModalCambiarEstadoOpen] = useState(false);
  const [estadoInicialModal, setEstadoInicialModal] = useState<import("@/types").EstadoOrdenReparacion | undefined>(undefined);
  const [editingFecha, setEditingFecha] = useState(false);
  const [nuevaFecha, setNuevaFecha] = useState("");
  const [savingFecha, setSavingFecha] = useState(false);
  const [savingAprobacion, setSavingAprobacion] = useState(false);

  // Promociones al momento de entrega
  const [clienteAceptaPromos, setClienteAceptaPromos] = useState<boolean | null>(null);

  // Pedidos de pieza
  interface PedidoPieza {
    id: string; nombrePieza: string; costoEstimado: number; costoEnvio: number;
    precioCliente: number | null; productoId: string | null;
    estado: "pendiente" | "en_camino" | "recibida" | "verificada_ok" | "defectuosa" | "instalada" | "cancelada";
    createdAt: string; fechaRecibida: string | null; fechaEstimadaLlegada: string | null;
    motivoDefecto: string | null; intentosReemplazo: number;
    creadoPorNombre: string | null; recibidoPorNombre: string | null;
  }
  const [pedidosPieza, setPedidosPieza] = useState<PedidoPieza[]>([]);
  const [mostrarFormPedido, setMostrarFormPedido] = useState(false);
  const [nuevaPiezaNombre, setNuevaPiezaNombre] = useState("");
  const [nuevaPiezaCosto, setNuevaPiezaCosto] = useState("");
  const [nuevaPiezaEnvio, setNuevaPiezaEnvio] = useState("");
  const [nuevaPiezaPrecioCliente, setNuevaPiezaPrecioCliente] = useState("");
  const [nuevaPiezaProductoId, setNuevaPiezaProductoId] = useState<string | null>(null);
  // Búsqueda en inventario para el form de piezas pedidas
  const [busquedaPieza, setBusquedaPieza] = useState("");
  const [resultadosBusquedaPieza, setResultadosBusquedaPieza] = useState<Array<{ id: string; nombre: string; precio: number; costo: number; stock: number }>>([]);
  const [buscandoPieza, setBuscandoPieza] = useState(false);
  const busquedaPiezaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [recibirInmediatamente, setRecibirInmediatamente] = useState(false);
  const [guardandoPedido, setGuardandoPedido] = useState(false);
  const [recibiendoPedido, setRecibiendoPedido] = useState<string | null>(null);
  const [marcandoEnCamino, setMarcandoEnCamino] = useState<string | null>(null);
  const [fechaLlegadaInput, setFechaLlegadaInput] = useState<Record<string, string>>({});
  const [verificandoPedido, setVerificandoPedido] = useState<string | null>(null);
  const [verifFormPedidoId, setVerifFormPedidoId] = useState<string | null>(null);
  const [motivoDefectoInput, setMotivoDefectoInput] = useState("");
  const [retrasoFormPedidoId, setRetrasoFormPedidoId] = useState<string | null>(null);
  const [retrasoFecha, setRetrasoFecha] = useState("");
  const [retrasoMotivo, setRetrasoMotivo] = useState("");
  const [guardandoRetraso, setGuardandoRetraso] = useState(false);
  // P3: Registrar pieza verificada en catálogo de inventario
  const [ingresarInventarioPiezaId, setIngresarInventarioPiezaId] = useState<string | null>(null);
  const [ingresarInventarioForm, setIngresarInventarioForm] = useState({ nombre: "", costo: "", precio: "" });
  const [ingresandoInventario, setIngresandoInventario] = useState(false);
  // P6: Búsqueda en catálogo para P3 prompt (vincular a producto existente)
  const [ingresarInvBusqueda, setIngresarInvBusqueda] = useState<Array<{ id: string; nombre: string; precio: number; stock: number }>>([]);
  const [ingresarInvBuscando, setIngresarInvBuscando] = useState(false);
  const ingresarInvTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // P8a: Agregar parte desde inventario en diagnóstico
  const [mostrarFormAgregarParte, setMostrarFormAgregarParte] = useState(false);
  const [agregarParteNombre, setAgregarParteNombre] = useState("");
  const [agregarParteCosto, setAgregarParteCosto] = useState("");
  const [agregarParteCantidad, setAgregarParteCantidad] = useState("1");
  const [agregarParteBusqueda, setAgregarParteBusqueda] = useState<Array<{ id: string; nombre: string; costo: number; stock: number }>>([]);
  const [agregarParteBuscando, setAgregarParteBuscando] = useState(false);
  const agregarParteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [guardandoParte, setGuardandoParte] = useState(false);
  // M3: Editar nombre de pieza (admin)
  const [editarNombrePiezaId, setEditarNombrePiezaId] = useState<string | null>(null);
  const [editarNombreValor, setEditarNombreValor] = useState("");
  const [guardandoNombrePieza, setGuardandoNombrePieza] = useState(false);

  // Solicitudes de cambio de precio
  interface SolicitudPrecio {
    id: string; estado: string; motivo: string | null; createdAt: string;
    costoReparacionActual: number; costoPartesActual: number;
    costoReparacionPropuesto: number; costoPartesPropuesto: number;
    solicitadoPorNombre: string | null;
  }
  const [solicitudesPrecio, setSolicitudesPrecio] = useState<SolicitudPrecio[]>([]);
  const [precioPendiente, setPrecioPendiente] = useState(false);
  const [aprobandoPrecio, setAprobandoPrecio] = useState<string | null>(null);

  // Versiones PDF
  interface VersionPDF {
    id: string; version: number; motivo: string;
    descripcion: string | null; urlPdf: string; createdAt: string;
  }
  const [versionesPDF, setVersionesPDF] = useState<VersionPDF[]>([]);
  const [cargandoPDF, setCargandoPDF] = useState(false);

  // C11: Historial de precios (solo admin/super_admin)
  interface HistorialPrecio {
    id: string; precioAnterior: number; precioNuevo: number;
    costoReparacionAnterior: number; costoPartesAnterior: number;
    costoReparacionNuevo: number; costoPartesNuevo: number;
    motivo: string | null; via: string; createdAt: string; cambiadoPor: string | null;
  }
  const [historialPrecios, setHistorialPrecios] = useState<HistorialPrecio[]>([]);
  const [cargandoHistorialPrecios, setCargandoHistorialPrecios] = useState(false);

  const fetchHistorialPrecios = useCallback(async () => {
    if (!ordenId || !isAdmin) return;
    setCargandoHistorialPrecios(true);
    try {
      const res = await fetch(`/api/reparaciones/${ordenId}/historial-precios`);
      const data = await res.json();
      if (data.success) {
        setHistorialPrecios((data.data ?? []).map((h: any) => ({
          id: h.id,
          precioAnterior: Number(h.precio_anterior ?? 0),
          precioNuevo: Number(h.precio_nuevo ?? 0),
          costoReparacionAnterior: Number(h.costo_reparacion_anterior ?? 0),
          costoPartesAnterior: Number(h.costo_partes_anterior ?? 0),
          costoReparacionNuevo: Number(h.costo_reparacion_nuevo ?? 0),
          costoPartesNuevo: Number(h.costo_partes_nuevo ?? 0),
          motivo: h.motivo ?? null,
          via: h.via ?? "",
          createdAt: h.created_at,
          cambiadoPor: h.cambiado_por ?? null,
        })));
      }
    } finally {
      setCargandoHistorialPrecios(false);
    }
  }, [ordenId, isAdmin]);

  // D5: Garantía — reclamación
  const [garantiaActiva, setGarantiaActiva] = useState<boolean>(false);
  const [garantiaVencimiento, setGarantiaVencimiento] = useState<string | null>(null);
  const [cargandoGarantia, setCargandoGarantia] = useState(false);
  const [mostrarFormReclamo, setMostrarFormReclamo] = useState(false);
  const [motivoReclamo, setMotivoReclamo] = useState("");
  const [reclamando, setReclamando] = useState(false);
  // M9: Reingresar equipo entregado como garantía
  const [mostrarFormReingreso, setMostrarFormReingreso] = useState(false);
  const [motivoReingreso, setMotivoReingreso] = useState("");
  const [reingresando, setReingresando] = useState(false);
  // C3: Revertir estado (solo admin)
  const [revertirModalOpen, setRevertirModalOpen] = useState(false);
  const [motivoRevertir, setMotivoRevertir] = useState("");
  const [reviertendoEstado, setRevirtiendoEstado] = useState(false);
  // M2: tracking link
  const [trackingCopiado, setTrackingCopiado] = useState(false);
  // E5: teléfono copiado
  const [telefonoCopiado, setTelefonoCopiado] = useState(false);
  // E8: Modal WA post-cambio de estado
  const [waModalOpen, setWaModalOpen] = useState(false);
  const [waModalEstado, setWaModalEstado] = useState<import("@/types").EstadoOrdenReparacion>("recibido");
  const [waModalNotas, setWaModalNotas] = useState<string | undefined>(undefined);
  // E7: Aprobar presencialmente
  const [aprobandoPresencial, setAprobandoPresencial] = useState(false);
  // Compartir tracking (panel expandible)
  const [compartirOpen, setCompartirOpen] = useState(false);
  const [compartirUrl, setCompartirUrl] = useState<string | null>(null);
  const [compartirCopiado, setCompartirCopiado] = useState(false);
  const [cargandoCompartir, setCargandoCompartir] = useState(false);

  // B3: Editar piezas cotizadas
  const [editandoCotizacion, setEditandoCotizacion] = useState(false);
  const [piezasCotEditadas, setPiezasCotEditadas] = useState<import("@/types").PiezaCotizacion[]>([]);
  const [guardandoCotizacion, setGuardandoCotizacion] = useState(false);
  const [editPiezaCotId, setEditPiezaCotId] = useState<string | null>(null);
  const [editPiezaCotForm, setEditPiezaCotForm] = useState({ nombre: "", cantidad: "1", precioTotal: "" });
  const [nuevaPiezaCotForm, setNuevaPiezaCotForm] = useState({ nombre: "", cantidad: "1", precioTotal: "" });
  const [mostrandoFormNuevaPiezaCot, setMostrandoFormNuevaPiezaCot] = useState(false);

  // C5+C6: Editar problema reportado y notas internas
  const [editProblema, setEditProblema] = useState(false);
  const [problemaEditado, setProblemaEditado] = useState("");
  const [guardandoProblema, setGuardandoProblema] = useState(false);
  const [editNotas, setEditNotas] = useState(false);
  const [notasEditadas, setNotasEditadas] = useState("");
  const [guardandoNotas, setGuardandoNotas] = useState(false);

  // M1: comunicaciones WA
  interface ComunicacionWA {
    id: string;
    tipo: "wa" | "fallida";
    canal: string;
    estado: string;
    resumen: string;
    error: string | null;
    creadoEn: string;
  }
  const [comunicaciones, setComunicaciones] = useState<ComunicacionWA[]>([]);
  const [cargandoComunicaciones, setCargandoComunicaciones] = useState(false);

  const fetchComunicaciones = useCallback(async () => {
    if (!ordenId) return;
    setCargandoComunicaciones(true);
    try {
      const res = await fetch(`/api/reparaciones/${ordenId}/comunicaciones`);
      const data = await res.json();
      if (data.success) setComunicaciones(data.data ?? []);
    } catch { /* silencioso */ }
    finally { setCargandoComunicaciones(false); }
  }, [ordenId]);

  // M4: Contexto del cliente
  interface ClienteResumen {
    ordenesActivas: number;
    saldoPendiente: number;
    puntos: number;
    totalOrdenes: number;
    // C4: datos adicionales
    ordenesActivasFolios?: Array<{ id: string; folio: string; estado: string }>;
    historialReciente?: Array<{ id: string; folio: string; estado: string; marca?: string; modelo?: string; problema?: string; total: number; fecha: string }>;
  }
  const [clienteResumen, setClienteResumen] = useState<ClienteResumen | null>(null);

  const fetchClienteResumen = useCallback(async (clienteId: string) => {
    try {
      const res = await fetch(`/api/clientes/${clienteId}/resumen`);
      const data = await res.json();
      if (data.success) setClienteResumen(data.data);
    } catch { /* silencioso */ }
  }, []);

  const fetchGarantia = useCallback(async () => {
    if (!ordenId || orden?.estado !== "entregado") return;
    setCargandoGarantia(true);
    try {
      const res = await fetch(`/api/reparaciones/${ordenId}/garantia?verificar=true`);
      const data = await res.json();
      if (data.success) {
        setGarantiaActiva(data.data.activa ?? false);
        setGarantiaVencimiento(data.data.garantia?.fechaVencimiento ?? null);
      }
    } finally {
      setCargandoGarantia(false);
    }
  }, [ordenId, orden?.estado]);

  const handleReclamarGarantia = async () => {
    if (!orden || !motivoReclamo.trim()) return;
    setReclamando(true);
    try {
      const res = await fetch(`/api/reparaciones/${orden.id}/garantia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crearOrdenGarantia: true, motivoReclamo: motivoReclamo.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ ${data.message ?? "Orden de garantía creada."}`);
        setMostrarFormReclamo(false);
        setMotivoReclamo("");
        onRefresh();
      } else {
        alert(`Error: ${data.message ?? "No se pudo crear la orden de garantía."}`);
      }
    } catch {
      alert("Error de conexión al reclamar garantía.");
    } finally {
      setReclamando(false);
    }
  };

  // M10: Re-notificar cotización modificada
  const [renotificando, setRenotificando] = useState(false);

  const handleRenotificarPresupuesto = async () => {
    if (!orden) return;
    setRenotificando(true);
    try {
      const res = await fetch(`/api/reparaciones/${orden.id}/renotificar-presupuesto`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        // Componer link de WA con el tracking link
        const baseUrl = window.location.origin;
        const trackingUrl = data.trackingToken
          ? `${baseUrl}/tracking/${data.trackingToken}`
          : `${baseUrl}/reparacion/${orden.folio}`;
        const tel = data.telefono ? String(data.telefono).replace(/\D/g, "") : "";
        const monto = orden.costoTotal ?? 0;
        const msg = encodeURIComponent(
          `Hola, hemos actualizado el presupuesto de su servicio (${orden.marcaDispositivo ?? ""} ${orden.modeloDispositivo ?? ""}). El nuevo total es $${monto.toLocaleString("es-MX", { minimumFractionDigits: 2 })}. Por favor revise y autorice en el siguiente link:\n${trackingUrl}`
        );
        const waUrl = tel
          ? `https://wa.me/52${tel}?text=${msg}`
          : `https://wa.me/?text=${msg}`;
        window.open(waUrl, "_blank");
        await fetchOrden();
      } else {
        alert(data.error || "Error al renotificar");
      }
    } catch {
      alert("Error de conexión");
    } finally {
      setRenotificando(false);
    }
  };

  // M9: Reingresar equipo entregado como garantía (sin requerir garantía activa)
  const handleReingresarComoGarantia = async () => {
    if (!orden || !motivoReingreso.trim()) return;
    setReingresando(true);
    try {
      const res = await fetch(`/api/reparaciones/${orden.id}/garantia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crearOrdenGarantia: true, motivoReclamo: motivoReingreso.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ ${data.message ?? "Orden de garantía creada. El equipo fue reingresado."}`);
        setMostrarFormReingreso(false);
        setMotivoReingreso("");
        onRefresh();
      } else {
        alert(`Error: ${data.message ?? "No se pudo crear la orden de garantía."}`);
      }
    } catch {
      alert("Error de conexión al reingresar equipo.");
    } finally {
      setReingresando(false);
    }
  };

  // D4: Historial de diagnósticos múltiples
  const [historialDiagnosticos, setHistorialDiagnosticos] = useState<ReparacionDiagnostico[]>([]);
  const [cargandoDiagnosticos, setCargandoDiagnosticos] = useState(false);

  const fetchHistorialDiagnosticos = useCallback(async () => {
    if (!ordenId) return;
    setCargandoDiagnosticos(true);
    try {
      const res = await fetch(`/api/reparaciones/${ordenId}/diagnosticos`);
      const data = await res.json();
      if (data.success) setHistorialDiagnosticos(data.data ?? []);
    } finally {
      setCargandoDiagnosticos(false);
    }
  }, [ordenId]);

  // I7: Reasignar técnico (solo admin/super_admin)
  const [reasignarOpen, setReasignarOpen] = useState(false);
  const [tecnicos, setTecnicos] = useState<{ id: string; nombre: string }[]>([]);
  const [nuevoTecnicoId, setNuevoTecnicoId] = useState("");
  const [reasignando, setReasignando] = useState(false);

  const fetchTecnicos = useCallback(async () => {
    try {
      const res = await fetch("/api/empleados");
      const data = await res.json();
      if (data.success) {
        const todos = data.data ?? [];
        setTecnicos(
          todos
            .filter((e: { role?: string }) => e.role === "tecnico" || e.role === "admin")
            .map((e: { id: string; name?: string }) => ({ id: e.id, nombre: e.name ?? e.id }))
        );
      }
    } catch { /* silencioso */ }
  }, []);

  const handleReasignar = async () => {
    if (!nuevoTecnicoId || !ordenId) return;
    setReasignando(true);
    try {
      const res = await fetch(`/api/reparaciones/${ordenId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tecnicoId: nuevoTecnicoId }),
      });
      const data = await res.json();
      if (data.success) {
        setReasignarOpen(false);
        setNuevoTecnicoId("");
        await fetchOrden();
        onRefresh();
      }
    } catch { /* silencioso */ }
    finally { setReasignando(false); }
  };

  /** Abre el modal de cambio de estado, opcionalmente pre-seleccionando un destino */
  function abrirCambiarEstado(estadoDestino?: import("@/types").EstadoOrdenReparacion) {
    setEstadoInicialModal(estadoDestino);
    setModalCambiarEstadoOpen(true);
  }

  const isOpen = !!ordenId;

  const fetchOrden = useCallback(async () => {
    if (!ordenId) return;
    try {
      setLoading(true);
      setDrawerError(false);
      const res = await fetch(`/api/reparaciones/${ordenId}`);
      const data = await res.json();
      if (data.success) {
        setOrden(data.data);
      } else {
        setDrawerError(true);
      }
    } catch (err) {
      console.error("Error cargando orden en drawer:", err);
      setDrawerError(true);
    } finally {
      setLoading(false);
      setHasFetched(true);
    }
  }, [ordenId]);

  useEffect(() => {
    if (ordenId) {
      setHasFetched(false);
      fetchOrden();
      setActiveTab(defaultTab);
    } else {
      setOrden(null);
      setHasFetched(false);
    }
  }, [ordenId, defaultTab, fetchOrden]);

  // Cerrar con Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  // Bloquear scroll del body cuando drawer está abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  function handleSuccess() {
    fetchOrden();
    onRefresh();
  }

  // Fetch cliente promo preference when order is listo_entrega
  useEffect(() => {
    if (orden?.estado === "listo_entrega" && orden.clienteId) {
      fetch(`/api/clientes/${orden.clienteId}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.success) setClienteAceptaPromos(d.data?.acepta_promociones_whatsapp ?? false);
        })
        .catch(() => {});
    }
  }, [orden?.estado, orden?.clienteId]);

  const fetchPedidosPieza = useCallback(async () => {
    if (!ordenId) return;
    try {
      const res = await fetch(`/api/reparaciones/${ordenId}/pedidos-pieza`);
      const data = await res.json();
      if (data.success) setPedidosPieza(data.data);
    } catch { /* silencioso */ }
  }, [ordenId]);

  useEffect(() => {
    if ((activeTab === "diagnostico" || activeTab === "presupuesto") && ordenId) fetchPedidosPieza();
  }, [activeTab, ordenId, fetchPedidosPieza]);

  // Búsqueda de inventario para piezas pedidas (M1)
  const buscarPiezaEnInventario = useCallback((query: string) => {
    if (busquedaPiezaTimer.current) clearTimeout(busquedaPiezaTimer.current);
    if (!query.trim()) { setResultadosBusquedaPieza([]); return; }
    busquedaPiezaTimer.current = setTimeout(async () => {
      setBuscandoPieza(true);
      try {
        const res = await fetch(`/api/productos?busqueda=${encodeURIComponent(query)}&limit=8`);
        const data = await res.json();
        if (data.success) {
          setResultadosBusquedaPieza(
            (data.data ?? []).map((p: { id: string; nombre: string; precio: number; costo: number; stockActual?: number }) => ({
              id: p.id,
              nombre: p.nombre,
              precio: p.precio,
              costo: p.costo,
              stock: p.stockActual ?? 0,
            }))
          );
        }
      } catch { /* silencioso */ }
      finally { setBuscandoPieza(false); }
    }, 300);
  }, []);

  const fetchSolicitudesPrecio = useCallback(async () => {
    if (!ordenId) return;
    try {
      const res = await fetch(`/api/reparaciones/${ordenId}/solicitudes-precio`);
      const data = await res.json();
      if (data.success) {
        setSolicitudesPrecio(data.data);
        setPrecioPendiente(data.precioPendienteAprobacion ?? false);
      }
    } catch { /* silencioso */ }
  }, [ordenId]);

  const fetchVersionesPDF = useCallback(async () => {
    if (!ordenId) return;
    setCargandoPDF(true);
    try {
      const res = await fetch(`/api/reparaciones/${ordenId}/versiones-pdf`);
      const data = await res.json();
      if (data.success) setVersionesPDF(data.data);
    } catch { /* silencioso */ }
    finally { setCargandoPDF(false); }
  }, [ordenId]);

  // Cargar solicitudes de precio siempre que cambie la orden (para el badge)
  useEffect(() => {
    if (ordenId) fetchSolicitudesPrecio();
  }, [ordenId, fetchSolicitudesPrecio]);

  // Cargar versiones PDF y historial de precios al abrir el tab presupuesto
  useEffect(() => {
    if (activeTab === "presupuesto" && ordenId) {
      fetchVersionesPDF();
      fetchHistorialPrecios();
    }
  }, [activeTab, ordenId, fetchVersionesPDF, fetchHistorialPrecios]);

  useEffect(() => {
    if (activeTab === "diagnostico" && ordenId) fetchHistorialDiagnosticos();
  }, [activeTab, ordenId, fetchHistorialDiagnosticos]);

  useEffect(() => {
    if (orden?.estado === "entregado" && ordenId) fetchGarantia();
  }, [orden?.estado, ordenId, fetchGarantia]);

  useEffect(() => {
    if (activeTab === "resumen" && ordenId) fetchComunicaciones();
  }, [activeTab, ordenId, fetchComunicaciones]);

  useEffect(() => {
    if (orden?.clienteId) fetchClienteResumen(orden.clienteId);
  }, [orden?.clienteId, fetchClienteResumen]);

  function resetFormPedido() {
    setMostrarFormPedido(false);
    setNuevaPiezaNombre("");
    setNuevaPiezaCosto("");
    setNuevaPiezaEnvio("");
    setNuevaPiezaPrecioCliente("");
    setNuevaPiezaProductoId(null);
    setBusquedaPieza("");
    setResultadosBusquedaPieza([]);
    setRecibirInmediatamente(false);
  }

  async function handleGuardarPedido() {
    if (!orden || !nuevaPiezaNombre.trim()) return;
    setGuardandoPedido(true);
    try {
      const body: Record<string, unknown> = {
        nombrePieza: nuevaPiezaNombre.trim(),
        costoEstimado: parseFloat(nuevaPiezaCosto) || 0,
        costoEnvio: parseFloat(nuevaPiezaEnvio) || 0,
        recibirInmediatamente,
      };
      if (nuevaPiezaProductoId) body.productoId = nuevaPiezaProductoId;
      if (nuevaPiezaPrecioCliente) body.precioCliente = parseFloat(nuevaPiezaPrecioCliente) || 0;
      const res = await fetch(`/api/reparaciones/${orden.id}/pedidos-pieza`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        resetFormPedido();
        fetchPedidosPieza();
        if (recibirInmediatamente) fetchOrden();
      } else {
        alert(data.error || "Error al guardar pedido");
      }
    } finally {
      setGuardandoPedido(false);
    }
  }

  // M3: Guardar edición de nombre de pieza
  async function handleGuardarNombrePieza(pedidoId: string) {
    if (!orden || !editarNombreValor.trim()) return;
    setGuardandoNombrePieza(true);
    try {
      const res = await fetch(`/api/reparaciones/${orden.id}/pedidos-pieza/${pedidoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombrePieza: editarNombreValor.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setEditarNombrePiezaId(null);
        setEditarNombreValor("");
        fetchPedidosPieza();
      } else {
        alert(data.error || "Error al editar nombre");
      }
    } catch { /* silencioso */ }
    finally { setGuardandoNombrePieza(false); }
  }

  async function handleRevisionPrecio(solicitudId: string, accion: "aprobar" | "rechazar") {
    if (!orden) return;
    setAprobandoPrecio(solicitudId);
    try {
      const res = await fetch(`/api/reparaciones/${orden.id}/solicitudes-precio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solicitudId, accion }),
      });
      const data = await res.json();
      if (data.success) {
        fetchSolicitudesPrecio();
        if (accion === "aprobar") { fetchOrden(); fetchHistorialPrecios(); }
      } else {
        alert(data.error || "Error al procesar solicitud");
      }
    } finally {
      setAprobandoPrecio(null);
    }
  }

  async function handleRecibirPedido(pedidoId: string) {
    if (!orden) return;
    setRecibiendoPedido(pedidoId);
    try {
      const res = await fetch(`/api/reparaciones/${orden.id}/pedidos-pieza/${pedidoId}/recibir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        fetchPedidosPieza();
        fetchOrden();
      } else {
        alert(data.error || "Error al recibir pieza");
      }
    } finally {
      setRecibiendoPedido(null);
    }
  }

  async function handleMarcarEnCamino(pedidoId: string) {
    if (!orden) return;
    setMarcandoEnCamino(pedidoId);
    try {
      const fecha = fechaLlegadaInput[pedidoId];
      const res = await fetch(`/api/reparaciones/${orden.id}/pedidos-pieza`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedidoId, fechaEstimadaLlegada: fecha || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        fetchPedidosPieza();
      } else {
        alert(data.error || "Error al marcar en camino");
      }
    } finally {
      setMarcandoEnCamino(null);
    }
  }

  async function handleVerificarPedido(pedidoId: string, llegoBien: boolean) {
    if (!orden) return;
    setVerificandoPedido(pedidoId);
    try {
      const res = await fetch(`/api/reparaciones/${orden.id}/pedidos-pieza/${pedidoId}/verificar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ llegoBien, motivo: llegoBien ? undefined : (motivoDefectoInput.trim() || "Sin especificar") }),
      });
      const data = await res.json();
      if (data.success) {
        if (llegoBien) {
          const pieza = pedidosPieza.find((pp) => pp.id === pedidoId);
          if (pieza && !pieza.productoId) {
            setIngresarInventarioPiezaId(pedidoId);
            setIngresarInventarioForm({
              nombre: pieza.nombrePieza,
              costo: pieza.costoEstimado.toFixed(2),
              precio: pieza.precioCliente !== null ? pieza.precioCliente.toFixed(2) : "",
            });
          }
        }
        setVerifFormPedidoId(null);
        setMotivoDefectoInput("");
        fetchPedidosPieza();
        fetchOrden();
      } else {
        alert(data.error || "Error al verificar pieza");
      }
    } finally {
      setVerificandoPedido(null);
    }
  }

  async function handleIngresarInventario(pedidoId: string) {
    if (!orden) return;
    setIngresandoInventario(true);
    try {
      const resProducto = await fetch("/api/productos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: ingresarInventarioForm.nombre.trim(),
          costo: parseFloat(ingresarInventarioForm.costo) || 0,
          precio: parseFloat(ingresarInventarioForm.precio) || parseFloat(ingresarInventarioForm.costo) || 0,
          stock: 0,
          tipo: "pieza",
        }),
      });
      const dataProducto = await resProducto.json();
      if (!dataProducto.success) {
        alert(dataProducto.error || "Error al crear producto en catálogo");
        return;
      }
      // Vincular pedido al nuevo producto
      await fetch(`/api/reparaciones/${orden.id}/pedidos-pieza/${pedidoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productoId: dataProducto.data.id }),
      });
      setIngresarInventarioPiezaId(null);
      fetchPedidosPieza();
    } catch {
      alert("Error al conectar con el servidor");
    } finally {
      setIngresandoInventario(false);
    }
  }

  // P6: Vincular pieza P3 a un producto ya existente (sin crear nuevo)
  async function handleIngresarInventarioVincular(pedidoId: string, productoId: string) {
    if (!orden) return;
    setIngresandoInventario(true);
    try {
      await fetch(`/api/reparaciones/${orden.id}/pedidos-pieza/${pedidoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productoId }),
      });
      setIngresarInventarioPiezaId(null);
      setIngresarInvBusqueda([]);
      fetchPedidosPieza();
    } catch { /* silencioso */ } finally {
      setIngresandoInventario(false);
    }
  }

  // P6: Búsqueda con debounce en P3 form
  function buscarInventarioP3(nombre: string) {
    setIngresarInventarioForm(f => ({ ...f, nombre }));
    setIngresarInvBusqueda([]);
    if (ingresarInvTimer.current) clearTimeout(ingresarInvTimer.current);
    if (nombre.trim().length < 2) return;
    ingresarInvTimer.current = setTimeout(async () => {
      setIngresarInvBuscando(true);
      try {
        const res = await fetch(`/api/productos?q=${encodeURIComponent(nombre.trim())}&limit=4`);
        const data = await res.json();
        if (data.success) {
          setIngresarInvBusqueda(
            (data.data ?? []).map((p: any) => ({
              id: p.id,
              nombre: p.nombre,
              precio: p.precioVenta ?? p.precio ?? 0,
              stock: p.stock ?? 0,
            }))
          );
        }
      } catch { /* silencioso */ } finally {
        setIngresarInvBuscando(false);
      }
    }, 300);
  }

  // P8a: Buscar parte para agregar al diagnóstico
  function buscarParteInventario(nombre: string) {
    setAgregarParteNombre(nombre);
    setAgregarParteBusqueda([]);
    if (agregarParteTimer.current) clearTimeout(agregarParteTimer.current);
    if (nombre.trim().length < 2) return;
    agregarParteTimer.current = setTimeout(async () => {
      setAgregarParteBuscando(true);
      try {
        const res = await fetch(`/api/productos?q=${encodeURIComponent(nombre.trim())}&limit=4`);
        const data = await res.json();
        if (data.success) {
          setAgregarParteBusqueda(
            (data.data ?? []).map((p: any) => ({
              id: p.id,
              nombre: p.nombre,
              costo: p.costoCompra ?? p.costo ?? 0,
              stock: p.stock ?? 0,
            }))
          );
        }
      } catch { /* silencioso */ } finally {
        setAgregarParteBuscando(false);
      }
    }, 300);
  }

  // P8a: Guardar nueva parte a reemplazar (PATCH diagnóstico)
  async function handleAgregarParte() {
    if (!orden || !agregarParteNombre.trim()) return;
    setGuardandoParte(true);
    try {
      const partesActuales = orden.partesReemplazadas ?? [];
      const nuevaParte = {
        parte: agregarParteNombre.trim(),
        cantidad: parseInt(agregarParteCantidad) || 1,
        costo: parseFloat(agregarParteCosto) || 0,
      };
      const nuevasPartes = [...partesActuales, nuevaParte];
      const res = await fetch(`/api/reparaciones/${orden.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diagnostico: { partesReemplazadas: nuevasPartes } }),
      });
      const data = await res.json();
      if (data.success) {
        setMostrarFormAgregarParte(false);
        setAgregarParteNombre("");
        setAgregarParteCosto("");
        setAgregarParteCantidad("1");
        setAgregarParteBusqueda([]);
        fetchOrden();
      }
    } catch { /* silencioso */ } finally {
      setGuardandoParte(false);
    }
  }

  async function handleReportarRetraso(pedidoId: string) {
    if (!orden || (!retrasoFecha && !retrasoMotivo.trim())) return;
    setGuardandoRetraso(true);
    try {
      const res = await fetch(`/api/reparaciones/${orden.id}/pedidos-pieza/${pedidoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fechaEstimadaLlegada: retrasoFecha || undefined,
          motivoRetraso: retrasoMotivo.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setRetrasoFormPedidoId(null);
        setRetrasoFecha("");
        setRetrasoMotivo("");
        fetchPedidosPieza();
      } else {
        alert(data.error || "Error al reportar retraso");
      }
    } finally {
      setGuardandoRetraso(false);
    }
  }

  async function guardarFechaEstimada() {
    if (!orden) return;
    setSavingFecha(true);
    try {
      const res = await fetch(`/api/reparaciones/${orden.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fechaEstimadaEntrega: nuevaFecha || null }),
      });
      const data = await res.json();
      if (data.success) {
        setEditingFecha(false);
        fetchOrden();
      }
    } finally {
      setSavingFecha(false);
    }
  }

  async function toggleRequiereAprobacion() {
    if (!orden) return;
    setSavingAprobacion(true);
    try {
      const res = await fetch(`/api/reparaciones/${orden.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requiereAprobacion: !orden.requiereAprobacion }),
      });
      const data = await res.json();
      if (data.success) fetchOrden();
    } finally {
      setSavingAprobacion(false);
    }
  }

  const formatFecha = (fecha: Date | string | null | undefined) => {
    if (!fecha) return "No especificada";
    const date = typeof fecha === "string" ? new Date(fecha) : fecha;
    return date.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const overdueAlert = orden && isOverdue(orden);

  // ─── Panel styles: mobile = bottom sheet, desktop = right drawer ───────────
  const panelStyle: React.CSSProperties = isMobile
    ? {
        // Mobile: bottom sheet, slides up from bottom
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: "calc(100dvh - 48px)",
        zIndex: 401,
        background: "var(--color-bg-base)",
        boxShadow: "var(--shadow-xl)",
        borderTop: "1px solid var(--color-border)",
        borderRadius: "1.25rem 1.25rem 0 0",
        display: "flex",
        flexDirection: "column",
        transform: isOpen ? "translateY(0)" : "translateY(100%)",
        transition: "transform 300ms cubic-bezier(0.4,0,0.2,1)",
      }
    : {
        // Desktop: right drawer, slides in from right
        position: "fixed",
        top: 0,
        right: 0,
        width: "min(700px, 95vw)",
        height: "100dvh",
        zIndex: 401,
        background: "var(--color-bg-base)",
        boxShadow: "var(--shadow-xl)",
        borderLeft: "1px solid var(--color-border)",
        display: "flex",
        flexDirection: "column",
        transform: isOpen ? "translateX(0)" : "translateX(100%)",
        transition: "transform 300ms cubic-bezier(0.4,0,0.2,1)",
      };

  // ── Tab: Resumen ─────────────────────────────────────────────────────────
  function tabResumen() {
    if (!orden) return null;

    // E6: botones de acción rápida
    const accionesRapidas = [
      {
        label: "Descargar PDF",
        icon: Download,
        color: "var(--color-accent)",
        bg: "var(--color-accent-light)",
        onClick: async () => {
          try {
            const res = await fetch(`/api/reparaciones/${orden.id}/pdf`, { method: "POST" });
            if (!res.ok) return;
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `orden-${orden.folio ?? orden.id}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
          } catch { /* silencioso */ }
        },
      },
      {
        label: "Ticket",
        icon: Printer,
        color: "var(--color-text-secondary)",
        bg: "var(--color-bg-elevated)",
        onClick: () => window.open(`/dashboard/reparaciones/${orden.id}/ticket`, "_blank"),
      },
      {
        label: "Compartir",
        icon: Link2,
        color: compartirOpen ? "var(--color-accent)" : "var(--color-info-text)",
        bg: compartirOpen ? "var(--color-accent-light)" : "var(--color-info-bg)",
        onClick: async () => {
          if (compartirOpen) { setCompartirOpen(false); return; }
          if (compartirUrl) { setCompartirOpen(true); return; }
          setCargandoCompartir(true);
          try {
            const res = await fetch(`/api/reparaciones/${orden.id}/tracking-link`);
            const data = await res.json();
            const url = (data.success && data.url) ? data.url : `${window.location.origin}/reparacion/${orden.folio}`;
            setCompartirUrl(url);
          } catch {
            setCompartirUrl(`${window.location.origin}/reparacion/${orden.folio}`);
          } finally {
            setCargandoCompartir(false);
          }
          setCompartirOpen(true);
        },
      },
      ...(orden.clienteTelefono ? [{
        label: "WhatsApp",
        icon: MessageCircle,
        color: "var(--color-success-text)",
        bg: "var(--color-success-bg)",
        onClick: () => {
          const link = generarLinkWhatsApp(orden.clienteTelefono!, generarMensajeSeguimiento(orden));
          window.open(link, "_blank");
        },
      }] : []),
    ];

    return (
      <div className="space-y-4 pb-6">
        {/* E6: Acciones rápidas */}
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${accionesRapidas.length}, 1fr)` }}>
          {accionesRapidas.map((accion) => {
            const Icon = accion.icon;
            return (
              <button
                key={accion.label}
                onClick={accion.onClick}
                className="flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl text-center"
                style={{ background: accion.bg, border: "1px solid transparent" }}
              >
                <Icon className="w-4 h-4" style={{ color: accion.color }} />
                <span className="text-xs font-medium leading-tight" style={{ color: accion.color }}>
                  {accion.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Panel Compartir tracking */}
        {compartirOpen && compartirUrl && (
          <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}>
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4" style={{ color: "var(--color-accent)" }} />
              <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                Compartir seguimiento
              </span>
              <span className="text-xs ml-1 font-mono" style={{ color: "var(--color-text-muted)" }}>
                #{orden.folio}
              </span>
            </div>
            <div className="rounded-lg px-3 py-2 text-xs break-all" style={{ background: "var(--color-bg-base)", fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)", border: "1px solid var(--color-border)" }}>
              {compartirUrl}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(compartirUrl).catch(() => {});
                  setCompartirCopiado(true);
                  setTimeout(() => setCompartirCopiado(false), 2000);
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium"
                style={{ background: compartirCopiado ? "var(--color-success-bg)" : "var(--color-bg-base)", color: compartirCopiado ? "var(--color-success-text)" : "var(--color-text-primary)", border: "1px solid var(--color-border)" }}
              >
                {compartirCopiado ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {compartirCopiado ? "¡Copiado!" : "Copiar link"}
              </button>
              <button
                onClick={() => window.open(compartirUrl, "_blank")}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium"
                style={{ background: "var(--color-bg-base)", color: "var(--color-text-secondary)", border: "1px solid var(--color-border)" }}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Abrir
              </button>
              {orden.clienteTelefono && (
                <button
                  onClick={() => {
                    const clean = orden.clienteTelefono!.replace(/\D/g, "");
                    const msg = encodeURIComponent(`Hola, aquí puedes rastrear tu reparación ${orden.folio}: ${compartirUrl}`);
                    window.open(`https://wa.me/52${clean}?text=${msg}`, "_blank");
                  }}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium"
                  style={{ background: "var(--color-success-bg)", color: "var(--color-success-text)", border: "1px solid transparent" }}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  WhatsApp
                </button>
              )}
            </div>
          </div>
        )}
        {compartirOpen && !compartirUrl && cargandoCompartir && (
          <div className="flex items-center justify-center py-3 gap-2 rounded-xl" style={{ background: "var(--color-bg-elevated)" }}>
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--color-text-muted)" }} />
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>Generando link…</span>
          </div>
        )}

        <Card title="Dispositivo">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Marca / Modelo</p>
              <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                {orden.marcaDispositivo} {orden.modeloDispositivo}
              </p>
            </div>
            {orden.imei && (
              <div>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>IMEI</p>
                <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-mono)" }}>
                  {orden.imei}
                </p>
              </div>
            )}
            {orden.numeroSerie && (
              <div>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>N° Serie</p>
                <p className="text-sm" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-mono)" }}>{orden.numeroSerie}</p>
              </div>
            )}
            {orden.condicionDispositivo && (
              <div>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Condición</p>
                <p className="text-sm" style={{ color: "var(--color-text-primary)" }}>{orden.condicionDispositivo}</p>
              </div>
            )}
            {orden.accesoriosEntregados && (
              <div className="col-span-2">
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Accesorios</p>
                <p className="text-sm" style={{ color: "var(--color-text-primary)" }}>{orden.accesoriosEntregados}</p>
              </div>
            )}
          </div>
        </Card>

        {/* M4: Contexto del cliente */}
        {(orden.clienteNombre || orden.clienteTelefono) && (
          <Card title="Cliente">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>
                  {orden.clienteNombre}{orden.clienteApellido ? ` ${orden.clienteApellido}` : ""}
                </p>
                {orden.clienteTelefono && (() => {
                  const cleanPhone = orden.clienteTelefono.replace(/\D/g, "");
                  return (
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      <span className="text-xs" style={{ color: "var(--color-text-secondary)", fontFamily: "var(--font-mono)" }}>
                        {orden.clienteTelefono}
                      </span>
                      <div className="flex items-center gap-1 ml-1">
                        <a
                          href={`https://wa.me/52${cleanPhone}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center w-6 h-6 rounded-md"
                          style={{ background: "var(--color-success-bg)", color: "var(--color-success-text)" }}
                          title="WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </a>
                        <a
                          href={`tel:${orden.clienteTelefono}`}
                          className="flex items-center justify-center w-6 h-6 rounded-md"
                          style={{ background: "var(--color-info-bg)", color: "var(--color-info-text)" }}
                          title="Llamar"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(orden.clienteTelefono!).catch(() => {});
                            setTelefonoCopiado(true);
                            setTimeout(() => setTelefonoCopiado(false), 2000);
                          }}
                          className="flex items-center justify-center w-6 h-6 rounded-md"
                          style={{ background: telefonoCopiado ? "var(--color-success-bg)" : "var(--color-bg-elevated)", color: telefonoCopiado ? "var(--color-success-text)" : "var(--color-text-muted)" }}
                          title={telefonoCopiado ? "¡Copiado!" : "Copiar número"}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
              {clienteResumen && (
                <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                  {clienteResumen.totalOrdenes > 0 && (
                    <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: "var(--color-info-bg)", color: "var(--color-info-text)" }}>
                      {clienteResumen.totalOrdenes === 1 ? "1ª visita" : `${clienteResumen.totalOrdenes}ª reparación`}
                    </span>
                  )}
                  {clienteResumen.puntos > 0 && (
                    <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: "var(--color-success-bg)", color: "var(--color-success-text)" }}>
                      ⭐ {clienteResumen.puntos} pts
                    </span>
                  )}
                  {clienteResumen.saldoPendiente > 0 && (
                    <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: "var(--color-warning-bg)", color: "var(--color-warning-text)" }}>
                      Saldo ${clienteResumen.saldoPendiente.toLocaleString("es-MX", { minimumFractionDigits: 0 })}
                    </span>
                  )}
                  {/* C4: otras órdenes activas */}
                  {(clienteResumen.ordenesActivas ?? 0) > 1 && (
                    <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: "var(--color-warning-bg)", color: "var(--color-warning-text)" }}>
                      {clienteResumen.ordenesActivas - 1} más activa{clienteResumen.ordenesActivas - 1 !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              )}
            </div>
            {/* C4: link a perfil del cliente */}
            {orden.clienteId && (
              <div className="mt-2 flex items-center justify-between">
                <a
                  href={`/dashboard/clientes/${orden.clienteId}`}
                  className="text-xs flex items-center gap-1 hover:underline"
                  style={{ color: "var(--color-accent)" }}
                  target="_blank" rel="noreferrer"
                >
                  <ExternalLink className="w-3 h-3" />
                  Ver perfil completo
                </a>
              </div>
            )}
            {/* C4: historial de reparaciones previas */}
            {clienteResumen?.historialReciente && clienteResumen.historialReciente.length > 0 && (
              <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
                <p className="text-xs font-semibold mb-2" style={{ color: "var(--color-text-muted)" }}>Reparaciones recientes</p>
                <div className="space-y-1.5">
                  {clienteResumen.historialReciente
                    .filter((h) => h.id !== orden.id) // excluir la orden actual
                    .slice(0, 3)
                    .map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-xs"
                      style={{ background: "var(--color-bg-sunken)" }}
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-mono font-semibold" style={{ color: "var(--color-text-primary)" }}>{h.folio}</span>
                        {(h.marca || h.modelo) && (
                          <span className="ml-1 truncate" style={{ color: "var(--color-text-muted)" }}>
                            {[h.marca, h.modelo].filter(Boolean).join(" ")}
                          </span>
                        )}
                      </div>
                      <span className="shrink-0 font-mono" style={{ color: "var(--color-text-muted)" }}>
                        {h.total > 0 ? `$${h.total.toFixed(0)}` : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Acceso al dispositivo */}
        {(orden.patronDesbloqueo || orden.passwordDispositivo) && (
          <div className="rounded-xl p-4" style={{ background: "var(--color-warning-bg)", border: "2px solid var(--color-warning)" }}>
            <p className="text-sm font-semibold mb-2" style={{ color: "var(--color-warning-text)" }}>🔐 Acceso al Dispositivo</p>
            <div className="grid grid-cols-1 gap-2">
              {orden.patronDesbloqueo && (
                <div>
                  <p className="text-xs" style={{ color: "var(--color-warning)" }}>Patrón</p>
                  <p className="text-sm font-bold px-3 py-1.5 rounded mt-0.5" style={{ fontFamily: "var(--font-mono)", color: "var(--color-warning-text)", background: "rgba(0,0,0,0.08)" }}>
                    {orden.patronDesbloqueo}
                  </p>
                </div>
              )}
              {orden.passwordDispositivo && (
                <div>
                  <p className="text-xs" style={{ color: "var(--color-warning)" }}>PIN / Contraseña</p>
                  <p className="text-sm font-bold px-3 py-1.5 rounded mt-0.5" style={{ fontFamily: "var(--font-mono)", color: "var(--color-warning-text)", background: "rgba(0,0,0,0.08)" }}>
                    {orden.passwordDispositivo}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {orden.aprobacionParcial && (
          <div className="rounded-xl p-4" style={{ background: "var(--color-warning-bg)", border: "2px solid var(--color-warning)" }}>
            <p className="text-sm font-bold" style={{ color: "var(--color-warning-text)" }}>⚠️ Aprobación Parcial</p>
            {orden.notasCliente && (
              <p className="text-xs mt-1" style={{ color: "var(--color-warning-text)" }}>{orden.notasCliente}</p>
            )}
          </div>
        )}

        {/* C5: Problema Reportado — editable para admin/técnico */}
        <Card title="Problema Reportado">
          {editProblema ? (
            <div className="space-y-2">
              <textarea
                value={problemaEditado}
                onChange={(e) => setProblemaEditado(e.target.value)}
                rows={4}
                className="w-full text-sm px-3 py-2 rounded-lg resize-none"
                style={{ background: "var(--color-bg-sunken)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}
              />
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    setGuardandoProblema(true);
                    try {
                      const res = await fetch(`/api/reparaciones/${ordenId}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ problemaReportado: problemaEditado }),
                      });
                      const data = await res.json();
                      if (data.success) {
                        setOrden((prev) => prev ? { ...prev, problemaReportado: problemaEditado } : prev);
                        setEditProblema(false);
                      }
                    } finally { setGuardandoProblema(false); }
                  }}
                  disabled={guardandoProblema}
                  className="flex-1 text-xs py-1.5 rounded-lg font-semibold"
                  style={{ background: "var(--color-accent)", color: "#fff" }}
                >
                  {guardandoProblema ? "Guardando..." : "Guardar"}
                </button>
                <button
                  onClick={() => setEditProblema(false)}
                  className="text-xs px-3 py-1.5 rounded-lg"
                  style={{ background: "none", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <p className="text-sm whitespace-pre-wrap flex-1" style={{ color: "var(--color-text-primary)" }}>
                {orden.problemaReportado}
              </p>
              {(isAdmin || user?.role === "tecnico") && (
                <button
                  onClick={() => { setProblemaEditado(orden.problemaReportado ?? ""); setEditProblema(true); }}
                  className="p-1 rounded-lg shrink-0"
                  style={{ color: "var(--color-text-muted)", background: "transparent" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg-elevated)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  title="Editar"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </Card>

        <Card title="Fechas">
          <div className="space-y-2">
            {[
              { label: "Recepción", value: orden.fechaRecepcion, color: "var(--color-text-primary)" },
              { label: "Entrega Estimada", value: orden.fechaEstimadaEntrega, color: overdueAlert ? "var(--color-danger)" : "var(--color-accent)" },
              { label: "Completado", value: orden.fechaCompletado, color: "var(--color-success)" },
              { label: "Entregado", value: orden.fechaEntregado, color: "var(--color-text-muted)" },
            ]
              .filter(({ value }) => value)
              .map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>{label}</span>
                  <span className="text-sm font-medium" style={{ color }}>{formatFecha(value)}</span>
                </div>
              ))}
          </div>
        </Card>

        {/* Toggle requiereAprobacion — solo relevante antes de aprobar */}
        {["recibido", "diagnostico", "presupuesto"].includes(orden.estado) && (
          <div className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)" }}>
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>Requiere aprobación del cliente</p>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Si está activo, la reparación no avanza sin que el cliente apruebe</p>
            </div>
            <button
              onClick={toggleRequiereAprobacion}
              disabled={savingAprobacion}
              className="w-11 h-6 rounded-full transition-colors flex-shrink-0 ml-3"
              style={{
                background: orden.requiereAprobacion ? "var(--color-accent)" : "var(--color-border-strong)",
                position: "relative",
              }}
            >
              <span
                className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform"
                style={{ transform: orden.requiereAprobacion ? "translateX(20px)" : "translateX(2px)" }}
              />
            </button>
          </div>
        )}

        {orden.cuentasDispositivo && Array.isArray(orden.cuentasDispositivo) && orden.cuentasDispositivo.length > 0 && (
          <Card title="Cuentas del Dispositivo">
            <div className="space-y-2">
              {orden.cuentasDispositivo.map((cuenta: { tipo?: string; email?: string; usuario?: string; notas?: string }, i: number) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: "var(--color-bg-sunken)" }}>
                  <span className="text-base">
                    {cuenta.tipo === "Google" ? "📧" : cuenta.tipo === "Apple" ? "🍎" : cuenta.tipo === "Samsung" ? "📱" : "🔐"}
                  </span>
                  <div>
                    <p className="text-xs font-medium" style={{ color: "var(--color-text-primary)" }}>{cuenta.tipo}</p>
                    <p className="text-xs" style={{ color: "var(--color-text-secondary)", fontFamily: "var(--font-mono)" }}>
                      {cuenta.email || cuenta.usuario}
                    </p>
                    {cuenta.notas && <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>{cuenta.notas}</p>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* C6: Notas Internas — editable para admin/técnico, siempre visible para ellos */}
        {(orden.notasInternas || isAdmin || user?.role === "tecnico") && (
          <Card title="Notas Internas">
            {editNotas ? (
              <div className="space-y-2">
                <textarea
                  value={notasEditadas}
                  onChange={(e) => setNotasEditadas(e.target.value)}
                  rows={4}
                  placeholder="Notas internas..."
                  className="w-full text-sm px-3 py-2 rounded-lg resize-none"
                  style={{ background: "var(--color-bg-sunken)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      setGuardandoNotas(true);
                      try {
                        const res = await fetch(`/api/reparaciones/${ordenId}`, {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ notasInternas: notasEditadas }),
                        });
                        const data = await res.json();
                        if (data.success) {
                          setOrden((prev) => prev ? { ...prev, notasInternas: notasEditadas } : prev);
                          setEditNotas(false);
                        }
                      } finally { setGuardandoNotas(false); }
                    }}
                    disabled={guardandoNotas}
                    className="flex-1 text-xs py-1.5 rounded-lg font-semibold"
                    style={{ background: "var(--color-accent)", color: "#fff" }}
                  >
                    {guardandoNotas ? "Guardando..." : "Guardar"}
                  </button>
                  <button
                    onClick={() => setEditNotas(false)}
                    className="text-xs px-3 py-1.5 rounded-lg"
                    style={{ background: "none", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                {orden.notasInternas ? (
                  <p className="text-sm whitespace-pre-wrap flex-1" style={{ color: "var(--color-text-primary)" }}>{orden.notasInternas}</p>
                ) : (
                  <p className="text-sm flex-1" style={{ color: "var(--color-text-muted)" }}>Sin notas internas.</p>
                )}
                {(isAdmin || user?.role === "tecnico") && (
                  <button
                    onClick={() => { setNotasEditadas(orden.notasInternas ?? ""); setEditNotas(true); }}
                    className="p-1 rounded-lg shrink-0"
                    style={{ color: "var(--color-text-muted)", background: "transparent" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg-elevated)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    title="Editar notas"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </Card>
        )}

        {/* D5: Garantía — visible cuando la orden está entregada */}
        {orden.estado === "entregado" && !cargandoGarantia && (
          <div
            className="rounded-lg px-4 py-3 space-y-2"
            style={{
              background: garantiaActiva ? "var(--color-success-bg)" : "var(--color-bg-elevated)",
              border: `1px solid ${garantiaActiva ? "var(--color-success)" : "var(--color-border-subtle)"}`,
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: garantiaActiva ? "var(--color-success-text)" : "var(--color-text-muted)" }}>
                  {garantiaActiva ? "🛡 Garantía activa" : "Garantía"}
                </p>
                {garantiaVencimiento && (
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    Vence: {new Date(garantiaVencimiento).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                )}
                {!garantiaActiva && !garantiaVencimiento && (
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Sin garantía registrada o vencida</p>
                )}
              </div>
              {garantiaActiva && !mostrarFormReclamo && (
                <button
                  onClick={() => setMostrarFormReclamo(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: "var(--color-success)", color: "#fff" }}
                >
                  Reclamar garantía
                </button>
              )}
            </div>
            {mostrarFormReclamo && (
              <div className="space-y-2 pt-2" style={{ borderTop: "1px solid var(--color-success)" }}>
                <p className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>Motivo del reclamo:</p>
                <textarea
                  value={motivoReclamo}
                  onChange={(e) => setMotivoReclamo(e.target.value)}
                  placeholder="Describe qué falló o cuál es el problema..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg text-sm resize-none focus:outline-none"
                  style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleReclamarGarantia}
                    disabled={reclamando || !motivoReclamo.trim()}
                    className="flex-1 py-1.5 rounded-lg text-xs font-bold"
                    style={{
                      background: motivoReclamo.trim() && !reclamando ? "var(--color-success)" : "var(--color-bg-elevated)",
                      color: motivoReclamo.trim() && !reclamando ? "#fff" : "var(--color-text-muted)",
                    }}
                  >
                    {reclamando ? "Creando..." : "✓ Crear orden de garantía"}
                  </button>
                  <button
                    onClick={() => { setMostrarFormReclamo(false); setMotivoReclamo(""); }}
                    className="px-3 py-1.5 rounded-lg text-xs"
                    style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-muted)" }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* M9: Reingresar como garantía — visible para CUALQUIER orden entregada */}
        {orden.estado === "entregado" && (
          <div
            className="rounded-lg px-4 py-3 space-y-2"
            style={{
              background: mostrarFormReingreso ? "var(--color-warning-bg)" : "var(--color-bg-elevated)",
              border: `1px solid ${mostrarFormReingreso ? "var(--color-warning)" : "var(--color-border-subtle)"}`,
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>
                  Reingreso de equipo
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                  ¿El cliente regresó con el equipo? Crea una nueva orden de garantía
                </p>
              </div>
              {!mostrarFormReingreso && (
                <button
                  onClick={() => setMostrarFormReingreso(true)}
                  className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: "var(--color-warning-bg)", color: "var(--color-warning-text)", border: "1px solid var(--color-warning)" }}
                >
                  Reingresar como garantía
                </button>
              )}
            </div>
            {mostrarFormReingreso && (
              <div className="space-y-2 pt-2" style={{ borderTop: "1px solid var(--color-warning)" }}>
                <p className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
                  Describe el problema por el que regresa:
                </p>
                <textarea
                  value={motivoReingreso}
                  onChange={(e) => setMotivoReingreso(e.target.value)}
                  placeholder="Ej: La pantalla volvió a fallar, el cliente dice que nunca mejoró..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg text-sm resize-none focus:outline-none"
                  style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleReingresarComoGarantia}
                    disabled={reingresando || !motivoReingreso.trim()}
                    className="flex-1 py-1.5 rounded-lg text-xs font-bold"
                    style={{
                      background: motivoReingreso.trim() && !reingresando ? "var(--color-warning-text)" : "var(--color-bg-elevated)",
                      color: motivoReingreso.trim() && !reingresando ? "#fff" : "var(--color-text-muted)",
                    }}
                  >
                    {reingresando ? "Creando orden..." : "✓ Crear orden de garantía"}
                  </button>
                  <button
                    onClick={() => { setMostrarFormReingreso(false); setMotivoReingreso(""); }}
                    className="px-3 py-1.5 rounded-lg text-xs"
                    style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-muted)" }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* M1: Historial de comunicaciones WA */}
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--color-border-subtle)" }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ background: "var(--color-bg-surface)" }}>
            <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
              Comunicaciones enviadas
            </p>
            <button
              onClick={fetchComunicaciones}
              disabled={cargandoComunicaciones}
              className="text-xs px-2 py-1 rounded"
              style={{ color: "var(--color-text-muted)", background: "var(--color-bg-elevated)" }}
            >
              {cargandoComunicaciones ? "..." : "↻"}
            </button>
          </div>
          {cargandoComunicaciones ? (
            <div className="px-4 py-6 text-center">
              <Loader2 className="w-4 h-4 mx-auto animate-spin" style={{ color: "var(--color-text-muted)" }} />
            </div>
          ) : comunicaciones.length === 0 ? (
            <div className="px-4 py-5 text-center">
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Sin comunicaciones registradas</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--color-border-subtle)" }}>
              {comunicaciones.map((com) => (
                <div key={com.id} className="px-4 py-3 flex items-start gap-3">
                  <span className="text-base mt-0.5 flex-shrink-0">
                    {com.estado === "enviado" || com.estado === "entregado" ? "📱" : com.estado === "fallido" ? "⚠️" : "🔗"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: "var(--color-text-primary)" }}>{com.resumen}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                        {new Date(com.creadoEn).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })},{" "}
                        {new Date(com.creadoEn).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span
                        className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                        style={{
                          background: com.estado === "enviado" || com.estado === "entregado"
                            ? "var(--color-success-bg)"
                            : com.estado === "fallido"
                            ? "var(--color-danger-bg)"
                            : "var(--color-info-bg)",
                          color: com.estado === "enviado" || com.estado === "entregado"
                            ? "var(--color-success-text)"
                            : com.estado === "fallido"
                            ? "var(--color-danger)"
                            : "var(--color-info-text)",
                        }}
                      >
                        {com.estado}
                      </span>
                      {com.canal && com.canal !== "whatsapp" && (
                        <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>{com.canal}</span>
                      )}
                    </div>
                    {com.error && (
                      <p className="text-xs mt-1" style={{ color: "var(--color-danger)" }}>✗ {com.error}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium"
          style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-secondary)", border: "1px solid var(--color-border)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg-sunken)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--color-bg-elevated)")}
          onClick={() => setModalEditarOpen(true)}
        >
          <Edit className="w-4 h-4" /> Editar datos
        </button>
      </div>
    );
  }

  // ── Tab: Diagnóstico ─────────────────────────────────────────────────────
  function tabDiagnostico() {
    if (!orden) return null;
    return (
      <div className="space-y-4 pb-6">
        {/* P8b: Estado al ingreso — cómo llegó el equipo */}
        <Card title="Estado al ingreso">
          <div className="space-y-2">
            <div>
              <p className="text-xs font-semibold mb-0.5" style={{ color: "var(--color-text-muted)" }}>Problema reportado por el cliente</p>
              <p className="text-sm" style={{ color: "var(--color-text-primary)" }}>{orden.problemaReportado || "—"}</p>
            </div>
            {(() => {
              if (!orden.condicionesFuncionamiento || typeof orden.condicionesFuncionamiento !== "object") return null;
              const cfMap: Record<string, string> = {
                pantallaTactil: "Pantalla / Táctil", camaras: "Cámaras", microfono: "Micrófono",
                altavoz: "Altavoz", bateria: "Batería", bluetooth: "Bluetooth", wifi: "Wi-Fi",
                botonEncendido: "Botón de encendido", botonesVolumen: "Botones de volumen",
                llegaApagado: "Llega apagado", estaMojado: "Daño por líquido",
                bateriaHinchada: "Batería hinchada", marco: "Marco del dispositivo",
                pantallaFisica: "Pantalla (física)", camaraLente: "Lente de cámara",
              };
              const esProblema = (v: unknown) =>
                typeof v === "boolean" ? v : (typeof v === "string" && v !== "" && v !== "ok" && v !== "perfecto");
              const etiqueta = (k: string, v: unknown) => {
                const lbl = cfMap[k] ?? k.replace(/_/g, " ");
                return typeof v === "string" && v !== "falla" ? `${lbl}: ${v}` : lbl;
              };
              const problemas = Object.entries(orden.condicionesFuncionamiento as Record<string, unknown>).filter(([, v]) => esProblema(v));
              if (problemas.length === 0) return null;
              return (
                <div>
                  <p className="text-xs font-semibold mb-1" style={{ color: "var(--color-text-muted)" }}>Fallas reportadas al ingreso</p>
                  <div className="flex flex-wrap gap-1.5">
                    {problemas.map(([k, v]) => (
                      <span key={k} className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)", border: "1px solid var(--color-danger)" }}>
                        ✗ {etiqueta(k, v)}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}
            {(orden.piezasCotizacion?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs font-semibold mb-1" style={{ color: "var(--color-text-muted)" }}>Piezas cotizadas al crear la orden</p>
                <div className="space-y-1">
                  {orden.piezasCotizacion!.map((pieza) => (
                    <div key={pieza.id} className="flex items-center justify-between text-xs" style={{ color: "var(--color-text-secondary)" }}>
                      <span>{pieza.nombre} × {pieza.cantidad}</span>
                      <span className="font-mono" style={{ color: "var(--color-text-muted)" }}>${pieza.precioTotal.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card title="Diagnóstico del Técnico">
          {orden.diagnosticoTecnico ? (
            <div className="space-y-3">
              <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--color-text-primary)" }}>
                {orden.diagnosticoTecnico}
              </p>
              {orden.notasTecnico && (
                <div className="p-3 rounded-lg" style={{ background: "var(--color-info-bg)" }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: "var(--color-info-text)" }}>Notas del Técnico</p>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--color-info)" }}>{orden.notasTecnico}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <Wrench className="w-10 h-10 mx-auto mb-2" style={{ color: "var(--color-border-strong)" }} />
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Diagnóstico pendiente</p>
            </div>
          )}
        </Card>

        <Card title="Técnico Asignado">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "var(--color-info-bg)" }}>
              <Wrench className="w-5 h-5" style={{ color: "var(--color-info)" }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                {orden.tecnicoNombre || "No asignado"}
              </p>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Técnico de reparación</p>
            </div>
            {isAdmin && !["entregado", "cancelado"].includes(orden.estado) && (
              <button
                onClick={() => { setReasignarOpen((v) => !v); if (!reasignarOpen) fetchTecnicos(); }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-secondary)", border: "1px solid var(--color-border-subtle)" }}
              >
                <UserCog className="w-3.5 h-3.5" />
                Reasignar
              </button>
            )}
          </div>
          {reasignarOpen && (
            <div className="mt-3 pt-3 flex items-center gap-2" style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
              <select
                value={nuevoTecnicoId}
                onChange={(e) => setNuevoTecnicoId(e.target.value)}
                className="flex-1 px-2.5 py-1.5 rounded-lg text-sm focus:outline-none"
                style={{ background: "var(--color-bg-sunken)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}
              >
                <option value="">Seleccionar técnico…</option>
                {tecnicos.map((t) => (
                  <option key={t.id} value={t.id}>{t.nombre}</option>
                ))}
              </select>
              <button
                onClick={handleReasignar}
                disabled={!nuevoTecnicoId || reasignando}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{
                  background: nuevoTecnicoId && !reasignando ? "var(--color-accent)" : "var(--color-bg-elevated)",
                  color: nuevoTecnicoId && !reasignando ? "#fff" : "var(--color-text-muted)",
                  cursor: nuevoTecnicoId && !reasignando ? "pointer" : "not-allowed",
                }}
              >
                {reasignando ? "…" : "Guardar"}
              </button>
              <button
                onClick={() => { setReasignarOpen(false); setNuevoTecnicoId(""); }}
                className="px-2.5 py-1.5 rounded-lg text-xs"
                style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-muted)" }}
              >
                ×
              </button>
            </div>
          )}
        </Card>

        {/* D4: Historial de diagnósticos múltiples */}
        {(cargandoDiagnosticos || historialDiagnosticos.length > 1) && (
          <Card title="📋 Historial de diagnósticos">
            {cargandoDiagnosticos ? (
              <div className="flex justify-center py-3">
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--color-accent)" }} />
              </div>
            ) : (
              <div className="space-y-3">
                {historialDiagnosticos.map((diag) => {
                  const fmt = (n: number) =>
                    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
                  const fecha = new Date(diag.createdAt).toLocaleDateString("es-MX", {
                    day: "2-digit", month: "short", year: "numeric",
                  });
                  const ESTADO_COLOR: Record<string, string> = {
                    pendiente_aprobacion: "var(--color-warning-text)",
                    aprobado: "var(--color-success)",
                    rechazado: "var(--color-danger)",
                    cancelado: "var(--color-text-muted)",
                  };
                  const ESTADO_LABEL: Record<string, string> = {
                    pendiente_aprobacion: "Pendiente",
                    aprobado: "Aprobado",
                    rechazado: "Rechazado",
                    cancelado: "Cancelado",
                  };
                  return (
                    <div
                      key={diag.id}
                      className="rounded-lg px-3 py-2 space-y-1"
                      style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border-subtle)" }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold" style={{ color: "var(--color-text-secondary)" }}>
                          Diagnóstico #{diag.numeroDiagnostico}
                          {diag.esDiagnosticoInicial && (
                            <span className="ml-1.5 text-xs" style={{ color: "var(--color-text-muted)" }}>(inicial)</span>
                          )}
                        </span>
                        <span className="text-xs font-medium" style={{ color: ESTADO_COLOR[diag.estado] ?? "var(--color-text-muted)" }}>
                          {ESTADO_LABEL[diag.estado] ?? diag.estado}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                        {fecha} {diag.tecnicoNombre ? `· ${diag.tecnicoNombre}` : ""}
                      </p>
                      {diag.descripcionProblema && (
                        <p className="text-xs whitespace-pre-wrap" style={{ color: "var(--color-text-primary)" }}>
                          {diag.descripcionProblema}
                        </p>
                      )}
                      {diag.diagnosticoTecnico && (
                        <p className="text-xs whitespace-pre-wrap" style={{ color: "var(--color-text-secondary)" }}>
                          {diag.diagnosticoTecnico}
                        </p>
                      )}
                      {(diag.costoLabor > 0 || diag.costoPartes > 0) && (
                        <div className="flex gap-3 text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>
                          {diag.costoLabor > 0 && <span>Labor: {fmt(diag.costoLabor)}</span>}
                          {diag.costoPartes > 0 && <span>Partes: {fmt(diag.costoPartes)}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}

        {/* P8a: Partes a reemplazar con inventario integrado */}
        <Card title="Partes a reemplazar">
          <div className="space-y-2">
            {(orden.partesReemplazadas?.length ?? 0) === 0 && !mostrarFormAgregarParte && (
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Sin partes registradas</p>
            )}
            {(orden.partesReemplazadas ?? []).map((parte: { parte?: string; cantidad?: number; costo?: number }, i: number) => (
              <div key={i} className="flex items-center justify-between py-2 border-b last:border-b-0" style={{ borderColor: "var(--color-border-subtle)" }}>
                <div>
                  <p className="text-sm" style={{ color: "var(--color-text-primary)" }}>{parte.parte}</p>
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Cant: {parte.cantidad || 1}</p>
                </div>
                <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>
                  ${((parte.costo || 0) * (parte.cantidad || 1)).toFixed(2)}
                </p>
              </div>
            ))}
            {/* P8a: Mini-form para agregar parte desde inventario */}
            {mostrarFormAgregarParte && (
              <div className="rounded-lg p-3 space-y-2 mt-1" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}>
                {/* Búsqueda */}
                <div className="relative">
                  <div className="flex items-center gap-1 rounded-lg px-2" style={{ border: "1px solid var(--color-border)", background: "var(--color-bg-sunken)" }}>
                    <input
                      value={agregarParteNombre}
                      onChange={(e) => buscarParteInventario(e.target.value)}
                      placeholder="Nombre de la pieza (busca en inventario...)"
                      className="flex-1 px-1 py-1.5 text-xs bg-transparent outline-none"
                      style={{ color: "var(--color-text-primary)" }}
                    />
                    {agregarParteBuscando && <Loader2 className="w-3 h-3 animate-spin shrink-0" style={{ color: "var(--color-text-muted)" }} />}
                  </div>
                  {agregarParteBusqueda.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 rounded-lg overflow-hidden" style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", boxShadow: "var(--shadow-md)" }}>
                      {agregarParteBusqueda.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          className="w-full text-left flex items-center justify-between px-3 py-2 text-xs"
                          style={{ color: "var(--color-text-primary)", background: "transparent" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg-elevated)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          onClick={() => {
                            setAgregarParteNombre(r.nombre);
                            setAgregarParteCosto(r.costo > 0 ? r.costo.toFixed(2) : "");
                            setAgregarParteBusqueda([]);
                          }}
                        >
                          <span>{r.nombre}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            {r.stock > 0 && (
                              <span className="px-1.5 py-0.5 rounded-full text-xs" style={{ background: "var(--color-success-bg)", color: "var(--color-success-text)" }}>
                                En stock: {r.stock}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <p className="text-xs mb-0.5" style={{ color: "var(--color-text-muted)" }}>Cant.</p>
                    <input type="number" min="1" value={agregarParteCantidad} onChange={(e) => setAgregarParteCantidad(e.target.value)} className="w-full text-xs px-2 py-1.5 rounded-lg" style={{ border: "1px solid var(--color-border)", background: "var(--color-bg-sunken)", color: "var(--color-text-primary)" }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs mb-0.5" style={{ color: "var(--color-text-muted)" }}>Costo unit.</p>
                    <input type="number" min="0" value={agregarParteCosto} onChange={(e) => setAgregarParteCosto(e.target.value)} placeholder="0.00" className="w-full text-xs px-2 py-1.5 rounded-lg font-mono" style={{ border: "1px solid var(--color-border)", background: "var(--color-bg-sunken)", color: "var(--color-text-primary)" }} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAgregarParte}
                    disabled={guardandoParte || !agregarParteNombre.trim()}
                    className="flex-1 py-1.5 rounded-lg text-xs font-medium"
                    style={{ background: "var(--color-accent)", color: "#fff", opacity: guardandoParte || !agregarParteNombre.trim() ? 0.6 : 1, cursor: guardandoParte || !agregarParteNombre.trim() ? "not-allowed" : "pointer" }}
                  >
                    {guardandoParte ? "Guardando..." : "Agregar parte"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMostrarFormAgregarParte(false); setAgregarParteNombre(""); setAgregarParteCosto(""); setAgregarParteBusqueda([]); }}
                    className="px-3 py-1.5 rounded-lg text-xs"
                    style={{ color: "var(--color-text-muted)", border: "1px solid var(--color-border)", background: "none", cursor: "pointer" }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
            {!mostrarFormAgregarParte && !["entregado", "cancelado", "no_reparable"].includes(orden.estado) && (
              <button
                type="button"
                onClick={() => setMostrarFormAgregarParte(true)}
                className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg mt-1"
                style={{ color: "var(--color-accent)", border: "1px dashed var(--color-accent)", background: "none", cursor: "pointer" }}
              >
                <Plus className="w-3 h-3" />
                Agregar parte desde inventario
              </button>
            )}
          </div>
        </Card>

        {/* P7: Piezas en proceso (read-only, derivado de pedidosPieza) */}
        {pedidosPieza.filter(pp => pp.estado !== "cancelada").length > 0 && (
          <Card title="Piezas pedidas al proveedor">
            <div className="space-y-1.5">
              {pedidosPieza.filter(pp => pp.estado !== "cancelada").map((pp) => {
                const estadoBadge: Record<string, { label: string; color: string; bg: string }> = {
                  pendiente:     { label: "Pendiente",  color: "var(--color-warning-text)", bg: "var(--color-warning-bg)" },
                  en_camino:     { label: "En camino",  color: "var(--color-info)",          bg: "var(--color-info-bg)" },
                  recibida:      { label: "Recibida",   color: "var(--color-success-text)",  bg: "var(--color-success-bg)" },
                  verificada_ok: { label: "Verificada", color: "var(--color-success-text)",  bg: "var(--color-success-bg)" },
                  defectuosa:    { label: "Defectuosa", color: "var(--color-danger)",         bg: "var(--color-danger-bg)" },
                  instalada:     { label: "Instalada",  color: "var(--color-success-text)",  bg: "var(--color-success-bg)" },
                };
                const badge = estadoBadge[pp.estado] ?? { label: pp.estado, color: "var(--color-text-muted)", bg: "var(--color-bg-elevated)" };
                return (
                  <div key={pp.id} className="flex items-center justify-between text-xs">
                    <span style={{ color: "var(--color-text-primary)" }}>{pp.nombrePieza}</span>
                    <span className="px-1.5 py-0.5 rounded-full font-medium" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("piezas")}
              className="flex items-center gap-1.5 text-xs mt-3"
              style={{ color: "var(--color-accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              <Package className="w-3 h-3" />
              Ver detalle de piezas →
            </button>
          </Card>
        )}

        {orden.fechaEstimadaEntrega && (
          <Card title="Entrega Estimada">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" style={{ color: overdueAlert ? "var(--color-danger)" : "var(--color-accent)" }} />
              <p className="text-sm font-medium" style={{ color: overdueAlert ? "var(--color-danger)" : "var(--color-accent)" }}>
                {formatFecha(orden.fechaEstimadaEntrega)}
                {overdueAlert && " · ⚠️ Vencida"}
              </p>
            </div>
          </Card>
        )}

        {/* M8: Badge "Cliente aprobó" — aviso al técnico para proceder */}
        {orden.aprobadoPorCliente && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "var(--color-success-bg)", border: "1px solid var(--color-success)" }}>
            <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: "var(--color-success)" }} />
            <p className="text-xs font-semibold" style={{ color: "var(--color-success-text)" }}>
              Cliente aprobó el presupuesto — puedes proceder con las piezas
            </p>
          </div>
        )}

        {/* Sugerencias de piezas de la cotización (B3 — editable para admin/técnico) */}
        {((orden.piezasCotizacion?.length ?? 0) > 0 || isAdmin || user?.role === "tecnico") && (
          <Card title="Piezas cotizadas">
            {/* Header con botón editar */}
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                {editandoCotizacion
                  ? "Edita las piezas incluidas en la cotización del cliente."
                  : "Piezas cotizadas al cliente. Agrégalas como pedido cuando las ordenes al proveedor."}
              </p>
              {(isAdmin || user?.role === "tecnico") && !["entregado", "cancelado"].includes(orden.estado) && (
                <button
                  onClick={() => {
                    if (editandoCotizacion) {
                      // Cancelar — restaurar
                      setEditandoCotizacion(false);
                      setEditPiezaCotId(null);
                      setMostrandoFormNuevaPiezaCot(false);
                    } else {
                      setPiezasCotEditadas(
                        (orden.piezasCotizacion ?? []).map((p) => ({ ...p }))
                      );
                      setEditandoCotizacion(true);
                    }
                  }}
                  className="text-xs px-2 py-1 rounded-lg flex-shrink-0"
                  style={{
                    background: editandoCotizacion ? "var(--color-bg-sunken)" : "var(--color-accent)",
                    color: editandoCotizacion ? "var(--color-text-muted)" : "#fff",
                    border: "1px solid var(--color-border-subtle)",
                  }}
                >
                  {editandoCotizacion ? "Cancelar" : "Editar"}
                </button>
              )}
            </div>

            {/* Modo lectura */}
            {!editandoCotizacion && (
              <div className="space-y-1.5">
                {(orden.piezasCotizacion ?? []).length === 0 && (
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Sin piezas cotizadas.</p>
                )}
                {(orden.piezasCotizacion ?? []).map((pieza) => {
                  const yaAgregada = pedidosPieza.some(
                    (p) => p.nombrePieza.toLowerCase() === pieza.nombre.toLowerCase()
                  );
                  return (
                    <div
                      key={pieza.id}
                      className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg"
                      style={{ background: "var(--color-bg-sunken)", border: "1px solid var(--color-border-subtle)" }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate" style={{ color: "var(--color-text-primary)" }}>{pieza.nombre}</p>
                        {/* C2: desglose interno solo admin/técnico */}
                        {(isAdmin || user?.role === "tecnico") && (pieza.costoInterno || pieza.costoEnvio) ? (
                          <div className="flex flex-wrap gap-x-2 gap-y-0">
                            {pieza.costoInterno ? <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>Costo: <span className="font-mono">${pieza.costoInterno.toFixed(2)}</span></span> : null}
                            {pieza.costoEnvio ? <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>Envío: <span className="font-mono">${pieza.costoEnvio.toFixed(2)}</span></span> : null}
                            <span className="text-xs" style={{ color: "var(--color-success)" }}>Cliente: <span className="font-mono">${pieza.precioTotal.toFixed(2)}</span></span>
                            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>cant. {pieza.cantidad}</span>
                          </div>
                        ) : (
                          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                            ${pieza.precioTotal.toFixed(2)} · cant. {pieza.cantidad}
                          </p>
                        )}
                      </div>
                      {yaAgregada ? (
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--color-success-bg)", color: "var(--color-success-text)" }}>
                          Agregada ✓
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            setNuevaPiezaNombre(pieza.nombre);
                            setNuevaPiezaPrecioCliente(pieza.precioTotal.toFixed(2));
                            if (pieza.productoId) setNuevaPiezaProductoId(pieza.productoId);
                            setMostrarFormPedido(true);
                          }}
                          className="text-xs px-2 py-1 rounded-lg font-medium flex-shrink-0"
                          style={{ background: "var(--color-accent)", color: "#fff" }}
                        >
                          + Pedir
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Modo edición */}
            {editandoCotizacion && (
              <div className="space-y-2">
                {piezasCotEditadas.map((pieza) => (
                  <div key={pieza.id}>
                    {editPiezaCotId === pieza.id ? (
                      /* Fila en edición inline */
                      <div className="flex flex-col gap-1.5 p-2 rounded-lg" style={{ background: "var(--color-bg-sunken)", border: "1px solid var(--color-accent)" }}>
                        <input
                          className="text-xs px-2 py-1 rounded"
                          style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border-subtle)", color: "var(--color-text-primary)" }}
                          placeholder="Nombre de la pieza"
                          value={editPiezaCotForm.nombre}
                          onChange={(e) => setEditPiezaCotForm((f) => ({ ...f, nombre: e.target.value }))}
                        />
                        <div className="flex gap-1.5">
                          <input
                            type="number"
                            min="1"
                            className="text-xs px-2 py-1 rounded w-16"
                            style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border-subtle)", color: "var(--color-text-primary)" }}
                            placeholder="Cant."
                            value={editPiezaCotForm.cantidad}
                            onChange={(e) => setEditPiezaCotForm((f) => ({ ...f, cantidad: e.target.value }))}
                          />
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="text-xs px-2 py-1 rounded flex-1"
                            style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border-subtle)", color: "var(--color-text-primary)" }}
                            placeholder="Precio al cliente"
                            value={editPiezaCotForm.precioTotal}
                            onChange={(e) => setEditPiezaCotForm((f) => ({ ...f, precioTotal: e.target.value }))}
                          />
                        </div>
                        <div className="flex gap-1.5 justify-end">
                          <button
                            onClick={() => setEditPiezaCotId(null)}
                            className="text-xs px-2 py-1 rounded"
                            style={{ background: "var(--color-bg-card)", color: "var(--color-text-muted)", border: "1px solid var(--color-border-subtle)" }}
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => {
                              const cant = parseInt(editPiezaCotForm.cantidad) || 1;
                              const total = parseFloat(editPiezaCotForm.precioTotal) || 0;
                              setPiezasCotEditadas((prev) =>
                                prev.map((p) =>
                                  p.id === pieza.id
                                    ? { ...p, nombre: editPiezaCotForm.nombre, cantidad: cant, precioTotal: total, precioUnitario: cant > 0 ? total / cant : total }
                                    : p
                                )
                              );
                              setEditPiezaCotId(null);
                            }}
                            className="text-xs px-2 py-1 rounded font-medium"
                            style={{ background: "var(--color-accent)", color: "#fff" }}
                          >
                            OK
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Fila normal en modo edición */
                      <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg" style={{ background: "var(--color-bg-sunken)", border: "1px solid var(--color-border-subtle)" }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate" style={{ color: "var(--color-text-primary)" }}>{pieza.nombre}</p>
                          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                            ${pieza.precioTotal.toFixed(2)} · cant. {pieza.cantidad}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditPiezaCotId(pieza.id);
                              setEditPiezaCotForm({ nombre: pieza.nombre, cantidad: String(pieza.cantidad), precioTotal: String(pieza.precioTotal) });
                            }}
                            className="p-1 rounded"
                            style={{ color: "var(--color-text-muted)" }}
                            title="Editar"
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => setPiezasCotEditadas((prev) => prev.filter((p) => p.id !== pieza.id))}
                            className="p-1 rounded"
                            style={{ color: "var(--color-error, #dc2626)" }}
                            title="Eliminar"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Formulario nueva pieza */}
                {mostrandoFormNuevaPiezaCot ? (
                  <div className="flex flex-col gap-1.5 p-2 rounded-lg" style={{ background: "var(--color-bg-sunken)", border: "1px dashed var(--color-border-subtle)" }}>
                    <input
                      className="text-xs px-2 py-1 rounded"
                      style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border-subtle)", color: "var(--color-text-primary)" }}
                      placeholder="Nombre de la pieza"
                      value={nuevaPiezaCotForm.nombre}
                      onChange={(e) => setNuevaPiezaCotForm((f) => ({ ...f, nombre: e.target.value }))}
                      autoFocus
                    />
                    <div className="flex gap-1.5">
                      <input
                        type="number"
                        min="1"
                        className="text-xs px-2 py-1 rounded w-16"
                        style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border-subtle)", color: "var(--color-text-primary)" }}
                        placeholder="Cant."
                        value={nuevaPiezaCotForm.cantidad}
                        onChange={(e) => setNuevaPiezaCotForm((f) => ({ ...f, cantidad: e.target.value }))}
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="text-xs px-2 py-1 rounded flex-1"
                        style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border-subtle)", color: "var(--color-text-primary)" }}
                        placeholder="Precio al cliente"
                        value={nuevaPiezaCotForm.precioTotal}
                        onChange={(e) => setNuevaPiezaCotForm((f) => ({ ...f, precioTotal: e.target.value }))}
                      />
                    </div>
                    <div className="flex gap-1.5 justify-end">
                      <button
                        onClick={() => { setMostrandoFormNuevaPiezaCot(false); setNuevaPiezaCotForm({ nombre: "", cantidad: "1", precioTotal: "" }); }}
                        className="text-xs px-2 py-1 rounded"
                        style={{ background: "var(--color-bg-card)", color: "var(--color-text-muted)", border: "1px solid var(--color-border-subtle)" }}
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => {
                          if (!nuevaPiezaCotForm.nombre.trim()) return;
                          const nuevaId = `${Date.now()}`;
                          const cant = parseInt(nuevaPiezaCotForm.cantidad) || 1;
                          const total = parseFloat(nuevaPiezaCotForm.precioTotal) || 0;
                          setPiezasCotEditadas((prev) => [
                            ...prev,
                            {
                              id: nuevaId,
                              nombre: nuevaPiezaCotForm.nombre.trim(),
                              cantidad: cant,
                              precioTotal: total,
                              precioUnitario: cant > 0 ? total / cant : total,
                              tieneStock: false,
                              esLibre: true,
                            },
                          ]);
                          setNuevaPiezaCotForm({ nombre: "", cantidad: "1", precioTotal: "" });
                          setMostrandoFormNuevaPiezaCot(false);
                        }}
                        className="text-xs px-2 py-1 rounded font-medium"
                        style={{ background: "var(--color-accent)", color: "#fff" }}
                      >
                        Agregar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setMostrandoFormNuevaPiezaCot(true)}
                    className="w-full text-xs py-1.5 rounded-lg"
                    style={{ border: "1px dashed var(--color-border-subtle)", color: "var(--color-text-muted)" }}
                  >
                    + Agregar pieza
                  </button>
                )}

                {/* Botón Guardar */}
                <button
                  disabled={guardandoCotizacion}
                  onClick={async () => {
                    if (!orden) return;
                    setGuardandoCotizacion(true);
                    try {
                      const res = await fetch(`/api/reparaciones/${orden.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ piezasCotizacion: piezasCotEditadas }),
                      });
                      const json = await res.json();
                      if (json.success) {
                        setOrden((prev) => prev ? { ...prev, piezasCotizacion: piezasCotEditadas } : prev);
                        setEditandoCotizacion(false);
                        setEditPiezaCotId(null);
                        setMostrandoFormNuevaPiezaCot(false);
                      }
                    } finally {
                      setGuardandoCotizacion(false);
                    }
                  }}
                  className="w-full text-xs py-1.5 rounded-lg font-medium"
                  style={{ background: "var(--color-accent)", color: "#fff", opacity: guardandoCotizacion ? 0.6 : 1 }}
                >
                  {guardandoCotizacion ? "Guardando…" : "Guardar cotización"}
                </button>
              </div>
            )}
          </Card>
        )}

        {/* Piezas pedidas externamente */}
        <Card title="Piezas pedidas">
          <div className="space-y-2">
            {pedidosPieza.length === 0 && !mostrarFormPedido && (
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Sin piezas pedidas</p>
            )}
            {pedidosPieza.map((p) => {
              const badgeConfig: Record<string, { label: string; color: string; bg: string }> = {
                pendiente:     { label: "Pendiente",    color: "#92400e", bg: "#fef3c7" },
                en_camino:     { label: "En camino",    color: "#1d4ed8", bg: "#dbeafe" },
                recibida:      { label: "Recibida",     color: "#0369a1", bg: "#e0f2fe" },
                verificada_ok: { label: "Verificada",   color: "#166534", bg: "#dcfce7" },
                instalada:     { label: "Instalada ✓",  color: "#166534", bg: "#dcfce7" },
                defectuosa:    { label: "Defectuosa",   color: "#991b1b", bg: "#fee2e2" },
                cancelada:     { label: "Cancelada",    color: "#6b7280", bg: "#f3f4f6" },
              };
              const badge = badgeConfig[p.estado] ?? { label: p.estado, color: "#6b7280", bg: "#f3f4f6" };
              const isVerifOpen = verifFormPedidoId === p.id;

              return (
                <div key={p.id} className="flex flex-col gap-2 py-2 border-b last:border-b-0" style={{ borderColor: "var(--color-border-subtle)" }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {(p.estado === "instalada" || p.estado === "verificada_ok")
                          ? <PackageCheck className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--color-success)" }} />
                          : <PackagePlus className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--color-warning, #d97706)" }} />
                        }
                        {editarNombrePiezaId === p.id ? (
                          <div className="flex items-center gap-1 flex-1">
                            <input
                              type="text"
                              value={editarNombreValor}
                              onChange={(e) => setEditarNombreValor(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleGuardarNombrePieza(p.id);
                                if (e.key === "Escape") { setEditarNombrePiezaId(null); setEditarNombreValor(""); }
                              }}
                              autoFocus
                              className="flex-1 px-2 py-0.5 rounded text-sm focus:outline-none"
                              style={{ border: "1px solid var(--color-accent)", background: "var(--color-bg-sunken)", color: "var(--color-text-primary)", minWidth: 0 }}
                            />
                            <button
                              onClick={() => handleGuardarNombrePieza(p.id)}
                              disabled={guardandoNombrePieza || !editarNombreValor.trim()}
                              className="text-xs px-2 py-0.5 rounded font-medium"
                              style={{ background: "var(--color-accent)", color: "#fff", opacity: (!editarNombreValor.trim() || guardandoNombrePieza) ? 0.6 : 1 }}
                            >
                              {guardandoNombrePieza ? "..." : "OK"}
                            </button>
                            <button
                              onClick={() => { setEditarNombrePiezaId(null); setEditarNombreValor(""); }}
                              className="text-xs"
                              style={{ color: "var(--color-text-muted)" }}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <p className="text-sm truncate" style={{ color: "var(--color-text-primary)" }}>{p.nombrePieza}</p>
                            {isAdmin && (
                              <button
                                onClick={() => { setEditarNombrePiezaId(p.id); setEditarNombreValor(p.nombrePieza); }}
                                className="opacity-40 hover:opacity-100 transition-opacity"
                                title="Editar nombre"
                              >
                                <Edit className="w-3 h-3" style={{ color: "var(--color-text-muted)" }} />
                              </button>
                            )}
                          </div>
                        )}
                        <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ color: badge.color, background: badge.bg }}>
                          {badge.label}
                        </span>
                      </div>
                      {/* C2: Desglose interno de costos — solo admin/técnico */}
                      {(isAdmin || user?.role === "tecnico") && (p.costoEstimado > 0 || p.costoEnvio > 0 || p.precioCliente !== null) ? (
                        <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0">
                          {p.costoEstimado > 0 && (
                            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                              Costo: <span className="font-mono" style={{ color: "var(--color-text-secondary)" }}>${p.costoEstimado.toFixed(2)}</span>
                            </span>
                          )}
                          {p.costoEnvio > 0 && (
                            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                              Envío: <span className="font-mono" style={{ color: "var(--color-text-secondary)" }}>${p.costoEnvio.toFixed(2)}</span>
                            </span>
                          )}
                          {p.precioCliente !== null && p.precioCliente > 0 && (
                            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                              Cliente: <span className="font-mono" style={{ color: "var(--color-success)" }}>${p.precioCliente.toFixed(2)}</span>
                              {(p.costoEstimado > 0 || p.costoEnvio > 0) && (
                                <span style={{ color: "var(--color-text-muted)" }}>
                                  {" "}(margen: ${(p.precioCliente - p.costoEstimado - p.costoEnvio).toFixed(2)})
                                </span>
                              )}
                            </span>
                          )}
                          {p.fechaEstimadaLlegada && (
                            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                              Llegada: {new Date(p.fechaEstimadaLlegada).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}
                            </span>
                          )}
                          {p.estado === "defectuosa" && p.motivoDefecto && (
                            <span className="text-xs" style={{ color: "var(--color-error, #dc2626)" }}>{p.motivoDefecto}</span>
                          )}
                          {p.intentosReemplazo > 0 && (
                            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>{p.intentosReemplazo} reemplazo(s)</span>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                          {p.costoEstimado > 0 && `$${p.costoEstimado.toFixed(2)}`}
                          {p.fechaEstimadaLlegada && ` · Llegada est. ${new Date(p.fechaEstimadaLlegada).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}`}
                          {p.estado === "defectuosa" && p.motivoDefecto && ` · ${p.motivoDefecto}`}
                          {p.intentosReemplazo > 0 && ` · ${p.intentosReemplazo} reemplazo(s)`}
                        </p>
                      )}
                    </div>
                    {/* Action buttons */}
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      {p.estado === "pendiente" && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleMarcarEnCamino(p.id)}
                            disabled={marcandoEnCamino === p.id}
                            className="text-xs px-2 py-1 rounded-lg font-medium"
                            style={{ background: "#dbeafe", color: "#1d4ed8", opacity: marcandoEnCamino === p.id ? 0.7 : 1 }}
                          >
                            {marcandoEnCamino === p.id ? "..." : "En camino"}
                          </button>
                          <button
                            onClick={() => handleRecibirPedido(p.id)}
                            disabled={recibiendoPedido === p.id}
                            className="text-xs px-2 py-1 rounded-lg font-medium"
                            style={{ background: "var(--color-success)", color: "#fff", opacity: recibiendoPedido === p.id ? 0.7 : 1 }}
                          >
                            {recibiendoPedido === p.id ? "..." : "Recibida ✓"}
                          </button>
                        </div>
                      )}
                      {p.estado === "en_camino" && (
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => handleRecibirPedido(p.id)}
                            disabled={recibiendoPedido === p.id}
                            className="text-xs px-2 py-1 rounded-lg font-medium"
                            style={{ background: "var(--color-success)", color: "#fff", opacity: recibiendoPedido === p.id ? 0.7 : 1 }}
                          >
                            {recibiendoPedido === p.id ? "..." : "Recibida ✓"}
                          </button>
                          {retrasoFormPedidoId !== p.id && (
                            <button
                              onClick={() => {
                                setRetrasoFormPedidoId(p.id);
                                setRetrasoFecha(p.fechaEstimadaLlegada
                                  ? new Date(p.fechaEstimadaLlegada).toISOString().split("T")[0]
                                  : "");
                                setRetrasoMotivo("");
                              }}
                              className="text-xs px-2 py-1 rounded-lg font-medium"
                              style={{ background: "var(--color-warning-bg)", color: "var(--color-warning-text)", border: "1px solid var(--color-warning)" }}
                            >
                              ⏳ Reportar retraso
                            </button>
                          )}
                        </div>
                      )}
                      {p.estado === "recibida" && !isVerifOpen && (
                        <button
                          onClick={() => { setVerifFormPedidoId(p.id); setMotivoDefectoInput(""); }}
                          className="text-xs px-2 py-1 rounded-lg font-medium"
                          style={{ background: "#fef3c7", color: "#92400e" }}
                        >
                          Verificar pieza
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Formulario de retraso inline */}
                  {retrasoFormPedidoId === p.id && (
                    <div className="ml-5 p-3 rounded-lg space-y-2" style={{ background: "var(--color-warning-bg)", border: "1px solid var(--color-warning)" }}>
                      <p className="text-xs font-semibold" style={{ color: "var(--color-warning-text)" }}>Reportar retraso de pieza</p>
                      <div className="space-y-1.5">
                        <input
                          type="date"
                          value={retrasoFecha}
                          onChange={(e) => setRetrasoFecha(e.target.value)}
                          min={new Date().toISOString().split("T")[0]}
                          className="w-full px-2 py-1.5 rounded-lg text-xs"
                          style={{ border: "1px solid var(--color-warning)", background: "var(--color-bg-surface)", color: "var(--color-text-primary)" }}
                          placeholder="Nueva fecha estimada"
                        />
                        <input
                          type="text"
                          value={retrasoMotivo}
                          onChange={(e) => setRetrasoMotivo(e.target.value)}
                          placeholder="Motivo del retraso (ej: agotado, flete)"
                          className="w-full px-2 py-1.5 rounded-lg text-xs"
                          style={{ border: "1px solid var(--color-warning)", background: "var(--color-bg-surface)", color: "var(--color-text-primary)" }}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReportarRetraso(p.id)}
                          disabled={guardandoRetraso || (!retrasoFecha && !retrasoMotivo.trim())}
                          className="flex-1 py-1.5 rounded-lg text-xs font-semibold"
                          style={{ background: "var(--color-warning-text)", color: "#fff", opacity: (guardandoRetraso || (!retrasoFecha && !retrasoMotivo.trim())) ? 0.6 : 1 }}
                        >
                          {guardandoRetraso ? "..." : "Guardar"}
                        </button>
                        <button
                          onClick={() => setRetrasoFormPedidoId(null)}
                          className="px-3 py-1.5 rounded-lg text-xs"
                          style={{ color: "var(--color-text-muted)", background: "var(--color-bg-elevated)" }}
                        >
                          Cancelar
                        </button>
                      </div>
                      {orden?.clienteTelefono && (
                        <p className="text-xs" style={{ color: "var(--color-warning-text)", opacity: 0.8 }}>
                          Después de guardar, ve a Mensajería para notificar al cliente del retraso.
                        </p>
                      )}
                    </div>
                  )}

                  {/* "En camino" — optional fecha estimada before confirming */}
                  {p.estado === "pendiente" && (
                    <div className="flex gap-1 items-center pl-5">
                      <input
                        type="date"
                        value={fechaLlegadaInput[p.id] ?? ""}
                        onChange={(e) => setFechaLlegadaInput(prev => ({ ...prev, [p.id]: e.target.value }))}
                        className="text-xs px-2 py-1 rounded-lg"
                        style={{ border: "1px solid var(--color-border)", background: "var(--color-bg-sunken)", color: "var(--color-text-secondary)" }}
                      />
                      <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>fecha estimada (opcional)</span>
                    </div>
                  )}

                  {/* Verificar pieza inline form */}
                  {isVerifOpen && (
                    <div className="ml-5 p-3 rounded-lg space-y-2" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}>
                      <p className="text-xs font-medium" style={{ color: "var(--color-text-primary)" }}>¿La pieza llegó en buen estado?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleVerificarPedido(p.id, true)}
                          disabled={verificandoPedido === p.id}
                          className="flex-1 py-1.5 rounded-lg text-xs font-medium"
                          style={{ background: "var(--color-success)", color: "#fff", opacity: verificandoPedido === p.id ? 0.7 : 1 }}
                        >
                          ✓ Llegó bien — instalar
                        </button>
                        <button
                          onClick={() => handleVerificarPedido(p.id, false)}
                          disabled={verificandoPedido === p.id}
                          className="flex-1 py-1.5 rounded-lg text-xs font-medium"
                          style={{ background: "#fee2e2", color: "#991b1b", opacity: verificandoPedido === p.id ? 0.7 : 1 }}
                        >
                          ✗ Llegó defectuosa
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Motivo del defecto (si aplica)"
                        value={motivoDefectoInput}
                        onChange={(e) => setMotivoDefectoInput(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg text-xs"
                        style={{ border: "1px solid var(--color-border)", background: "var(--color-bg-sunken)", color: "var(--color-text-primary)" }}
                      />
                      <button
                        onClick={() => setVerifFormPedidoId(null)}
                        className="text-xs"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        Cancelar
                      </button>
                    </div>
                  )}

                  {/* P3: Prompt para registrar en catálogo tras verificar pieza sin vínculo */}
                  {ingresarInventarioPiezaId === p.id && (
                    <div className="ml-5 p-3 rounded-lg space-y-2 mt-1" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-info)" }}>
                      <p className="text-xs font-semibold" style={{ color: "var(--color-info)" }}>
                        ¿Registrar esta pieza en el catálogo?
                      </p>
                      {/* P6: Búsqueda de producto existente */}
                      <div className="relative">
                        <div className="flex items-center gap-1 rounded-lg px-2" style={{ border: "1px solid var(--color-border)", background: "var(--color-bg-sunken)" }}>
                          <input
                            value={ingresarInventarioForm.nombre}
                            onChange={(e) => buscarInventarioP3(e.target.value)}
                            placeholder="Nombre de la pieza (busca existentes...)"
                            className="flex-1 px-1 py-1.5 text-xs bg-transparent outline-none"
                            style={{ color: "var(--color-text-primary)" }}
                          />
                          {ingresarInvBuscando && <Loader2 className="w-3 h-3 animate-spin shrink-0" style={{ color: "var(--color-text-muted)" }} />}
                        </div>
                        {ingresarInvBusqueda.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 rounded-lg overflow-hidden" style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", boxShadow: "var(--shadow-md)" }}>
                            <p className="text-xs px-2 pt-1.5 pb-1 font-semibold" style={{ color: "var(--color-text-muted)" }}>¿Es uno de estos?</p>
                            {ingresarInvBusqueda.map((r) => (
                              <button
                                key={r.id}
                                type="button"
                                className="w-full text-left flex items-center justify-between px-2 py-1.5 text-xs"
                                style={{ color: "var(--color-text-primary)", background: "transparent" }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg-elevated)")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                                onClick={() => handleIngresarInventarioVincular(p.id, r.id)}
                                disabled={ingresandoInventario}
                              >
                                <span>{r.nombre}</span>
                                <div className="flex items-center gap-2 shrink-0">
                                  {r.stock > 0 && (
                                    <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "var(--color-success-bg)", color: "var(--color-success-text)" }}>Stock: {r.stock}</span>
                                  )}
                                  <span className="font-semibold" style={{ color: "var(--color-info)" }}>Vincular</span>
                                </div>
                              </button>
                            ))}
                            <p className="text-xs px-2 pb-1.5 pt-1 border-t" style={{ color: "var(--color-text-muted)", borderColor: "var(--color-border)" }}>
                              O crea uno nuevo abajo.
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <input
                          value={ingresarInventarioForm.costo}
                          onChange={(e) => setIngresarInventarioForm(f => ({ ...f, costo: e.target.value }))}
                          placeholder="Costo ($)"
                          type="number"
                          min="0"
                          step="0.01"
                          className="flex-1 px-2 py-1.5 rounded-lg text-xs"
                          style={{ border: "1px solid var(--color-border)", background: "var(--color-bg-sunken)", color: "var(--color-text-primary)" }}
                        />
                        <input
                          value={ingresarInventarioForm.precio}
                          onChange={(e) => setIngresarInventarioForm(f => ({ ...f, precio: e.target.value }))}
                          placeholder="Precio venta ($)"
                          type="number"
                          min="0"
                          step="0.01"
                          className="flex-1 px-2 py-1.5 rounded-lg text-xs"
                          style={{ border: "1px solid var(--color-border)", background: "var(--color-bg-sunken)", color: "var(--color-text-primary)" }}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleIngresarInventario(p.id)}
                          disabled={ingresandoInventario || !ingresarInventarioForm.nombre.trim()}
                          className="flex-1 py-1.5 rounded-lg text-xs font-medium"
                          style={{ background: "var(--color-success)", color: "#fff", opacity: ingresandoInventario || !ingresarInventarioForm.nombre.trim() ? 0.6 : 1 }}
                        >
                          {ingresandoInventario ? "Guardando..." : "Guardar en catálogo"}
                        </button>
                        <button
                          onClick={() => setIngresarInventarioPiezaId(null)}
                          className="px-3 py-1.5 rounded-lg text-xs"
                          style={{ color: "var(--color-text-muted)" }}
                        >
                          Omitir
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {mostrarFormPedido ? (
              <div className="space-y-2 pt-2">
                {/* Búsqueda en inventario (M1) */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Buscar en catálogo de productos..."
                    value={busquedaPieza}
                    onChange={(e) => {
                      setBusquedaPieza(e.target.value);
                      buscarPiezaEnInventario(e.target.value);
                    }}
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                    style={{ border: "1px solid var(--color-border)", background: "var(--color-bg-sunken)", color: "var(--color-text-primary)" }}
                  />
                  {buscandoPieza && (
                    <Loader2 className="absolute right-2 top-2.5 w-4 h-4 animate-spin" style={{ color: "var(--color-text-muted)" }} />
                  )}
                  {resultadosBusquedaPieza.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 rounded-lg shadow-lg overflow-hidden" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}>
                      {resultadosBusquedaPieza.map((prod) => (
                        <button
                          key={prod.id}
                          onClick={() => {
                            setNuevaPiezaNombre(prod.nombre);
                            setNuevaPiezaCosto(prod.costo.toFixed(2));
                            setNuevaPiezaPrecioCliente(prod.precio.toFixed(2));
                            setNuevaPiezaProductoId(prod.id);
                            setBusquedaPieza("");
                            setResultadosBusquedaPieza([]);
                          }}
                          className="w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-2 border-b last:border-b-0"
                          style={{ color: "var(--color-text-primary)", borderColor: "var(--color-border-subtle)" }}
                        >
                          <span className="truncate flex-1">{prod.nombre}</span>
                          <span className="flex-shrink-0 font-mono text-xs" style={{ color: "var(--color-text-muted)" }}>
                            Stock: {prod.stock} · ${prod.precio.toFixed(0)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {nuevaPiezaProductoId && (
                  <p className="text-xs flex items-center gap-1" style={{ color: "var(--color-success-text)" }}>
                    <span>✓ Vinculado a catálogo</span>
                    <button
                      onClick={() => { setNuevaPiezaProductoId(null); setBusquedaPieza(""); }}
                      className="underline"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      desvincular
                    </button>
                  </p>
                )}
                <input
                  type="text"
                  placeholder="Nombre de la pieza (o escríbelo libremente)"
                  value={nuevaPiezaNombre}
                  onChange={(e) => { setNuevaPiezaNombre(e.target.value); if (nuevaPiezaProductoId) setNuevaPiezaProductoId(null); }}
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={{ border: "1px solid var(--color-border)", background: "var(--color-bg-sunken)", color: "var(--color-text-primary)" }}
                />
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-2 top-2 text-xs" style={{ color: "var(--color-text-muted)" }}>$</span>
                    <input
                      type="number"
                      placeholder="Costo pieza"
                      value={nuevaPiezaCosto}
                      onChange={(e) => setNuevaPiezaCosto(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      min="0"
                      step="0.01"
                      className="w-full pl-5 pr-3 py-2 rounded-lg text-sm focus:outline-none"
                      style={{ border: "1px solid var(--color-border)", background: "var(--color-bg-sunken)", color: "var(--color-text-primary)" }}
                    />
                  </div>
                  <div className="relative flex-1">
                    <span className="absolute left-2 top-2 text-xs" style={{ color: "var(--color-text-muted)" }}>$</span>
                    <input
                      type="number"
                      placeholder="Costo envío"
                      value={nuevaPiezaEnvio}
                      onChange={(e) => setNuevaPiezaEnvio(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      min="0"
                      step="0.01"
                      className="w-full pl-5 pr-3 py-2 rounded-lg text-sm focus:outline-none"
                      style={{ border: "1px solid var(--color-border)", background: "var(--color-bg-sunken)", color: "var(--color-text-primary)" }}
                    />
                  </div>
                  <div className="relative flex-1">
                    <span className="absolute left-2 top-2 text-xs" style={{ color: "var(--color-text-muted)" }}>$</span>
                    <input
                      type="number"
                      placeholder="Precio cliente"
                      value={nuevaPiezaPrecioCliente}
                      onChange={(e) => setNuevaPiezaPrecioCliente(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      min="0"
                      step="0.01"
                      className="w-full pl-5 pr-3 py-2 rounded-lg text-sm focus:outline-none"
                      style={{ border: "1px solid var(--color-border)", background: "var(--color-bg-sunken)", color: "var(--color-text-primary)" }}
                    />
                  </div>
                </div>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  Costo pieza = lo que pagas al proveedor · Precio cliente = lo que se le cobra
                </p>
                <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "var(--color-text-secondary)" }}>
                  <input
                    type="checkbox"
                    checked={recibirInmediatamente}
                    onChange={(e) => setRecibirInmediatamente(e.target.checked)}
                    className="rounded"
                  />
                  Ya la tengo — marcar como recibida ahora
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={resetFormPedido}
                    className="flex-1 py-1.5 rounded-lg text-xs"
                    style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleGuardarPedido}
                    disabled={guardandoPedido || !nuevaPiezaNombre.trim()}
                    className="flex-1 py-1.5 rounded-lg text-xs font-medium"
                    style={{ background: "var(--color-accent)", color: "#fff", opacity: (!nuevaPiezaNombre.trim() || guardandoPedido) ? 0.7 : 1 }}
                  >
                    {guardandoPedido ? "..." : "Guardar"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setMostrarFormPedido(true)}
                className="flex items-center gap-1 text-xs font-medium mt-1"
                style={{ color: "var(--color-accent)" }}
              >
                <Plus className="w-3 h-3" />
                Agregar pieza pedida
              </button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // ── Tab: Presupuesto ─────────────────────────────────────────────────────
  function tabPresupuesto() {
    if (!orden) return null;
    return (
      <div className="space-y-4 pb-6">
        {orden.estado !== "entregado" && orden.estado !== "cancelado" && (
          <AnticipoCajaPanel orden={orden} onOrdenUpdated={handleSuccess} />
        )}
        {/* M3: Indicador cotización modificada */}
        {orden.snapshotCotizacionInicial &&
          JSON.stringify(orden.snapshotCotizacionInicial) !== JSON.stringify(orden.piezasCotizacion) && (
          <div
            className="rounded-lg px-4 py-3 space-y-3"
            style={{ background: "var(--color-warning-bg)", border: "1px solid var(--color-warning)" }}
          >
            <p className="text-xs font-semibold" style={{ color: "var(--color-warning-text)" }}>
              ⚠️ Cotización modificada — el precio fue ajustado después del presupuesto inicial
            </p>
            <details>
              <summary className="text-xs cursor-pointer" style={{ color: "var(--color-warning)" }}>
                Ver cotización original
              </summary>
              <div className="mt-2 rounded-lg p-3 space-y-1" style={{ background: "rgba(0,0,0,0.06)" }}>
                {Array.isArray(orden.snapshotCotizacionInicial) && (orden.snapshotCotizacionInicial as Array<{ nombre?: string; precio?: number; cantidad?: number }>).map((item, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <span className="text-xs" style={{ color: "var(--color-warning-text)" }}>
                      {item.cantidad && item.cantidad > 1 ? `${item.cantidad}× ` : ""}{item.nombre ?? "—"}
                    </span>
                    <span className="text-xs font-medium" style={{ color: "var(--color-warning-text)", fontFamily: "var(--font-data)" }}>
                      ${(item.precio ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            </details>
            {/* M10: Re-notificar si el cliente ya aprobó y el precio cambió */}
            {isAdmin && orden.aprobadoPorCliente && ["presupuesto", "aprobado"].includes(orden.estado) && (
              <div className="pt-2" style={{ borderTop: "1px solid var(--color-warning)" }}>
                <p className="text-xs mb-2" style={{ color: "var(--color-warning-text)" }}>
                  El cliente aprobó el precio anterior. Puedes resetear la aprobación y re-enviar la cotización actualizada.
                </p>
                <button
                  onClick={handleRenotificarPresupuesto}
                  disabled={renotificando}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: "var(--color-warning-text)", color: "#fff", opacity: renotificando ? 0.7 : 1 }}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  {renotificando ? "Procesando..." : "Re-enviar cotización al cliente (WA)"}
                </button>
              </div>
            )}
          </div>
        )}

        <PresupuestoSummary orden={orden} />

        {/* D1 / FASE 80: Utilidad del servicio — visible para todos los roles (admin, vendedor, técnico) */}
        {(() => {
          const costosPiezas = pedidosPieza
            .filter((p) => p.estado !== "cancelada")
            .reduce((s, p) => s + (p.costoEstimado ?? 0) + (p.costoEnvio ?? 0), 0);
          // NUNCA usar presupuestoTotal — columna inexistente. Solo precio_total / costo_total.
          const ingresos = orden.costoTotal ?? 0;
          if (ingresos === 0 && costosPiezas === 0) return null;
          const ingresoNeto = ingresos - costosPiezas;
          const margenPct = ingresos > 0 ? Math.round((ingresoNeto / ingresos) * 100) : 0;
          const fmtMXN = (n: number) =>
            new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
          return (
            <div
              className="rounded-lg px-4 py-3 space-y-2"
              style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border-subtle)" }}
            >
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>
                Utilidad del servicio
              </p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Total cobrado</p>
                  <p className="text-sm font-semibold" style={{ color: "var(--color-success)", fontFamily: "var(--font-data)" }}>{fmtMXN(ingresos)}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Costo piezas</p>
                  <p className="text-sm font-semibold" style={{ color: "var(--color-danger)", fontFamily: "var(--font-data)" }}>{fmtMXN(costosPiezas)}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Utilidad neta</p>
                  <p className="text-sm font-bold" style={{ color: ingresoNeto >= 0 ? "var(--color-success)" : "var(--color-danger)", fontFamily: "var(--font-data)" }}>
                    {fmtMXN(ingresoNeto)}
                    <span className="text-xs ml-1" style={{ opacity: 0.7 }}>({margenPct}%)</span>
                  </p>
                </div>
              </div>
              {costosPiezas === 0 && pedidosPieza.length === 0 && (
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  Sin piezas pedidas aún — los costos se registran al agregar piezas al proveedor.
                </p>
              )}
            </div>
          );
        })()}

        {/* E7: Botón "Cliente aprobó en tienda" — solo cuando está en presupuesto y no ha aprobado */}
        {orden.estado === "presupuesto" && !(orden as any).aprobadoPorCliente && (
          <button
            disabled={aprobandoPresencial}
            onClick={async () => {
              if (!confirm("¿Confirmar que el cliente aprobó el presupuesto en tienda?")) return;
              setAprobandoPresencial(true);
              try {
                const res = await fetch(`/api/reparaciones/${orden.id}/aprobar-presupuesto`, { method: "POST" });
                const data = await res.json();
                if (data.success) {
                  handleSuccess();
                } else {
                  alert(data.message ?? "Error al aprobar presupuesto");
                }
              } catch {
                alert("Error de conexión");
              } finally {
                setAprobandoPresencial(false);
              }
            }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold"
            style={{
              background: aprobandoPresencial ? "var(--color-success-bg)" : "var(--color-success)",
              color: aprobandoPresencial ? "var(--color-success-text)" : "#fff",
              border: "none",
              opacity: aprobandoPresencial ? 0.8 : 1,
            }}
          >
            <CheckCircle className="w-4 h-4" />
            {aprobandoPresencial ? "Procesando…" : "✓ Cliente aprobó en tienda"}
          </button>
        )}

        {/* Acciones de presupuesto */}
        <div className="flex gap-2">
          {orden.clienteTelefono && (
            (() => {
              const trackingUrl = (orden as any).trackingToken
                ? `${process.env.NEXT_PUBLIC_BASE_URL || "https://crediphone.com.mx"}/tracking/${(orden as any).trackingToken}`
                : undefined;
              const msg = generarMensajePresupuesto(orden, trackingUrl);
              const link = generarLinkWhatsApp(orden.clienteTelefono, msg);
              return (
                <a
                  href={link}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold"
                  style={{ background: "#25D366", color: "#fff" }}
                >
                  <MessageSquare className="w-4 h-4" />
                  Enviar presupuesto
                </a>
              );
            })()
          )}
          {orden.estado !== "entregado" && orden.estado !== "cancelado" && (
            <button
              className={`${orden.clienteTelefono ? "flex-shrink-0" : "flex-1"} flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium`}
              style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-secondary)", border: "1px solid var(--color-border)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg-sunken)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--color-bg-elevated)")}
              onClick={() => setModalPresupuestoOpen(true)}
            >
              <Edit className="w-4 h-4" /> Editar
            </button>
          )}
        </div>

        {/* Solicitudes de cambio de precio — solo admin */}
        {solicitudesPrecio.filter((s) => s.estado === "pendiente").length > 0 && (
          <Card title="⚠️ Cambios de precio pendientes">
            <div className="space-y-3">
              {solicitudesPrecio.filter((s) => s.estado === "pendiente").map((sol) => {
                const fmt = (n: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
                return (
                  <div key={sol.id} className="rounded-lg p-3 space-y-2" style={{ background: "var(--color-warning-bg)", border: "1px solid var(--color-warning)" }}>
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 flex-shrink-0" style={{ color: "var(--color-warning-text)" }} />
                      <span className="text-xs font-semibold" style={{ color: "var(--color-warning-text)" }}>
                        {sol.solicitadoPorNombre ?? "Vendedor"} propone cambio de precio
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                      <div>
                        <span style={{ color: "var(--color-text-muted)" }}>Mano de obra actual:</span>
                        <span className="ml-1 font-mono font-semibold">{fmt(sol.costoReparacionActual)}</span>
                      </div>
                      <div>
                        <span style={{ color: "var(--color-text-muted)" }}>Propuesto:</span>
                        <span className="ml-1 font-mono font-semibold" style={{ color: "var(--color-accent)" }}>{fmt(sol.costoReparacionPropuesto)}</span>
                      </div>
                      <div>
                        <span style={{ color: "var(--color-text-muted)" }}>Partes actual:</span>
                        <span className="ml-1 font-mono font-semibold">{fmt(sol.costoPartesActual)}</span>
                      </div>
                      <div>
                        <span style={{ color: "var(--color-text-muted)" }}>Propuesto:</span>
                        <span className="ml-1 font-mono font-semibold" style={{ color: "var(--color-accent)" }}>{fmt(sol.costoPartesPropuesto)}</span>
                      </div>
                    </div>
                    {sol.motivo && (
                      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Motivo: {sol.motivo}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        disabled={aprobandoPrecio === sol.id}
                        onClick={() => handleRevisionPrecio(sol.id, "aprobar")}
                        className="flex-1 py-1.5 rounded-lg text-xs font-bold"
                        style={{ background: "var(--color-success)", color: "#fff", opacity: aprobandoPrecio === sol.id ? 0.7 : 1 }}
                      >
                        {aprobandoPrecio === sol.id ? "..." : "✓ Aprobar"}
                      </button>
                      <button
                        disabled={aprobandoPrecio === sol.id}
                        onClick={() => handleRevisionPrecio(sol.id, "rechazar")}
                        className="flex-1 py-1.5 rounded-lg text-xs font-medium"
                        style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)", border: "1px solid var(--color-danger)", opacity: aprobandoPrecio === sol.id ? 0.7 : 1 }}
                      >
                        ✕ Rechazar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* C11: Historial de cambios de precio — solo admin */}
        {isAdmin && historialPrecios.length > 0 && (
          <Card title="📈 Historial de precios">
            {cargandoHistorialPrecios ? (
              <div className="flex justify-center py-3">
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--color-accent)" }} />
              </div>
            ) : (
              <div className="space-y-2">
                {historialPrecios.map((h) => {
                  const fmt = (n: number) =>
                    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
                  const fecha = new Date(h.createdAt).toLocaleDateString("es-MX", {
                    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                  });
                  const subio = h.precioNuevo > h.precioAnterior;
                  const VIA_LABEL: Record<string, string> = {
                    admin_directo: "Admin directo",
                    solicitud_aprobada: "Solicitud aprobada",
                  };
                  return (
                    <div
                      key={h.id}
                      className="rounded-lg px-3 py-2 space-y-1"
                      style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border-subtle)" }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>{fecha}</span>
                        <span
                          className="text-xs font-bold font-mono"
                          style={{ color: subio ? "var(--color-warning-text)" : "var(--color-success)" }}
                        >
                          {fmt(h.precioAnterior)} → {fmt(h.precioNuevo)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--color-bg-sunken)", color: "var(--color-text-muted)" }}>
                          {VIA_LABEL[h.via] ?? h.via}
                        </span>
                        {h.motivo && (
                          <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>{h.motivo}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}

        {/* Historial de PDFs versionados */}
        <Card title="📄 Documentos del servicio">
          {cargandoPDF ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--color-accent)" }} />
            </div>
          ) : versionesPDF.length === 0 ? (
            <p className="text-xs py-2" style={{ color: "var(--color-text-muted)" }}>
              Sin versiones de PDF registradas. Se generarán automáticamente al aprobar el presupuesto y al entregar.
            </p>
          ) : (
            <div className="space-y-1">
              {versionesPDF.map((v) => {
                const MOTIVO_LABEL: Record<string, string> = {
                  cotizacion_inicial: "Cotización inicial",
                  aprobacion_cliente: "Aprobación del cliente",
                  reaprobacion_presencial: "Aprobación presencial",
                  cambio_presupuesto: "Cambio de presupuesto",
                  entrega: "Acuse de entrega",
                };
                const fecha = new Date(v.createdAt).toLocaleDateString("es-MX", {
                  day: "2-digit", month: "short", year: "numeric",
                });
                return (
                  <div key={v.id} className="flex items-center gap-3 py-1.5">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold" style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-muted)" }}>
                      {v.version}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium leading-tight" style={{ color: "var(--color-text-primary)" }}>
                        {MOTIVO_LABEL[v.motivo] ?? v.motivo}
                      </p>
                      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{fecha}</p>
                    </div>
                    <a
                      href={v.urlPdf}
                      target="_blank"
                      rel="noreferrer"
                      title="Descargar PDF"
                      className="p-1.5 rounded-lg flex-shrink-0"
                      style={{ color: "var(--color-accent)", background: "var(--color-accent-light)" }}
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                );
              })}
            </div>
          )}
          <button
            className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-secondary)", border: "1px solid var(--color-border)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg-sunken)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--color-bg-elevated)")}
            onClick={fetchVersionesPDF}
          >
            <History className="w-3.5 h-3.5" />
            Actualizar historial
          </button>
        </Card>

        {/* Promociones al momento de entrega */}
        {orden.estado === "listo_entrega" && clienteAceptaPromos === true && (
          <Card title="🎁 Sugerencias para el cliente">
            <p className="text-xs mb-3" style={{ color: "var(--color-text-muted)" }}>
              El cliente acepta promociones. Envíale una sugerencia por WhatsApp antes de que recoja.
            </p>
            <div className="flex flex-col gap-2">
              {(["accesorio", "combo", "celular"] as const).map((tipo) => {
                const labels: Record<string, string> = { accesorio: "🛡️ Accesorios / Funda", combo: "📦 Combo especial", celular: "📱 Nuevo equipo" };
                const msg = generarMensajePromocion(orden, tipo);
                const link = generarLinkWhatsApp(orden.clienteTelefono, msg);
                return (
                  <a
                    key={tipo}
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
                    style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-secondary)", border: "1px solid var(--color-border)", textDecoration: "none" }}
                  >
                    {labels[tipo]}
                  </a>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    );
  }

  // ── Render tabs content ──────────────────────────────────────────────────
  function renderTab() {
    if (!orden) return null;
    switch (activeTab) {
      case "resumen":     return tabResumen();
      case "diagnostico": return tabDiagnostico();
      case "presupuesto": return tabPresupuesto();
      case "historial":
        return (
          <div className="space-y-4 pb-6">
            <TimelineOrden ordenId={orden.id} estadoActual={orden.estado} />
            <HistorialNotificaciones ordenId={orden.id} />
          </div>
        );
      case "fotos":
        return <GaleriaFotosOrden orden={orden} onUpdate={handleSuccess} />;
      case "piezas":
        return <PiezasInventarioPanel ordenId={orden.id} estadoOrden={orden.estado} />;
      case "mensajeria":
        return <CentroMensajesPanel orden={orden} onUpdate={handleSuccess} />;
      case "tiempo":
        return <BitacoraTiempoPanel ordenId={orden.id} />;
      default:
        return null;
    }
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[400] transition-opacity duration-300"
        style={{
          background: "rgba(0,0,0,0.5)",
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
        }}
        onClick={onClose}
      />

      {/* Mobile handle bar */}
      {isMobile && (
        <div
          className="fixed z-[402] transition-opacity duration-300"
          style={{
            opacity: isOpen ? 1 : 0,
            pointerEvents: "none",
            bottom: "calc(100dvh - 44px)",
            left: "50%",
            transform: "translateX(-50%)",
          }}
        >
          <div
            className="rounded-full"
            style={{ width: 40, height: 4, background: "var(--color-border-strong)" }}
          />
        </div>
      )}

      {/* Drawer / Bottom sheet panel */}
      <div style={panelStyle}>

        {/* ── Compact header: folio + estado + cliente ── */}
        <div
          className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{
            background: "var(--color-bg-surface)",
            borderBottom: "1px solid var(--color-border)",
            borderRadius: isMobile ? "1.25rem 1.25rem 0 0" : undefined,
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg flex-shrink-0"
              style={{ color: "var(--color-text-muted)", background: "transparent" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg-elevated)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              title="Cerrar (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
            {orden ? (
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="text-sm font-bold"
                    style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-mono)" }}
                  >
                    {orden.folio}
                  </span>
                  <EstadoBadge estado={orden.estado} />
                  <PrioridadBadge prioridad={orden.prioridad} />
                  {precioPendiente && (
                    <button
                      className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium"
                      style={{ background: "var(--color-warning-bg)", color: "var(--color-warning-text)", border: "1px solid var(--color-warning)" }}
                      onClick={() => setActiveTab("presupuesto")}
                      title="Cambio de precio pendiente de aprobación del admin"
                    >
                      <ShieldAlert className="w-3 h-3" />
                      Precio pendiente
                    </button>
                  )}
                </div>
                <p className="text-xs truncate mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
                  {orden.marcaDispositivo} {orden.modeloDispositivo}
                  {orden.clienteNombre ? ` · ${orden.clienteNombre}${orden.clienteApellido ? ` ${orden.clienteApellido}` : ""}` : ""}
                </p>
              </div>
            ) : loading ? (
              <div className="space-y-1">
                <div className="w-32 h-4 rounded animate-pulse" style={{ background: "var(--color-bg-elevated)" }} />
                <div className="w-48 h-3 rounded animate-pulse" style={{ background: "var(--color-bg-elevated)" }} />
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            {orden && (
              <button
                className="p-1.5 rounded-lg"
                style={{ color: "var(--color-text-muted)", background: "transparent" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg-elevated)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                onClick={() => setModalEditarOpen(true)}
                title="Editar orden"
              >
                <Edit className="w-4 h-4" />
              </button>
            )}
            {orden && (
              <button
                className="p-1.5 rounded-lg"
                style={{ color: "var(--color-text-muted)", background: "transparent" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg-elevated)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                onClick={() => window.open(`/dashboard/reparaciones/${orden.id}/ticket`, "_blank")}
                title="Imprimir ticket de taller"
              >
                <Printer className="w-4 h-4" />
              </button>
            )}
            {/* Botón de tracking — visible si la orden tiene trackingToken */}
            {orden?.trackingToken && (
              <button
                className="flex items-center gap-1 p-1.5 rounded-lg"
                style={{
                  color: trackingCopiado ? "var(--color-success)" : "var(--color-info)",
                  background: trackingCopiado ? "var(--color-success-bg)" : "var(--color-info-bg)",
                  transition: "all 150ms ease",
                }}
                onMouseEnter={(e) => {
                  if (!trackingCopiado) (e.currentTarget as HTMLButtonElement).style.opacity = "0.8";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.opacity = "1";
                }}
                title={`Seguimiento del cliente${trackingCopiado ? " — ¡Link copiado!" : "\nClick: copiar link\nCtrl+click: abrir en nueva pestaña"}`}
                onClick={(e) => {
                  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/tracking/${orden.trackingToken}`;
                  if (e.ctrlKey || e.metaKey) {
                    window.open(url, "_blank");
                  } else {
                    navigator.clipboard.writeText(url).catch(() => {});
                    setTrackingCopiado(true);
                    setTimeout(() => setTrackingCopiado(false), 2000);
                  }
                }}
              >
                {trackingCopiado ? <Copy className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
              </button>
            )}
            {/* Botón rápido "✓ Listo" — solo cuando está en_reparacion */}
            {orden && orden.estado === "en_reparacion" && (
              <button
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold"
                style={{ color: "var(--color-success-text)", background: "var(--color-success-bg)", border: "1px solid var(--color-success)" }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                onClick={() => abrirCambiarEstado("completado")}
                title="Marcar reparación como completada"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span className="ml-1">Listo</span>
              </button>
            )}
            {/* Botón de estado genérico para el resto de transiciones */}
            {orden && !["entregado", "cancelado", "no_reparable"].includes(orden.estado) && (
              <button
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                style={{ color: "var(--color-primary)", background: "var(--color-primary-light)", border: "1px solid transparent" }}
                onMouseEnter={(e) => (e.currentTarget.style.border = "1px solid var(--color-primary)")}
                onMouseLeave={(e) => (e.currentTarget.style.border = "1px solid transparent")}
                onClick={() => abrirCambiarEstado()}
                title="Cambiar estado de la orden"
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span className="hidden sm:inline ml-1">Estado</span>
              </button>
            )}
            {/* C3: Revertir estado — solo admin, solo estados reversibles */}
            {isAdmin && orden && !["entregado", "cancelado", "no_reparable", "recibido"].includes(orden.estado) && (
              <button
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                style={{ color: "var(--color-danger, #dc2626)", background: "var(--color-danger-bg, #fee2e2)", border: "1px solid transparent" }}
                onMouseEnter={(e) => (e.currentTarget.style.border = "1px solid var(--color-danger, #dc2626)")}
                onMouseLeave={(e) => (e.currentTarget.style.border = "1px solid transparent")}
                onClick={() => { setMotivoRevertir(""); setRevertirModalOpen(true); }}
                title="Revertir estado al paso anterior"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline ml-1">Revertir</span>
              </button>
            )}
            {orden && (
              <button
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                style={{ color: "var(--color-accent)", background: "var(--color-accent-light)", border: "1px solid transparent" }}
                onMouseEnter={(e) => (e.currentTarget.style.border = "1px solid var(--color-accent)")}
                onMouseLeave={(e) => (e.currentTarget.style.border = "1px solid transparent")}
                onClick={() => router.push(`/dashboard/reparaciones/${orden.id}`)}
                title="Abrir página completa"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline ml-1">Ver todo</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Compact client/date strip ── */}
        {orden && (
          <div
            className="px-4 py-2 flex items-center justify-between gap-3 flex-shrink-0 flex-wrap"
            style={{
              background: "var(--color-bg-surface)",
              borderBottom: "1px solid var(--color-border-subtle)",
            }}
          >
            {/* Cliente */}
            {orden.clienteNombre ? (
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: "var(--color-primary-light)", color: "var(--color-primary)" }}
                >
                  {orden.clienteNombre[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold leading-tight truncate" style={{ color: "var(--color-text-primary)" }}>
                    {orden.clienteNombre} {orden.clienteApellido || ""}
                  </p>
                  {orden.clienteTelefono && (
                    <a
                      href={`https://wa.me/52${orden.clienteTelefono.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs"
                      style={{ color: "var(--color-accent)", fontFamily: "var(--font-mono)" }}
                    >
                      <Phone className="w-3 h-3" />
                      {orden.clienteTelefono}
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>Sin cliente</span>
            )}

            {/* Fecha estimada / vencida */}
            <div className="text-right flex-shrink-0">
              {editingFecha ? (
                <div className="flex items-center gap-1">
                  <input
                    type="date"
                    value={nuevaFecha}
                    onChange={(e) => setNuevaFecha(e.target.value)}
                    className="text-xs rounded px-1.5 py-1"
                    style={{ border: "1px solid var(--color-border)", background: "var(--color-bg-surface)", color: "var(--color-text-primary)" }}
                  />
                  <button
                    onClick={guardarFechaEstimada}
                    disabled={savingFecha}
                    className="text-xs px-2 py-1 rounded font-semibold"
                    style={{ background: "var(--color-accent)", color: "#fff" }}
                  >
                    {savingFecha ? "..." : "OK"}
                  </button>
                  <button
                    onClick={() => setEditingFecha(false)}
                    className="text-xs px-1.5 py-1 rounded"
                    style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-muted)" }}
                  >
                    ✕
                  </button>
                </div>
              ) : overdueAlert ? (
                <div
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg cursor-pointer"
                  style={{ background: "var(--color-danger-bg)", border: "1px solid var(--color-danger)" }}
                  onClick={() => { setNuevaFecha(orden.fechaEstimadaEntrega ? new Date(orden.fechaEstimadaEntrega).toISOString().split("T")[0] : ""); setEditingFecha(true); }}
                  title="Cambiar fecha estimada"
                >
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--color-danger)" }} />
                  <div>
                    <p className="text-xs font-bold leading-tight" style={{ color: "var(--color-danger-text)" }}>¡Vencida!</p>
                    <p className="text-xs leading-tight" style={{ color: "var(--color-danger)" }}>
                      {formatFecha(orden.fechaEstimadaEntrega)}
                    </p>
                  </div>
                </div>
              ) : orden.fechaEstimadaEntrega ? (
                <div
                  className="flex items-center gap-1 cursor-pointer"
                  onClick={() => { setNuevaFecha(new Date(orden.fechaEstimadaEntrega!).toISOString().split("T")[0]); setEditingFecha(true); }}
                  title="Cambiar fecha estimada"
                >
                  <div>
                    <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Entrega est.</p>
                    <p className="text-xs font-medium" style={{ color: "var(--color-accent)" }}>
                      {formatFecha(orden.fechaEstimadaEntrega)}
                    </p>
                  </div>
                  <Edit className="w-3 h-3" style={{ color: "var(--color-text-muted)" }} />
                </div>
              ) : (
                <div
                  className="flex items-center gap-1 cursor-pointer"
                  onClick={() => { setNuevaFecha(""); setEditingFecha(true); }}
                  title="Agregar fecha estimada"
                >
                  <div>
                    <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Recibido</p>
                    <p className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
                      {formatFecha(orden.fechaRecepcion)}
                    </p>
                  </div>
                  <Edit className="w-3 h-3" style={{ color: "var(--color-text-muted)" }} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Financial summary strip (C1) ── */}
        {orden && (() => {
          // precio_total = lo que cobra al cliente; fallback a costo_total
          const total = (orden.presupuestoTotal && orden.presupuestoTotal > 0)
            ? orden.presupuestoTotal
            : (orden.costoTotal ?? 0);
          const anticipos = orden.totalAnticipos ?? 0;
          const saldo = Math.max(0, total - anticipos);
          const tieneDatos = total > 0 || anticipos > 0;
          if (!tieneDatos) return null;
          const fmt = (n: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
          // C1: desglose mano de obra + piezas para admin/técnico
          const manoObra = Number(orden.presupuestoManoDeObra ?? orden.costoReparacion ?? 0);
          const piezas   = Number(orden.presupuestoPiezas     ?? orden.costoPartes     ?? 0);
          const tieneDesglose = (isAdmin || user?.role === "tecnico") && (manoObra > 0 || piezas > 0);
          return (
            <div
              className="px-4 py-2 flex-shrink-0 flex flex-col gap-1"
              style={{
                background: saldo > 0 ? "var(--color-warning-bg)" : "var(--color-bg-surface)",
                borderBottom: "1px solid var(--color-border-subtle)",
              }}
            >
              {/* Fila principal */}
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-1.5 min-w-0">
                  <DollarSign className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--color-text-muted)" }} />
                  <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>Total:</span>
                  <span className="text-xs font-bold font-mono" style={{ color: "var(--color-text-primary)" }}>{fmt(total)}</span>
                  {!total && (
                    <span className="text-xs px-1 rounded" style={{ background: "var(--color-warning-bg)", color: "var(--color-warning-text)" }}>est.</span>
                  )}
                </div>
                {anticipos > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>Anticipo:</span>
                    <span className="text-xs font-mono" style={{ color: "var(--color-success)" }}>−{fmt(anticipos)}</span>
                  </div>
                )}
                {saldo > 0 && (
                  <div className="flex items-center gap-1.5 ml-auto">
                    <span className="text-xs font-semibold" style={{ color: "var(--color-warning-text)" }}>Saldo:</span>
                    <span className="text-sm font-bold font-mono" style={{ color: "var(--color-warning-text)" }}>{fmt(saldo)}</span>
                  </div>
                )}
                {saldo <= 0 && anticipos > 0 && (
                  <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--color-success-bg)", color: "var(--color-success-text)" }}>
                    Pagado ✓
                  </span>
                )}
              </div>
              {/* C1: Fila de desglose (admin/técnico) */}
              {tieneDesglose && (
                <div className="flex items-center gap-3 flex-wrap">
                  {manoObra > 0 && (
                    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      Mano de obra: <span className="font-mono">{fmt(manoObra)}</span>
                    </span>
                  )}
                  {piezas > 0 && (
                    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      Piezas: <span className="font-mono">{fmt(piezas)}</span>
                    </span>
                  )}
                  {manoObra > 0 && piezas > 0 && (
                    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      = <span className="font-mono font-semibold">{fmt(manoObra + piezas)}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Overdue + listo_entrega: WhatsApp promotion banner ── */}
        {overdueAlert && orden.clienteTelefono && orden.estado === "listo_entrega" && (
          <div
            className="mx-3 mt-2 flex-shrink-0 rounded-xl px-3 py-2.5 flex items-center justify-between gap-3"
            style={{
              background: "var(--color-warning-bg)",
              border: "1px solid var(--color-warning)",
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: "var(--color-warning)" }} />
              <div className="min-w-0">
                <p className="text-xs font-bold leading-tight" style={{ color: "var(--color-warning-text)" }}>
                  Equipo listo · entrega vencida
                </p>
                <p className="text-xs leading-tight truncate" style={{ color: "var(--color-warning)" }}>
                  Invita al cliente a pasar hoy y libera caja
                </p>
              </div>
            </div>
            <a
              href={encodeURI(
                `https://wa.me/52${orden.clienteTelefono.replace(/\D/g, "")}?text=Hola ${orden.clienteNombre || "cliente"} 👋 Tu equipo ${orden.marcaDispositivo} ${orden.modeloDispositivo} ya está listo para recoger. Folio: ${orden.folio}. ¡Te esperamos hoy! 📱`
              )}
              target="_blank"
              rel="noreferrer"
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold"
              style={{ background: "#25D366", color: "#fff" }}
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Avisar WA
            </a>
          </div>
        )}

        {/* ── Tabs bar ── */}
        <div
          className="flex-shrink-0 flex items-center overflow-x-auto mt-1"
          style={{
            background: "var(--color-bg-surface)",
            borderBottom: "1px solid var(--color-border)",
            scrollbarWidth: "none",
          }}
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap flex-shrink-0"
                style={{
                  color: isActive ? "var(--color-accent)" : "var(--color-text-muted)",
                  borderBottom: isActive ? "2px solid var(--color-accent)" : "2px solid transparent",
                  background: "transparent",
                  transition: "color 150ms ease",
                }}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── Scrollable content area — THE CRITICAL FIX ── */}
        <div
          className="flex-1 min-h-0 overflow-y-auto p-4"
          style={{
            overscrollBehavior: "contain",
            WebkitOverflowScrolling: "touch",
          } as React.CSSProperties}
        >
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--color-accent)" }} />
            </div>
          ) : drawerError ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3 p-6">
              <Wrench className="w-10 h-10" style={{ color: "var(--color-danger)" }} />
              <p className="text-sm text-center" style={{ color: "var(--color-text-secondary)" }}>
                No se pudo cargar la orden.
              </p>
              <button
                onClick={() => fetchOrden()}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: "var(--color-accent)", color: "#fff" }}
              >
                Reintentar
              </button>
            </div>
          ) : !orden && hasFetched ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <Wrench className="w-10 h-10" style={{ color: "var(--color-border-strong)" }} />
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>No se encontró la orden</p>
            </div>
          ) : !orden ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--color-accent)" }} />
            </div>
          ) : (
            renderTab()
          )}
        </div>
      </div>

      {/* Modales — fuera del panel para evitar clipping */}
      {orden && (
        <>
          <ModalEditarOrden
            isOpen={modalEditarOpen}
            onClose={() => setModalEditarOpen(false)}
            orden={orden}
            onSuccess={handleSuccess}
          />
          <ModalEditarPresupuesto
            isOpen={modalPresupuestoOpen}
            onClose={() => setModalPresupuestoOpen(false)}
            orden={orden}
            onSuccess={handleSuccess}
          />
          <ModalCambiarEstado
            isOpen={modalCambiarEstadoOpen}
            onClose={() => setModalCambiarEstadoOpen(false)}
            ordenId={orden.id}
            folio={orden.folio}
            estadoActual={orden.estado}
            onSuccess={handleSuccess}
            onSuccessWithEstado={(nuevoEstado, notas) => {
              if (orden.clienteTelefono) {
                setWaModalEstado(nuevoEstado);
                setWaModalNotas(notas);
                setWaModalOpen(true);
              }
            }}
            estadoInicial={estadoInicialModal}
          />
          {orden.clienteTelefono && (
            <ModalWhatsAppEstado
              isOpen={waModalOpen}
              onClose={() => setWaModalOpen(false)}
              orden={orden}
              nuevoEstado={waModalEstado}
              notas={waModalNotas}
            />
          )}
        </>
      )}

      {/* C3: Modal revertir estado */}
      {revertirModalOpen && orden && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => !reviertendoEstado && setRevertirModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-5 flex flex-col gap-4"
            style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 flex-shrink-0" style={{ color: "var(--color-danger, #dc2626)" }} />
              <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                Revertir estado
              </h3>
            </div>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              La orden pasará de <strong>{orden.estado}</strong> al estado anterior.
              Esta acción queda registrada en el historial.
            </p>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>
                Motivo (obligatorio)
              </label>
              <textarea
                rows={3}
                className="w-full text-xs rounded-lg px-3 py-2 resize-none"
                style={{
                  background: "var(--color-bg-input)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-primary)",
                }}
                placeholder="Ej: Se marcó como listo por error, falta verificar la pantalla"
                value={motivoRevertir}
                onChange={(e) => setMotivoRevertir(e.target.value)}
                disabled={reviertendoEstado}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: "var(--color-bg-subtle)", color: "var(--color-text-secondary)" }}
                onClick={() => setRevertirModalOpen(false)}
                disabled={reviertendoEstado}
              >
                Cancelar
              </button>
              <button
                className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1"
                style={{ background: "var(--color-danger, #dc2626)", color: "#fff", opacity: !motivoRevertir.trim() || reviertendoEstado ? 0.5 : 1 }}
                disabled={!motivoRevertir.trim() || reviertendoEstado}
                onClick={async () => {
                  if (!motivoRevertir.trim()) return;
                  setRevirtiendoEstado(true);
                  try {
                    const res = await fetch(`/api/reparaciones/${orden.id}/revertir-estado`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ motivo: motivoRevertir }),
                    });
                    const data = await res.json();
                    if (data.success) {
                      setRevertirModalOpen(false);
                      setMotivoRevertir("");
                      handleSuccess();
                    } else {
                      alert(data.error || "Error al revertir el estado");
                    }
                  } catch {
                    alert("Error de red al revertir estado");
                  } finally {
                    setRevirtiendoEstado(false);
                  }
                }}
              >
                {reviertendoEstado && <Loader2 className="w-3 h-3 animate-spin" />}
                Revertir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
