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
  Search,
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

  // B4: Selección de técnico asignado (solo admin/super_admin)
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const [tecnicos, setTecnicos] = useState<{ id: string; nombre: string }[]>([]);
  const [tecnicoId, setTecnicoId] = useState("");

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
  // Búsqueda de cliente (combobox): texto escrito por el usuario y visibilidad del dropdown
  const [busquedaCliente, setBusquedaCliente] = useState<string>("");
  const [clienteDropdownAbierto, setClienteDropdownAbierto] = useState(false);
  // Flag para saber si el usuario ya escribió manualmente en "Problema Reportado"
  const [problemaEditadoManualmente, setProblemaEditadoManualmente] = useState(false);

  // ERROR 1: Confirmación al cerrar
  const [confirmarSalirOpen, setConfirmarSalirOpen] = useState(false);

  // ERROR 2: Panel post-creación
  interface OrdenCreadaInfo {
    id: string;
    folio: string;
    telefono: string | null;
    marca: string;
    modelo: string;
    pdfBlobUrl: string | null;
  }
  const [ordenCreada, setOrdenCreada] = useState<OrdenCreadaInfo | null>(null);

  // Interceptar cierre del modal — siempre pedir confirmación
  function handleClose() {
    if (ordenCreada) {
      // Si ya se creó la orden, cerrar directo y redirigir
      if (ordenCreada.pdfBlobUrl) URL.revokeObjectURL(ordenCreada.pdfBlobUrl);
      setOrdenCreada(null);
      onSuccess();
      onClose();
      resetForm();
      router.push(`/dashboard/reparaciones/${ordenCreada.id}`);
    } else {
      setConfirmarSalirOpen(true);
    }
  }

  function handleConfirmarSalir() {
    setConfirmarSalirOpen(false);
    onClose();
    resetForm();
  }

  useEffect(() => {
    if (isOpen) {
      fetchClientes();
      reservarFolio();
      cargarCatalogo();
      if (isSuperAdmin) fetchDistribuidores();
      if (isAdmin) fetchTecnicos();
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

  async function fetchTecnicos() {
    try {
      const res = await fetch("/api/empleados?activos=true");
      const data = await res.json();
      if (data.success) {
        const lista = (data.data as { id: string; name: string; role: string }[])
          .filter((e) => e.role === "tecnico")
          .map((e) => ({ id: e.id, nombre: e.name }));
        setTecnicos(lista);
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
        // Propagar nombre a la firma digital
        setClienteNombreCompleto(`${nuevoCliente.nombre} ${nuevoCliente.apellido ?? ""}`.trim());
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

        // Admin: técnico asignado (opcional)
        ...(tecnicoId ? { tecnicoId } : {}),

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
            const ligarRes = await fetch("/api/reparaciones/fotos/ligar-sesion-qr", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionToken: qrSessionToken, ordenId: ordenCreada.id }),
            });
            const ligarData = await ligarRes.json().catch(() => ({ success: false, fotosLigadas: 0 }));
            if (!ligarData.success) {
              console.warn("[ModalOrden] ligar-sesion-qr falló:", ligarData.message);
            } else if (ligarData.fotosLigadas === 0) {
              console.warn("[ModalOrden] ligar-sesion-qr: 0 fotos ligadas (el cliente pudo no haber subido fotos todavía)");
            }
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

        // Generar PDF automáticamente, descargarlo y guardar URL para panel post-creación
        let pdfBlobUrl: string | null = null;
        try {
          const pdfResponse = await fetch(`/api/reparaciones/${data.data.id}/pdf`, {
            method: "POST",
          });

          if (pdfResponse.ok) {
            const pdfBlob = await pdfResponse.blob();
            pdfBlobUrl = URL.createObjectURL(pdfBlob);
            // Descarga automática
            const a = document.createElement("a");
            a.href = pdfBlobUrl;
            a.download = `Orden-${data.data.folio}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          } else {
            const errData = await pdfResponse.json().catch(() => ({}));
            console.error("Error al generar PDF:", errData?.message);
          }
        } catch (pdfError) {
          console.error("Error al generar PDF:", pdfError);
        }

        // Limpiar folio reservado (ya fue usado — no cancelar)
        setFolioReservado(null);

        // Mostrar panel de post-creación en lugar de cerrar inmediatamente
        const clienteOrden = clientes.find((c) => c.id === formData.clienteId);
        setOrdenCreada({
          id: data.data.id,
          folio: data.data.folio ?? data.data.id,
          telefono: clienteOrden?.telefono ?? null,
          marca: formData.marcaDispositivo,
          modelo: formData.modeloDispositivo,
          pdfBlobUrl,
        });
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
    setTecnicoId("");
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
    setBusquedaCliente("");
    setClienteDropdownAbierto(false);
    setArchivosPendientes([]);
    setDistribuidorSeleccionado("");
    setProblemaEditadoManualmente(false);
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="📝 Nueva Orden de Reparación"
      size="xl"
    >
      {/* ERROR 1: Diálogo de confirmación para salir */}
      {confirmarSalirOpen && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
        >
          <div className="rounded-2xl p-6 max-w-sm w-full space-y-4" style={{ background: "var(--color-bg-surface)", boxShadow: "var(--shadow-xl)", border: "1px solid var(--color-border)" }}>
            <p className="text-base font-bold" style={{ color: "var(--color-text-primary)" }}>¿Deseas salir?</p>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Si sales ahora, perderás todos los datos ingresados en el formulario.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmarSalirOpen(false)}
                className="flex-1 py-2.5 rounded-xl font-semibold text-sm"
                style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-primary)", border: "1px solid var(--color-border)" }}
              >
                Continuar editando
              </button>
              <button
                onClick={handleConfirmarSalir}
                className="flex-1 py-2.5 rounded-xl font-semibold text-sm"
                style={{ background: "var(--color-danger)", color: "#fff" }}
              >
                Sí, salir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ERROR 2: Panel post-creación */}
      {ordenCreada ? (
        <div className="space-y-5 py-2">
          <div className="text-center space-y-1">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto" style={{ background: "var(--color-success-bg)" }}>
              <span className="text-2xl">✓</span>
            </div>
            <p className="text-lg font-bold" style={{ color: "var(--color-text-primary)" }}>¡Orden creada!</p>
            <p className="text-sm font-mono font-semibold" style={{ color: "var(--color-accent)", fontFamily: "var(--font-mono)" }}>
              {ordenCreada.folio}
            </p>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              {ordenCreada.marca} {ordenCreada.modelo} · El PDF se descargó automáticamente
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {ordenCreada.pdfBlobUrl && (
              <button
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = ordenCreada.pdfBlobUrl!;
                  a.download = `Orden-${ordenCreada.folio}.pdf`;
                  a.click();
                }}
                className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-sm font-medium"
                style={{ background: "var(--color-accent-light)", color: "var(--color-accent)", border: "1px solid transparent" }}
              >
                <span className="text-xl">📄</span>
                Descargar PDF
              </button>
            )}
            {ordenCreada.pdfBlobUrl && (
              <button
                onClick={() => window.open(ordenCreada.pdfBlobUrl!, "_blank")}
                className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-sm font-medium"
                style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-secondary)", border: "1px solid var(--color-border)" }}
              >
                <span className="text-xl">🖨</span>
                Imprimir
              </button>
            )}
            {ordenCreada.telefono && (() => {
              const cleanPhone = ordenCreada.telefono!.replace(/\D/g, "");
              const msg = encodeURIComponent(
                `Hola, recibimos tu ${ordenCreada.marca} ${ordenCreada.modelo}.\nFolio de servicio: ${ordenCreada.folio}.\nTe avisamos cuando tengamos el diagnóstico. ¡Gracias por tu confianza! 🔧`
              );
              return (
                <a
                  href={`https://wa.me/52${cleanPhone}?text=${msg}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-sm font-medium"
                  style={{ background: "var(--color-success-bg)", color: "var(--color-success-text)", border: "1px solid transparent" }}
                >
                  <span className="text-xl">💬</span>
                  WhatsApp
                </a>
              );
            })()}
            <button
              onClick={() => {
                onSuccess();
                onClose();
                resetForm();
                if (ordenCreada.pdfBlobUrl) URL.revokeObjectURL(ordenCreada.pdfBlobUrl);
                setOrdenCreada(null);
                router.push(`/dashboard/reparaciones/${ordenCreada.id}`);
              }}
              className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-sm font-medium"
              style={{ background: "var(--color-info-bg)", color: "var(--color-info-text)", border: "1px solid transparent" }}
            >
              <span className="text-xl">📋</span>
              Ver ficha
            </button>
          </div>

          <button
            onClick={() => {
              if (ordenCreada.pdfBlobUrl) URL.revokeObjectURL(ordenCreada.pdfBlobUrl);
              setOrdenCreada(null);
              onSuccess();
              onClose();
              resetForm();
            }}
            className="w-full py-2.5 rounded-xl text-sm font-medium"
            style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }}
          >
            Cerrar
          </button>
        </div>
      ) : (
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
                      <div style={{ position: "relative", flex: 1 }}>
                        <div style={{ position: "relative" }}>
                          <Search
                            className="h-4 w-4"
                            style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)", pointerEvents: "none" }}
                          />
                          <input
                            type="text"
                            placeholder={loadingClientes ? "Cargando clientes..." : "Buscar cliente por nombre o teléfono..."}
                            value={
                              clienteDropdownAbierto
                                ? busquedaCliente
                                : formData.clienteId
                                  ? clienteNombreCompleto
                                  : busquedaCliente
                            }
                            onChange={(e) => setBusquedaCliente(e.target.value)}
                            onFocus={() => {
                              setClienteDropdownAbierto(true);
                              setBusquedaCliente("");
                            }}
                            onBlur={() => setTimeout(() => setClienteDropdownAbierto(false), 150)}
                            disabled={loadingClientes}
                            required={!formData.clienteId}
                            style={{ width: "100%", borderRadius: "0.5rem", border: "2px solid var(--color-border)", background: "var(--color-bg-sunken)", color: "var(--color-text-primary)", padding: "0.75rem 1rem 0.75rem 2.25rem", fontWeight: 500, fontSize: "0.875rem" }}
                          />
                        </div>

                        {clienteDropdownAbierto && (
                          <div
                            style={{ position: "absolute", top: "calc(100% + 0.25rem)", left: 0, right: 0, zIndex: 50, maxHeight: "220px", overflowY: "auto", borderRadius: "0.5rem", border: "2px solid var(--color-border)", background: "var(--color-bg-surface)", boxShadow: "var(--shadow-lg)" }}
                          >
                            {clientes
                              .filter((c) => {
                                const q = busquedaCliente.trim().toLowerCase();
                                if (!q) return true;
                                const nombreCompleto = `${c.nombre} ${c.apellido ?? ""}`.toLowerCase();
                                return nombreCompleto.includes(q) || (c.telefono ?? "").includes(q);
                              })
                              .sort((a, b) => `${a.nombre} ${a.apellido ?? ""}`.localeCompare(`${b.nombre} ${b.apellido ?? ""}`))
                              .slice(0, 50)
                              .map((cliente) => (
                                <div
                                  key={cliente.id}
                                  onMouseDown={() => {
                                    setFormData({ ...formData, clienteId: cliente.id });
                                    setClienteNombreCompleto(`${cliente.nombre} ${cliente.apellido ?? ""}`.trim());
                                    setBusquedaCliente("");
                                    setClienteDropdownAbierto(false);
                                  }}
                                  style={{ padding: "0.5rem 0.75rem", cursor: "pointer", fontSize: "0.875rem", color: "var(--color-text-primary)", borderBottom: "1px solid var(--color-border-subtle)" }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg-sunken)")}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                                >
                                  <div style={{ fontWeight: 600 }}>{cliente.nombre} {cliente.apellido}</div>
                                  <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontFamily: "var(--font-data)" }}>{cliente.telefono}</div>
                                </div>
                              ))}
                            {clientes.filter((c) => {
                              const q = busquedaCliente.trim().toLowerCase();
                              if (!q) return true;
                              const nombreCompleto = `${c.nombre} ${c.apellido ?? ""}`.toLowerCase();
                              return nombreCompleto.includes(q) || (c.telefono ?? "").includes(q);
                            }).length === 0 && (
                              <div style={{ padding: "0.75rem", fontSize: "0.875rem", color: "var(--color-text-muted)", textAlign: "center" }}>
                                Sin resultados — usa &quot;Nuevo&quot; para crear el cliente
                              </div>
                            )}
                          </div>
                        )}
                      </div>

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
                        <div className="grid grid-cols-1 gap-3">
                          {isSuperAdmin && (
                            <select
                              value={distribuidorSeleccionado}
                              onChange={(e) => setDistribuidorSeleccionado(e.target.value)}
                              style={{ width: "100%", borderRadius: "0.5rem", border: "2px solid var(--color-warning)", background: "var(--color-warning-bg)", color: "var(--color-text-primary)", padding: "0.75rem 1rem", fontSize: "1rem" }}
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
                            className="w-full"
                            value={nuevoCliente.nombre}
                            onChange={(e) => setNuevoCliente({ ...nuevoCliente, nombre: e.target.value })}
                            placeholder="Nombre *"
                            autoComplete="given-name"
                            style={{ borderRadius: "0.5rem", border: "2px solid var(--color-border)", background: "var(--color-bg-surface)", color: "var(--color-text-primary)", padding: "0.75rem 1rem", fontSize: "1rem" }}
                            required
                          />
                          <input
                            type="text"
                            className="w-full"
                            value={nuevoCliente.apellido}
                            onChange={(e) => setNuevoCliente({ ...nuevoCliente, apellido: e.target.value })}
                            placeholder="Apellido *"
                            autoComplete="family-name"
                            style={{ borderRadius: "0.5rem", border: "2px solid var(--color-border)", background: "var(--color-bg-surface)", color: "var(--color-text-primary)", padding: "0.75rem 1rem", fontSize: "1rem" }}
                            required
                          />
                          <input
                            type="tel"
                            className="w-full"
                            value={nuevoCliente.telefono}
                            onChange={(e) => setNuevoCliente({ ...nuevoCliente, telefono: e.target.value })}
                            placeholder="Teléfono *"
                            inputMode="numeric"
                            autoCorrect="off"
                            autoCapitalize="none"
                            autoComplete="tel"
                            style={{ borderRadius: "0.5rem", border: "2px solid var(--color-border)", background: "var(--color-bg-surface)", color: "var(--color-text-primary)", padding: "0.75rem 1rem", fontSize: "1rem", fontFamily: "var(--font-mono)" }}
                            required
                          />
                          <input
                            type="email"
                            className="w-full"
                            value={nuevoCliente.email}
                            onChange={(e) => setNuevoCliente({ ...nuevoCliente, email: e.target.value })}
                            placeholder="Email (opcional)"
                            autoCapitalize="none"
                            autoCorrect="off"
                            style={{ borderRadius: "0.5rem", border: "2px solid var(--color-border)", background: "var(--color-bg-surface)", color: "var(--color-text-primary)", padding: "0.75rem 1rem", fontSize: "1rem" }}
                          />
                          <input
                            type="text"
                            className="w-full"
                            value={nuevoCliente.direccion}
                            onChange={(e) => setNuevoCliente({ ...nuevoCliente, direccion: e.target.value })}
                            placeholder="Dirección (opcional)"
                            style={{ borderRadius: "0.5rem", border: "2px solid var(--color-border)", background: "var(--color-bg-surface)", color: "var(--color-text-primary)", padding: "0.75rem 1rem", fontSize: "1rem" }}
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
                  {/* Resumen de fallas del checklist — siempre visible cuando hay fallas marcadas */}
                  {(() => {
                    const nombresComponentes: Record<string, string> = {
                      bateria: "Batería", pantallaTactil: "Pantalla/Táctil", camaras: "Cámaras",
                      microfono: "Micrófono", altavoz: "Altavoz", bluetooth: "Bluetooth",
                      wifi: "WiFi", botonEncendido: "Botón encendido", botonesVolumen: "Botones volumen",
                      sensorHuella: "Sensor huella", centroCarga: "Centro de carga",
                    };
                    const fallas = Object.entries(nombresComponentes)
                      .filter(([k]) => (condicionesFuncionamiento as unknown as Record<string, unknown>)[k] === "falla")
                      .map(([, v]) => v as string);
                    const alertas = [
                      condicionesFuncionamiento.llegaApagado && "Llega apagado",
                      condicionesFuncionamiento.estaMojado && "Daño por líquido",
                      condicionesFuncionamiento.bateriaHinchada && "Batería hinchada",
                    ].filter(Boolean) as string[];
                    const todos = [...fallas, ...alertas];
                    if (todos.length === 0) return (
                      <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
                        💡 Se llena automáticamente con las fallas marcadas en el checklist de condiciones
                      </p>
                    );
                    return (
                      <div style={{ marginTop: "0.5rem", padding: "0.5rem 0.75rem", borderRadius: "0.5rem", background: "var(--color-warning-bg)", border: "1px solid var(--color-warning)" }}>
                        <p style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--color-warning-text)", marginBottom: "0.25rem" }}>
                          Fallas marcadas en checklist:
                        </p>
                        <p style={{ fontSize: "0.75rem", color: "var(--color-warning-text)" }}>
                          {todos.join(" · ")}
                        </p>
                        {problemaEditadoManualmente && (
                          <button
                            type="button"
                            onClick={() => setProblemaEditadoManualmente(false)}
                            style={{ marginTop: "0.25rem", fontSize: "0.7rem", color: "var(--color-accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                          >
                            ↩ Aplicar al campo de problema
                          </button>
                        )}
                      </div>
                    );
                  })()}
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

                {/* Técnico asignado — solo admin/super_admin */}
                {isAdmin && tecnicos.length > 0 && (
                  <div>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                      Técnico Asignado <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>(opcional)</span>
                    </label>
                    <select
                      value={tecnicoId}
                      onChange={(e) => setTecnicoId(e.target.value)}
                      style={{ width: "100%", borderRadius: "0.5rem", border: "2px solid var(--color-border)", background: "var(--color-bg-sunken)", color: "var(--color-text-primary)", padding: "0.75rem 1rem", fontWeight: 500, fontSize: "0.875rem" }}
                    >
                      <option value="">Sin asignar</option>
                      {tecnicos.map((t) => (
                        <option key={t.id} value={t.id}>{t.nombre}</option>
                      ))}
                    </select>
                  </div>
                )}
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
            onClick={handleClose}
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
      )}
    </Modal>
  );
}
