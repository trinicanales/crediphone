"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Smartphone,
  Camera,
  Settings,
  Lock,
  PenTool,
  DollarSign,
  Plus,
  UserPlus,
  Wrench,
  ChevronDown,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { SistemaFotosOrden } from "./fotos/SistemaFotosOrden";
import { IconosFuncionamiento } from "./condiciones/IconosFuncionamiento";
import { IconosEstadoFisico } from "./condiciones/IconosEstadoFisico";
import { ComponentePresupuesto } from "./presupuesto/ComponentePresupuesto";
import { CapturaPatron } from "./patron/CapturaPatron";
import { FormularioCuentas } from "./cuentas/FormularioCuentas";
import { SelectorTipoFirma } from "./firma/SelectorTipoFirma";
import { generarDeslindesInteligentes } from "@/lib/deslindes-legales";
import {
  CondicionesFuncionamiento,
  EstadoFisicoDispositivo,
  CuentaDispositivo,
  ImagenReparacion,
  TipoFirma,
  AnticipoReparacion,
  CatalogoServicioReparacion,
} from "@/types";

interface Cliente {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string;
  direccion?: string;
  email?: string;
}

interface ModalOrdenProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ModalOrden({ isOpen, onClose, onSuccess }: ModalOrdenProps) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const router = useRouter();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mostrarFormNuevoCliente, setMostrarFormNuevoCliente] = useState(false);
  const [creandoCliente, setCreandoCliente] = useState(false);

  // Para super_admin: selección de distribuidor al crear cliente
  const [distribuidores, setDistribuidores] = useState<{ id: string; nombre: string }[]>([]);
  const [distribuidorSeleccionado, setDistribuidorSeleccionado] = useState("");

  // Form state - Datos básicos
  const [formData, setFormData] = useState({
    clienteId: "",
    marcaDispositivo: "",
    modeloDispositivo: "",
    imei: "",
    numeroSerie: "",
    accesoriosEntregados: "",
    problemaReportado: "",
    fechaEstimadaEntrega: "",
    prioridad: "normal",
    notasInternas: "",
  });

  // Form state - Nuevo cliente
  const [nuevoCliente, setNuevoCliente] = useState({
    nombre: "",
    apellido: "",
    telefono: "",
    direccion: "",
    email: "",
  });

  // Folio pre-reservado al abrir el modal
  const [folioReservado, setFolioReservado] = useState<string | null>(null);
  const [cargandoFolio, setCargandoFolio] = useState(false);

  // Form state - Fase 8B y 8C
  const [imagenes, setImagenes] = useState<ImagenReparacion[]>([]);
  const [condicionesFuncionamiento, setCondicionesFuncionamiento] =
    useState<CondicionesFuncionamiento>({
      bateria: "ok",
      pantallaTactil: "ok",
      camaras: "ok",
      microfono: "ok",
      altavoz: "ok",
      bluetooth: "ok",
      wifi: "ok",
      botonEncendido: "ok",
      botonesVolumen: "ok",
      sensorHuella: "ok",
      centroCarga: "ok",
      llegaApagado: false,
      estaMojado: false,
      bateriaHinchada: false,
    });

  const [estadoFisico, setEstadoFisico] = useState<EstadoFisicoDispositivo>({
    marco: "perfecto",
    bisel: "perfecto",
    pantallaFisica: "perfecto",
    camaraLente: "perfecto",
    tapaTrasera: "perfecto",
    tieneSIM: false,
    tieneMemoriaSD: false,
    observacionesFisicas: "",
  });

  // Presupuesto
  const [presupuestoTotal, setPresupuestoTotal] = useState<number>(0);
  const [presupuestoManoDeObra, setPresupuestoManoDeObra] = useState<number>(0);
  const [presupuestoPiezas, setPresupuestoPiezas] = useState<number>(0);
  // Cargo de cancelación: monto mínimo que se retiene si el cliente cancela el servicio
  // Se muestra en el PDF y aplica al cancelar desde el POS (default $100 MXN)
  const [cargoCancelacion, setCargoCancelacion] = useState<number>(100);
  const [anticipos, setAnticipos] = useState<any[]>([]);
  const [piezasCotizacion, setPiezasCotizacion] = useState<any[]>([]);

  // FASE 54-B: Catálogo de servicios
  const [catalogo, setCatalogo] = useState<CatalogoServicioReparacion[]>([]);
  const [catalogoServicioId, setCatalogoServicioId] = useState<string>("");
  const [catalogoPrecioSugerido, setCatalogoPrecioSugerido] = useState<number | undefined>(undefined);
  const [loadingCatalogo, setLoadingCatalogo] = useState(false);

  const cargarCatalogo = useCallback(async () => {
    try {
      setLoadingCatalogo(true);
      const res = await fetch("/api/catalogo-servicios");
      const data = await res.json();
      if (data.success) setCatalogo(data.data);
    } catch {
      // No crítico - seguir sin catálogo
    } finally {
      setLoadingCatalogo(false);
    }
  }, []);
  // Archivos de foto pendientes de subir vía subida directa (modo creación)
  const [archivosPendientes, setArchivosPendientes] = useState<File[]>([]);
  // Token de sesión QR generado antes de guardar (para ligar esas fotos a la orden)
  const [qrSessionToken, setQrSessionToken] = useState<string | null>(null);

  const [patronDesbloqueo, setPatronDesbloqueo] = useState<string>("");
  const [passwordDispositivo, setPasswordDispositivo] = useState<string>("");
  const [cuentasDispositivo, setCuentasDispositivo] = useState<CuentaDispositivo[]>([]);
  const [tipoFirma, setTipoFirma] = useState<TipoFirma | null>(null);
  const [firmaData, setFirmaData] = useState<string | null>(null);
  const [clienteNombreCompleto, setClienteNombreCompleto] = useState<string>("");
  // Flag para saber si el usuario ya escribió manualmente en "Problema Reportado"
  const [problemaEditadoManualmente, setProblemaEditadoManualmente] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchClientes();
      reservarFolio();
      cargarCatalogo();
      if (isSuperAdmin) fetchDistribuidores();
    } else {
      // Si el modal se cierra sin haber guardado, cancelar el folio reservado
      if (folioReservado) {
        cancelarFolioReservado(folioReservado);
        setFolioReservado(null);
      }
      // Limpiar selección de catálogo
      setCatalogoServicioId("");
      setCatalogoPrecioSugerido(undefined);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Cancelar folio si el usuario cierra la pestaña o navega fuera con el modal abierto
  useEffect(() => {
    if (!isOpen || !folioReservado) return;

    const cancelarConBeacon = () => {
      if (!folioReservado) return;
      // sendBeacon funciona incluso en beforeunload/visibilitychange
      navigator.sendBeacon(
        "/api/reparaciones/cancelar-folio",
        new Blob(
          [JSON.stringify({ folio: folioReservado })],
          { type: "application/json" }
        )
      );
    };

    const handleBeforeUnload = () => cancelarConBeacon();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") cancelarConBeacon();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isOpen, folioReservado]);

  // Auto-poblar "Problema Reportado" con las fallas del checklist
  // Solo si el usuario no ha escrito nada manualmente
  useEffect(() => {
    if (problemaEditadoManualmente) return;

    const nombresComponentes: Record<string, string> = {
      bateria: "Batería",
      pantallaTactil: "Pantalla/Táctil",
      camaras: "Cámaras",
      microfono: "Micrófono",
      altavoz: "Altavoz",
      bluetooth: "Bluetooth",
      wifi: "WiFi",
      botonEncendido: "Botón de encendido",
      botonesVolumen: "Botones de volumen",
      sensorHuella: "Sensor de huella",
    };

    const partes: string[] = [];

    // Componentes con falla
    const fallasComponentes = Object.entries(nombresComponentes)
      .filter(([k]) => (condicionesFuncionamiento as unknown as Record<string, unknown>)[k] === "falla")
      .map(([, v]) => v);
    if (fallasComponentes.length > 0) {
      partes.push(`Fallas detectadas: ${fallasComponentes.join(", ")}`);
    }

    // Alertas especiales
    if (condicionesFuncionamiento.llegaApagado) partes.push("Llega apagado");
    if (condicionesFuncionamiento.estaMojado) partes.push("Daño por líquido");
    if (condicionesFuncionamiento.bateriaHinchada) partes.push("Batería hinchada");

    const descripcionAuto = partes.join(". ");
    setFormData((prev) => ({ ...prev, problemaReportado: descripcionAuto }));
  }, [condicionesFuncionamiento, problemaEditadoManualmente]);

  async function fetchDistribuidores() {
    try {
      const res = await fetch("/api/admin/distribuidores");
      const data = await res.json();
      if (data.success) {
        setDistribuidores(data.data.map((d: { id: string; nombre: string }) => ({ id: d.id, nombre: d.nombre })));
      }
    } catch {
      // silencioso
    }
  }

  async function reservarFolio() {
    try {
      setCargandoFolio(true);
      const response = await fetch("/api/reparaciones/reservar-folio", { method: "POST" });
      const data = await response.json();
      if (data.success) {
        setFolioReservado(data.folio);
      }
    } catch (error) {
      console.error("Error al reservar folio:", error);
    } finally {
      setCargandoFolio(false);
    }
  }

  async function cancelarFolioReservado(folio: string) {
    try {
      await fetch("/api/reparaciones/reservar-folio", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folio }),
      });
    } catch (error) {
      console.error("Error al cancelar folio:", error);
    }
  }

  async function fetchClientes() {
    try {
      setLoadingClientes(true);
      const response = await fetch("/api/clientes");
      const data = await response.json();

      if (data.success) {
        setClientes(data.data);
      }
    } catch (error) {
      console.error("Error al cargar clientes:", error);
    } finally {
      setLoadingClientes(false);
    }
  }

  async function handleCrearCliente(e: React.FormEvent) {
    e.preventDefault();

    if (!nuevoCliente.nombre || !nuevoCliente.apellido || !nuevoCliente.telefono) {
      alert("Por favor completa al menos Nombre, Apellido y Teléfono");
      return;
    }

    if (isSuperAdmin && !distribuidorSeleccionado) {
      alert("Por favor selecciona un distribuidor para el nuevo cliente");
      return;
    }

    try {
      setCreandoCliente(true);
      // CURP único para evitar violación de constraint UNIQUE de la tabla clientes
      const curpTemporal = `PEND-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      const response = await fetch("/api/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...nuevoCliente,
          direccion: nuevoCliente.direccion || "Sin dirección",
          curp: curpTemporal,
          ine: "PENDIENTE",
          ...(isSuperAdmin ? { distribuidorId: distribuidorSeleccionado } : {}),
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Agregar el nuevo cliente a la lista
        setClientes([...clientes, data.data]);
        // Seleccionarlo automáticamente
        setFormData({ ...formData, clienteId: data.data.id });
        // Cerrar el formulario
        setMostrarFormNuevoCliente(false);
        // Limpiar el formulario de nuevo cliente
        setNuevoCliente({
          nombre: "",
          apellido: "",
          telefono: "",
          direccion: "",
          email: "",
        });
        alert("✓ Cliente creado exitosamente");
      } else {
        alert(`Error: ${data.error || data.message || "No se pudo crear el cliente"}`);
      }
    } catch (error) {
      console.error("Error al crear cliente:", error);
      alert("Error al crear el cliente");
    } finally {
      setCreandoCliente(false);
    }
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    // Si el usuario escribe manualmente en "Problema Reportado", desactivar el auto-llenado
    if (name === "problemaReportado") {
      setProblemaEditadoManualmente(true);
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validaciones básicas
    if (
      !formData.clienteId ||
      !formData.marcaDispositivo ||
      !formData.modeloDispositivo ||
      !formData.problemaReportado
    ) {
      alert("Por favor completa los campos requeridos: Cliente, Marca, Modelo y Problema");
      return;
    }

    if (!tipoFirma || !firmaData) {
      alert("Por favor captura la firma del cliente antes de finalizar");
      return;
    }

    if (isSuperAdmin && !distribuidorSeleccionado) {
      alert("Por favor selecciona el distribuidor destino de la orden");
      return;
    }

    try {
      setSubmitting(true);

      // Generar deslindes legales automáticamente (para PDF)
      const deslindesLegales = generarDeslindesInteligentes(
        formData.problemaReportado,
        condicionesFuncionamiento,
        estadoFisico
      );

      const payload = {
        // Datos básicos
        ...formData,
        // Folio pre-reservado (generado al abrir el modal)
        folioPreReservado: folioReservado || undefined,

        // Fase 8B - Datos avanzados
        patronDesbloqueo: patronDesbloqueo || null,
        passwordDispositivo: passwordDispositivo || null,
        cuentasDispositivo: cuentasDispositivo,
        condicionesFuncionamiento: condicionesFuncionamiento,
        estadoFisicoDispositivo: estadoFisico,
        deslindesLegales: deslindesLegales,
        firmaCliente: firmaData,
        tipoFirma: tipoFirma,
        fechaFirma: new Date().toISOString(),
        imagenesIds: imagenes.map((img) => img.id),

        // Fase 8C - Presupuesto + desglose mano de obra / piezas
        presupuestoTotal,
        presupuestoManoDeObra,
        presupuestoPiezas,
        anticiposData: anticipos,
        piezasCotizacion: piezasCotizacion,
        cargoCancelacion,

        // FASE 54-B: Referencia al servicio del catálogo seleccionado
        catalogoServicioId: catalogoServicioId || null,

        // Super admin: asignar a distribuidor específico
        ...(isSuperAdmin && distribuidorSeleccionado ? { distribuidorId: distribuidorSeleccionado } : {}),
      };

      const response = await fetch("/api/reparaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        const ordenCreada = data.data;

        // 1. Ligar fotos subidas por QR antes de guardar (si el empleado usó QR durante la creación)
        if (qrSessionToken) {
          try {
            await fetch("/api/reparaciones/fotos/ligar-sesion-qr", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionToken: qrSessionToken, ordenId: ordenCreada.id }),
            });
          } catch (e) {
            console.error("Error al ligar fotos QR a la orden:", e);
          }
        }

        // 2. Subir fotos elegidas directamente (subida directa en creación)
        if (archivosPendientes.length > 0) {
          try {
            const fotosForm = new FormData();
            fotosForm.append("ordenId", ordenCreada.id);
            fotosForm.append("tipoImagen", "dispositivo");
            fotosForm.append("subidoDesde", "web");
            archivosPendientes.forEach((file, i) => fotosForm.append(`imagen${i}`, file));
            const fotosRes = await fetch("/api/reparaciones/fotos", { method: "POST", body: fotosForm });
            const fotosData = await fotosRes.json().catch(() => ({ success: false }));
            if (!fotosData.success) {
              console.error("Error al subir fotos pendientes:", fotosData);
              alert(`⚠️ La orden fue creada pero las fotos no se pudieron subir.\n\nPuedes agregarlas desde el tab "Fotos" en la orden.`);
            }
          } catch (fotoError) {
            console.error("Error al subir fotos pendientes:", fotoError);
            alert(`⚠️ La orden fue creada pero hubo un error de conexión al subir las fotos.\n\nPuedes agregarlas desde el tab "Fotos" en la orden.`);
          }
        }

        // 3. Generar sesión QR para usar después (en la página de detalle)
        try {
          await fetch("/api/reparaciones/qr/generar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ordenId: ordenCreada.id }),
          });
        } catch (qrError) {
          console.error("Error al generar QR post-creación:", qrError);
        }

        // Generar PDF automáticamente y descargarlo
        try {
          const pdfResponse = await fetch(`/api/reparaciones/${data.data.id}/pdf`, {
            method: "POST",
          });

          if (pdfResponse.ok) {
            const pdfBlob = await pdfResponse.blob();
            const pdfUrl = URL.createObjectURL(pdfBlob);
            const a = document.createElement("a");
            a.href = pdfUrl;
            a.download = `Orden-${data.data.folio}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(pdfUrl);
          } else {
            const errData = await pdfResponse.json().catch(() => ({}));
            const msg = errData?.message || `Error ${pdfResponse.status} al generar PDF`;
            console.error("Error al generar PDF:", msg);
            alert(`⚠️ La orden fue creada correctamente pero el PDF no se pudo generar.\n\n${msg}\n\nPuedes descargarlo desde el botón "Descargar PDF" en el detalle de la orden.`);
          }
        } catch (pdfError) {
          console.error("Error al generar PDF:", pdfError);
          alert("⚠️ La orden fue creada correctamente pero hubo un error de conexión al generar el PDF.\n\nPuedes descargarlo desde el botón \"Descargar PDF\" en el detalle de la orden.");
        }

        const ordenId = data.data.id;

        // Limpiar folio reservado (ya fue usado — no cancelar)
        setFolioReservado(null);
        onSuccess();
        onClose();
        resetForm();

        // Redirigir al detalle: ahí el técnico puede usar el QR de fotos (tab Fotos)
        router.push(`/dashboard/reparaciones/${ordenId}`);
      } else {
        alert(`Error: ${data.error || data.message || "No se pudo crear la orden"}`);
      }
    } catch (error) {
      console.error("Error al crear orden:", error);
      alert("Error al crear la orden de reparación");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setFormData({
      clienteId: "",
      marcaDispositivo: "",
      modeloDispositivo: "",
      imei: "",
      numeroSerie: "",
      accesoriosEntregados: "",
      problemaReportado: "",
      fechaEstimadaEntrega: "",
      prioridad: "normal",
      notasInternas: "",
    });
    setImagenes([]);
    setCondicionesFuncionamiento({
      bateria: "ok",
      pantallaTactil: "ok",
      camaras: "ok",
      microfono: "ok",
      altavoz: "ok",
      bluetooth: "ok",
      wifi: "ok",
      botonEncendido: "ok",
      botonesVolumen: "ok",
      sensorHuella: "ok",
      centroCarga: "ok",
      llegaApagado: false,
      estaMojado: false,
      bateriaHinchada: false,
    });
    setEstadoFisico({
      marco: "perfecto",
      bisel: "perfecto",
      pantallaFisica: "perfecto",
      camaraLente: "perfecto",
      tapaTrasera: "perfecto",
      tieneSIM: false,
      tieneMemoriaSD: false,
      observacionesFisicas: "",
    });
    setPresupuestoTotal(0);
    setPresupuestoManoDeObra(0);
    setPresupuestoPiezas(0);
    setCargoCancelacion(100);
    setAnticipos([]);
    setPiezasCotizacion([]);
    setPatronDesbloqueo("");
    setPasswordDispositivo("");
    setCuentasDispositivo([]);
    setTipoFirma(null);
    setFirmaData(null);
    setClienteNombreCompleto("");
    setArchivosPendientes([]);
    setDistribuidorSeleccionado("");
    setProblemaEditadoManualmente(false);
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="📝 Nueva Orden de Reparación"
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* FOLIO PRE-GENERADO */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.5rem 0.75rem", borderRadius: "0.5rem", border: "1px dashed var(--color-accent)", background: "var(--color-accent-light)" }}>
          <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--color-accent)" }}>Folio de la orden:</span>
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--color-primary)", letterSpacing: "0.1em", fontSize: "1rem" }}>
            {cargandoFolio ? "Generando..." : (folioReservado || "Pendiente")}
          </span>
        </div>

        {/* SELECTOR DE DISTRIBUIDOR (solo super_admin) */}
        {isSuperAdmin && (
          <div className="px-2">
            <div style={{ borderRadius: "0.5rem", border: "2px solid var(--color-warning)", background: "var(--color-warning-bg)", padding: "0.75rem" }}>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "var(--color-warning-text)", marginBottom: "0.25rem" }}>
                🏪 Distribuidor de la Orden <span style={{ color: "var(--color-danger)" }}>*</span>
              </label>
              <select
                value={distribuidorSeleccionado}
                onChange={(e) => setDistribuidorSeleccionado(e.target.value)}
                style={{ width: "100%", borderRadius: "0.5rem", border: "2px solid var(--color-warning)", background: "var(--color-bg-surface)", color: "var(--color-text-primary)", padding: "0.5rem 0.75rem", fontSize: "0.875rem", fontWeight: 500 }}
                required
              >
                <option value="">Seleccionar distribuidor destino...</option>
                {distribuidores.map((d) => (
                  <option key={d.id} value={d.id}>{d.nombre}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* El scroll lo maneja el Modal; solo añadimos padding lateral y espaciado */}
        <div className="px-2 space-y-6">

          {/* SECCIÓN 1: DATOS BÁSICOS */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ borderRadius: "0.75rem", border: "2px solid var(--color-primary-mid)", background: "var(--color-primary-light)", padding: "1.5rem", boxShadow: "var(--shadow-md)" }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
                <div style={{ borderRadius: "0.75rem", background: "var(--color-primary)", padding: "0.75rem", boxShadow: "var(--shadow-md)" }}>
                  <User className="h-6 w-6" style={{ color: "var(--color-primary-text)" }} />
                </div>
                <div>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--color-primary)" }}>Datos Básicos</h2>
                  <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>Información del cliente y dispositivo</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Cliente con opción de crear nuevo */}
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                    Cliente <span style={{ color: "var(--color-danger)" }}>*</span>
                  </label>

                  {!mostrarFormNuevoCliente ? (
                    <div className="flex gap-2">
                      <select
                        name="clienteId"
                        value={formData.clienteId}
                        onChange={(e) => {
                          handleChange(e);
                          const cli = clientes.find(c => c.id === e.target.value);
                          setClienteNombreCompleto(
                            cli ? `${cli.nombre} ${cli.apellido ?? ""}`.trim() : ""
                          );
                        }}
                        required
                        disabled={loadingClientes}
                        style={{ flex: 1, borderRadius: "0.5rem", border: "2px solid var(--color-border)", background: "var(--color-bg-sunken)", color: "var(--color-text-primary)", padding: "0.75rem 1rem", fontWeight: 500, fontSize: "0.875rem" }}
                      >
                        <option value="">
                          {loadingClientes ? "Cargando clientes..." : "Seleccionar cliente"}
                        </option>
                        {clientes.map((cliente) => (
                          <option key={cliente.id} value={cliente.id}>
                            {cliente.nombre} {cliente.apellido} - {cliente.telefono}
                          </option>
                        ))}
                      </select>

                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setMostrarFormNuevoCliente(true)}
                        style={{ display: "flex", alignItems: "center", gap: "0.5rem", borderRadius: "0.5rem", background: "var(--color-success)", padding: "0.75rem 1rem", fontWeight: 600, color: "#fff", boxShadow: "var(--shadow-md)" }}
                      >
                        <UserPlus className="h-5 w-5" />
                        Nuevo
                      </motion.button>
                    </div>
                  ) : (
                    <AnimatePresence>
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{ overflow: "hidden", borderRadius: "0.75rem", border: "2px solid var(--color-success)", background: "var(--color-success-bg)", padding: "1rem", boxShadow: "var(--shadow-md)" }}
                      >
                        <h4 style={{ marginBottom: "0.75rem", fontSize: "0.875rem", fontWeight: 700, color: "var(--color-success-text)" }}>
                          Crear Nuevo Cliente
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {isSuperAdmin && (
                            <select
                              value={distribuidorSeleccionado}
                              onChange={(e) => setDistribuidorSeleccionado(e.target.value)}
                              style={{ gridColumn: "span 2", borderRadius: "0.5rem", border: "2px solid var(--color-warning)", background: "var(--color-warning-bg)", color: "var(--color-text-primary)", padding: "0.5rem 0.75rem", fontSize: "0.875rem" }}
                              required
                            >
                              <option value="">Seleccionar distribuidor *</option>
                              {distribuidores.map((d) => (
                                <option key={d.id} value={d.id}>{d.nombre}</option>
                              ))}
                            </select>
                          )}
                          <input
                            type="text"
                            value={nuevoCliente.nombre}
                            onChange={(e) => setNuevoCliente({ ...nuevoCliente, nombre: e.target.value })}
                            placeholder="Nombre *"
                            style={{ borderRadius: "0.5rem", border: "2px solid var(--color-border)", background: "var(--color-bg-surface)", color: "var(--color-text-primary)", padding: "0.5rem 0.75rem", fontSize: "0.875rem" }}
                            required
                          />
                          <input
                            type="text"
                            value={nuevoCliente.apellido}
                            onChange={(e) => setNuevoCliente({ ...nuevoCliente, apellido: e.target.value })}
                            placeholder="Apellido *"
                            style={{ borderRadius: "0.5rem", border: "2px solid var(--color-border)", background: "var(--color-bg-surface)", color: "var(--color-text-primary)", padding: "0.5rem 0.75rem", fontSize: "0.875rem" }}
                            required
                          />
                          <input
                            type="tel"
                            value={nuevoCliente.telefono}
                            onChange={(e) => setNuevoCliente({ ...nuevoCliente, telefono: e.target.value })}
                            placeholder="Teléfono *"
                            style={{ borderRadius: "0.5rem", border: "2px solid var(--color-border)", background: "var(--color-bg-surface)", color: "var(--color-text-primary)", padding: "0.5rem 0.75rem", fontSize: "0.875rem" }}
                            required
                          />
                          <input
                            type="email"
                            value={nuevoCliente.email}
                            onChange={(e) => setNuevoCliente({ ...nuevoCliente, email: e.target.value })}
                            placeholder="Email (opcional)"
                            style={{ borderRadius: "0.5rem", border: "2px solid var(--color-border)", background: "var(--color-bg-surface)", color: "var(--color-text-primary)", padding: "0.5rem 0.75rem", fontSize: "0.875rem" }}
                          />
                          <input
                            type="text"
                            value={nuevoCliente.direccion}
                            onChange={(e) => setNuevoCliente({ ...nuevoCliente, direccion: e.target.value })}
                            placeholder="Dirección (opcional)"
                            style={{ gridColumn: "span 2", borderRadius: "0.5rem", border: "2px solid var(--color-border)", background: "var(--color-bg-surface)", color: "var(--color-text-primary)", padding: "0.5rem 0.75rem", fontSize: "0.875rem" }}
                          />
                        </div>
                        <div className="mt-3 flex gap-2">
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleCrearCliente}
                            disabled={creandoCliente}
                            style={{ flex: 1, borderRadius: "0.5rem", background: "var(--color-success)", padding: "0.5rem 1rem", fontSize: "0.875rem", fontWeight: 600, color: "#fff", boxShadow: "var(--shadow-sm)", opacity: creandoCliente ? 0.5 : 1 }}
                          >
                            {creandoCliente ? "Creando..." : "Crear Cliente"}
                          </motion.button>
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setMostrarFormNuevoCliente(false)}
                            style={{ borderRadius: "0.5rem", border: "2px solid var(--color-border)", background: "var(--color-bg-surface)", padding: "0.5rem 1rem", fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-primary)" }}
                          >
                            Cancelar
                          </motion.button>
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  )}
                </div>

                {/* Dispositivo */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                      Marca <span style={{ color: "var(--color-danger)" }}>*</span>
                    </label>
                    <input
                      type="text"
                      name="marcaDispositivo"
                      value={formData.marcaDispositivo}
                      onChange={handleChange}
                      required
                      placeholder="Samsung, Apple, Xiaomi"
                      style={{ width: "100%", borderRadius: "0.5rem", border: "2px solid var(--color-border)", background: "var(--color-bg-sunken)", color: "var(--color-text-primary)", padding: "0.75rem 1rem", fontWeight: 500, fontSize: "0.875rem" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                      Modelo <span style={{ color: "var(--color-danger)" }}>*</span>
                    </label>
                    <input
                      type="text"
                      name="modeloDispositivo"
                      value={formData.modeloDispositivo}
                      onChange={handleChange}
                      required
                      placeholder="Galaxy A54, iPhone 12"
                      style={{ width: "100%", borderRadius: "0.5rem", border: "2px solid var(--color-border)", background: "var(--color-bg-sunken)", color: "var(--color-text-primary)", padding: "0.75rem 1rem", fontWeight: 500, fontSize: "0.875rem" }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                      IMEI (Opcional)
                    </label>
                    <input
                      type="text"
                      name="imei"
                      value={formData.imei}
                      onChange={handleChange}
                      placeholder="15 dígitos"
                      maxLength={15}
                      style={{ width: "100%", borderRadius: "0.5rem", border: "2px solid var(--color-border)", background: "var(--color-bg-sunken)", color: "var(--color-text-primary)", padding: "0.75rem 1rem", fontFamily: "var(--font-mono)", fontSize: "0.875rem" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                      Número de Serie (Opcional)
                    </label>
                    <input
                      type="text"
                      name="numeroSerie"
                      value={formData.numeroSerie}
                      onChange={handleChange}
                      placeholder="Número de serie"
                      style={{ width: "100%", borderRadius: "0.5rem", border: "2px solid var(--color-border)", background: "var(--color-bg-sunken)", color: "var(--color-text-primary)", padding: "0.75rem 1rem", fontFamily: "var(--font-mono)", fontSize: "0.875rem" }}
                    />
                  </div>
                </div>

                {/* Accesorios Entregados */}
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                    Accesorios Entregados (Opcional)
                  </label>
                  <input
                    type="text"
                    name="accesoriosEntregados"
                    value={formData.accesoriosEntregados}
                    onChange={handleChange}
                    placeholder="Ej: cargador, funda, caja original"
                    style={{ width: "100%", borderRadius: "0.5rem", border: "2px solid var(--color-border)", background: "var(--color-bg-sunken)", color: "var(--color-text-primary)", padding: "0.75rem 1rem", fontSize: "0.875rem" }}
                  />
                </div>

                {/* Problema */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <label style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                      Problema Reportado <span style={{ color: "var(--color-danger)" }}>*</span>
                    </label>
                    {problemaEditadoManualmente && (
                      <button
                        type="button"
                        onClick={() => setProblemaEditadoManualmente(false)}
                        style={{ fontSize: "0.75rem", color: "var(--color-accent)", background: "none", border: "none", cursor: "pointer", padding: "0.25rem 0.5rem", borderRadius: "0.375rem" }}
                      >
                        ↩ Restaurar del checklist
                      </button>
                    )}
                  </div>
                  <textarea
                    name="problemaReportado"
                    value={formData.problemaReportado}
                    onChange={handleChange}
                    required
                    rows={3}
                    placeholder="Marca fallas en el checklist de condiciones (abajo) o escribe aquí el problema"
                    style={{ width: "100%", borderRadius: "0.5rem", border: "2px solid var(--color-border)", background: "var(--color-bg-sunken)", color: "var(--color-text-primary)", padding: "0.75rem 1rem", fontSize: "0.875rem", resize: "vertical" }}
                  />
                  {!problemaEditadoManualmente && (
                    <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
                      💡 Se llena automáticamente con las fallas marcadas en el checklist de condiciones
                    </p>
                  )}
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                    Prioridad
                  </label>
                  <select
                    name="prioridad"
                    value={formData.prioridad}
                    onChange={handleChange}
                    style={{ width: "100%", borderRadius: "0.5rem", border: "2px solid var(--color-border)", background: "var(--color-bg-sunken)", color: "var(--color-text-primary)", padding: "0.75rem 1rem", fontWeight: 500, fontSize: "0.875rem" }}
                  >
                    <option value="baja">🟢 Baja</option>
                    <option value="normal">🟡 Normal</option>
                    <option value="alta">🟠 Alta</option>
                    <option value="urgente">🔴 Urgente</option>
                  </select>
                </div>
              </div>
            </div>
          </motion.div>

          {/* SECCIÓN 2: FOTOS */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            style={{ borderRadius: "0.75rem", border: "2px solid var(--color-success)", background: "var(--color-success-bg)", padding: "1.5rem", boxShadow: "var(--shadow-md)" }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
                <div style={{ borderRadius: "0.75rem", background: "var(--color-success)", padding: "0.75rem", boxShadow: "var(--shadow-md)" }}>
                  <Camera className="h-6 w-6" style={{ color: "#fff" }} />
                </div>
                <div>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--color-success-text)" }}>Fotos del Dispositivo</h2>
                  <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>Subida directa o QR desde celular (tras guardar)</p>
                </div>
              </div>
              <SistemaFotosOrden
                ordenId={null}
                modoCreacion={true}
                imagenes={imagenes}
                onChange={setImagenes}
                onArchivosPendientes={setArchivosPendientes}
                onQrSessionToken={setQrSessionToken}
              />

              {/* Patrón de desbloqueo */}
              <div style={{ borderTop: "2px solid var(--color-success)", marginTop: "1.5rem", paddingTop: "1.5rem" }}>
                <CapturaPatron
                  onPatronCapturado={(patron) => setPatronDesbloqueo(patron.codificado)}
                  patronActual={patronDesbloqueo}
                />
              </div>

              {/* Contraseña / PIN del dispositivo */}
              <div style={{ borderTop: "2px solid var(--color-warning)", marginTop: "1.5rem", paddingTop: "1.5rem" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", marginBottom: "0.75rem" }}>
                  <span style={{ fontSize: "1.25rem" }}>🔐</span>
                  <div>
                    <p style={{ fontWeight: 600, color: "var(--color-text-primary)", fontSize: "0.875rem" }}>
                      Contraseña / PIN / Código
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                      Si el cliente tiene contraseña numérica o alfanumérica (opcional — el técnico la verá en la orden)
                    </p>
                  </div>
                </div>
                <input
                  type="text"
                  value={passwordDispositivo}
                  onChange={(e) => setPasswordDispositivo(e.target.value)}
                  placeholder="Ej: 1234, abc123, 0000..."
                  style={{ width: "100%", borderRadius: "0.5rem", border: "2px solid var(--color-warning)", background: "var(--color-warning-bg)", color: "var(--color-text-primary)", padding: "0.75rem 1rem", fontSize: "0.875rem", fontFamily: "var(--font-mono)", outline: "none" }}
                  maxLength={50}
                />
              </div>
            </div>
          </motion.div>

          {/* SECCIÓN 3: CONDICIONES */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            style={{ borderRadius: "0.75rem", border: "2px solid var(--color-warning)", background: "var(--color-warning-bg)", padding: "1.5rem", boxShadow: "var(--shadow-md)" }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
                <div style={{ borderRadius: "0.75rem", background: "var(--color-warning)", padding: "0.75rem", boxShadow: "var(--shadow-md)" }}>
                  <Settings className="h-6 w-6" style={{ color: "#fff" }} />
                </div>
                <div>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--color-warning-text)" }}>Condiciones del Dispositivo</h2>
                  <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>Funcionamiento y estado físico</p>
                </div>
              </div>

              <div className="space-y-6">
                <IconosFuncionamiento
                  condiciones={condicionesFuncionamiento}
                  onChange={setCondicionesFuncionamiento}
                />

                <div style={{ borderTop: "2px solid var(--color-warning)", paddingTop: "1.5rem" }}>
                  <IconosEstadoFisico
                    estadoFisico={estadoFisico}
                    onChange={setEstadoFisico}
                  />
                </div>
              </div>
            </div>
          </motion.div>

          {/* SECCIÓN 4: PRESUPUESTO */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            style={{ borderRadius: "0.75rem", border: "2px solid var(--color-accent)", background: "var(--color-accent-light)", padding: "1.5rem", boxShadow: "var(--shadow-md)" }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
                <div style={{ borderRadius: "0.75rem", background: "var(--color-accent)", padding: "0.75rem", boxShadow: "var(--shadow-md)" }}>
                  <DollarSign className="h-6 w-6" style={{ color: "#fff" }} />
                </div>
                <div>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--color-accent-hover)" }}>Presupuesto y Anticipos</h2>
                  <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>Costos y pagos parciales</p>
                </div>
              </div>

              {/* FASE 54-B: Selector de servicio del catálogo */}
              {catalogo.length > 0 && (
                <div style={{ marginBottom: "1.25rem" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                    <Wrench className="h-4 w-4" style={{ color: "var(--color-accent)" }} />
                    Servicio del catálogo (opcional)
                  </label>
                  <div style={{ position: "relative" }}>
                    <select
                      value={catalogoServicioId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setCatalogoServicioId(id);
                        if (id) {
                          const svc = catalogo.find((s) => s.id === id);
                          if (svc) setCatalogoPrecioSugerido(svc.precioEfectivo ?? svc.precioBase);
                        } else {
                          setCatalogoPrecioSugerido(undefined);
                        }
                      }}
                      disabled={loadingCatalogo}
                      style={{
                        width: "100%",
                        appearance: "none",
                        borderRadius: "0.5rem",
                        border: "2px solid var(--color-border)",
                        background: "var(--color-bg-surface)",
                        color: "var(--color-text-primary)",
                        padding: "0.75rem 2.5rem 0.75rem 1rem",
                        fontSize: "0.875rem",
                        fontWeight: 500,
                      }}
                    >
                      <option value="">— Seleccionar servicio del catálogo —</option>
                      {catalogo.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nombre}{s.marca ? ` · ${s.marca}` : ""}{s.modelo ? ` ${s.modelo}` : ""}
                          {" — "}$
                          {Number(s.precioEfectivo ?? s.precioBase).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="h-4 w-4" style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--color-text-muted)" }} />
                  </div>
                  {catalogoPrecioSugerido !== undefined && (
                    <p style={{ marginTop: "0.35rem", fontSize: "0.75rem", color: "var(--color-success-text)", backgroundColor: "var(--color-success-bg)", borderRadius: "0.375rem", padding: "0.25rem 0.5rem" }}>
                      Precio sugerido ${Number(catalogoPrecioSugerido).toLocaleString("es-MX", { minimumFractionDigits: 2 })} aplicado como mano de obra
                    </p>
                  )}
                </div>
              )}

              <ComponentePresupuesto
                presupuestoTotal={presupuestoTotal}
                anticipos={anticipos}
                defaultManoDeObra={catalogoPrecioSugerido}
                marcaDispositivo={formData.marcaDispositivo}
                modeloDispositivo={formData.modeloDispositivo}
                onChange={(data) => {
                  setPresupuestoTotal(data.presupuestoTotal);
                  setPresupuestoManoDeObra(data.manoDeObra);
                  setPresupuestoPiezas(data.precioPiezas);
                  setAnticipos(data.anticipos);
                  if (data.piezasCotizacion) setPiezasCotizacion(data.piezasCotizacion);
                }}
              />

              {/* Cargo de cancelación */}
              <div style={{ marginTop: "1.25rem", padding: "1rem", borderRadius: "0.5rem", border: "1px solid var(--color-border-subtle)", background: "var(--color-bg-elevated)" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                  <DollarSign className="h-4 w-4" style={{ color: "var(--color-warning)" }} />
                  Cargo por cancelación (MXN)
                </label>
                <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginBottom: "0.5rem" }}>
                  Monto mínimo que se retiene si el cliente cancela el servicio antes de que las piezas sean instaladas. Aparece en el documento de la orden.
                </p>
                <input
                  type="number"
                  min={0}
                  step={10}
                  value={cargoCancelacion}
                  onChange={(e) => setCargoCancelacion(Math.max(0, Number(e.target.value)))}
                  style={{
                    width: "160px",
                    borderRadius: "0.5rem",
                    border: "1.5px solid var(--color-border)",
                    background: "var(--color-bg-surface)",
                    color: "var(--color-text-primary)",
                    padding: "0.5rem 0.75rem",
                    fontSize: "0.875rem",
                    fontFamily: "var(--font-mono)",
                    fontWeight: 600,
                  }}
                />
              </div>
            </div>
          </motion.div>

          {/* SECCIÓN 5: CUENTAS DEL DISPOSITIVO */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            style={{ borderRadius: "0.75rem", border: "2px solid var(--color-info)", background: "var(--color-info-bg)", padding: "1.5rem", boxShadow: "var(--shadow-md)" }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
                <div style={{ borderRadius: "0.75rem", background: "var(--color-info)", padding: "0.75rem", boxShadow: "var(--shadow-md)" }}>
                  <Lock className="h-6 w-6" style={{ color: "#fff" }} />
                </div>
                <div>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--color-info-text)" }}>Cuentas del Dispositivo</h2>
                  <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>Google, Apple, Samsung, etc. (opcional)</p>
                </div>
              </div>

              <FormularioCuentas
                cuentas={cuentasDispositivo}
                onChange={setCuentasDispositivo}
              />
            </div>
          </motion.div>

          {/* SECCIÓN 6: FIRMA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            style={{ borderRadius: "0.75rem", border: "2px solid var(--color-danger)", background: "var(--color-danger-bg)", padding: "1.5rem", boxShadow: "var(--shadow-md)" }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
                <div style={{ borderRadius: "0.75rem", background: "var(--color-danger)", padding: "0.75rem", boxShadow: "var(--shadow-md)" }}>
                  <PenTool className="h-6 w-6" style={{ color: "#fff" }} />
                </div>
                <div>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--color-danger-text)" }}>
                    Firma del Cliente <span style={{ color: "var(--color-danger)" }}>*</span>
                  </h2>
                  <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>Digital o manuscrita</p>
                </div>
              </div>

              <SelectorTipoFirma
                tipoFirma={tipoFirma}
                firmaData={firmaData}
                nombreInicial={clienteNombreCompleto}
                onFirmaCapturada={(tipo, firma) => {
                  setTipoFirma(tipo);
                  setFirmaData(firma);
                }}
              />
            </div>
          </motion.div>
        </div>

        {/* Botones fijos al final */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ position: "sticky", bottom: 0, margin: "0 -1.5rem -1.5rem", display: "flex", gap: "0.75rem", borderTop: "2px solid var(--color-border-subtle)", background: "var(--color-bg-elevated)", padding: "1rem 1.5rem 1.5rem", backdropFilter: "blur(12px)" }}
        >
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClose}
            disabled={submitting}
            style={{ flex: 1, borderRadius: "0.75rem", border: "2px solid var(--color-border)", background: "var(--color-bg-surface)", padding: "0.75rem 1.5rem", fontWeight: 700, color: "var(--color-text-primary)", boxShadow: "var(--shadow-md)", opacity: submitting ? 0.5 : 1 }}
          >
            Cancelar
          </motion.button>
          <motion.button
            type="submit"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={submitting || !tipoFirma || !firmaData}
            style={{ flex: 1, borderRadius: "0.75rem", background: "var(--color-primary)", padding: "0.75rem 1.5rem", fontWeight: 700, color: "var(--color-primary-text)", boxShadow: "var(--shadow-md)", opacity: (submitting || !tipoFirma || !firmaData) ? 0.5 : 1 }}
          >
            {submitting ? (
              <>
                <span style={{ marginRight: "0.5rem" }}>⏳</span>
                Creando orden y PDF...
              </>
            ) : (
              <>
                <span style={{ marginRight: "0.5rem" }}>✓</span>
                Finalizar y Generar PDF
              </>
            )}
          </motion.button>
        </motion.div>
      </form>
    </Modal>
  );
}
