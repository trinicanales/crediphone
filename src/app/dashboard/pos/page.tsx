"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { ProductSearchBar } from "@/components/pos/ProductSearchBar";
import { ProductCategoryGrid } from "@/components/pos/ProductCategoryGrid";
import { ShoppingCart, CartItem } from "@/components/pos/ShoppingCart";
import { ServiciosPOSPanel, ServicioPOSItem } from "@/components/pos/ServiciosPOSPanel";
import { ReparacionesPOSPanel } from "@/components/pos/ReparacionesPOSPanel";
import { KitsPOSPanel } from "@/components/pos/KitsPOSPanel";
import { PaymentMethodSelector } from "@/components/pos/PaymentMethodSelector";
import { ReciboModal } from "@/components/pos/ReciboModal";
import { DescuentoPOS } from "@/components/pos/DescuentoPOS";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { ShoppingCart as CartIcon, DollarSign, Receipt, LogOut as CloseIcon, X, LayoutGrid, Search as SearchIcon, User, ScanLine, FileText, Tag, Wrench, Package2, UserCheck, Clock as ClockIn } from "lucide-react";
import { generarReporteX, abrirReporte } from "@/lib/utils/reportes";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { OfflineBanner } from "@/components/pos/OfflineBanner";
import { encolarOperacion } from "@/lib/offline/queue";
import type {
  Producto,
  CajaSesion,
  NuevaVentaFormData,
  VentaDetallada,
  EstadisticasPOS,
  Cliente,
} from "@/types";

export default function POSPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isOnline = useOnlineStatus();

  // Estado de sesión de caja
  const [sesionCaja, setSesionCaja] = useState<CajaSesion | null>(null);
  const [loadingSesion, setLoadingSesion] = useState(true);
  const [cajaOtroEmpleado, setCajaOtroEmpleado] = useState<{ folio: string; nombre: string } | null>(null);
  const [alertaCajaVisible, setAlertaCajaVisible] = useState(true);

  // Estado del carrito
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [descuento, setDescuento] = useState(0);
  const [propina, setPropina] = useState(0);

  // Feature 5: Resumen de créditos del cliente seleccionado
  const [resumenCliente, setResumenCliente] = useState<{
    creditosActivos: number;
    deudaTotal: number;
    ultimaVentaFecha: string | null;
    ultimaVentaMonto: number | null;
    score: number | null;
    scoreCategoria: string | null;
  } | null>(null);

  // Estado de pago
  const [paymentData, setPaymentData] = useState<any>(null);

  // Modal cobro rápido efectivo (F9)
  const [showCobroModal, setShowCobroModal] = useState(false);
  const [cobroMonto, setCobroMonto] = useState("");

  // Modal cierre rápido de turno (FASE 28)
  const [showCerrarTurnoModal, setShowCerrarTurnoModal] = useState(false);
  const [montoFinalTurno, setMontoFinalTurno] = useState("");
  const [notasCierreTurno, setNotasCierreTurno] = useState("");
  const [cerrandoTurno, setCerrandoTurno] = useState(false);

  // Modal abrir turno directo en POS (FASE 28)
  const [showAbrirTurnoModal, setShowAbrirTurnoModal] = useState(false);
  const [montoApertura, setMontoApertura] = useState("");
  const [notasApertura, setNotasApertura] = useState("");
  const [abriendoTurno, setAbriendoTurno] = useState(false);

  // FASE 31: Reporte X
  const [generandoReporteX, setGenerandoReporteX] = useState(false);

  // Integración asistencia ↔ caja
  // null = aún cargando, true = hay sesión activa, false = sin sesión
  const [asistenciaActiva, setAsistenciaActiva] = useState<boolean | null>(null);
  const [registrarEntradaConCaja, setRegistrarEntradaConCaja] = useState(true);
  const [registrarSalidaConCaja, setRegistrarSalidaConCaja] = useState(true);

  // FASE 30: Cliente seleccionado, notas de venta, modal IMEI
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [resultadosCliente, setResultadosCliente] = useState<Cliente[]>([]);
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [notasVenta, setNotasVenta] = useState("");
  const [showImeiModal, setShowImeiModal] = useState(false);
  const [imeiProductoPendiente, setImeiProductoPendiente] = useState<Producto | null>(null);
  const [imeiInput, setImeiInput] = useState("");

  // Estado de proceso
  const [processingVenta, setProcessingVenta] = useState(false);
  const [ventaCompletada, setVentaCompletada] = useState<VentaDetallada | null>(null);
  const [showReciboModal, setShowReciboModal] = useState(false);

  // Estadísticas
  const [stats, setStats] = useState<EstadisticasPOS | null>(null);

  // FASE 36/41/61: Sección activa del panel izquierdo
  const [posSection, setPosSection] = useState<"productos" | "servicios" | "reparaciones" | "kits">("productos");

  // Panel extras compacto: qué sección está expandida (null = todas cerradas)
  const [extrasPanel, setExtrasPanel] = useState<"descuento" | "cliente" | "notas" | null>(null);
  const toggleExtras = (panel: "descuento" | "cliente" | "notas") =>
    setExtrasPanel((prev) => (prev === panel ? null : panel));

  // FASE 29: modo dual Standard / Visual
  const [posMode, setPosMode] = useState<"standard" | "visual">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("pos_mode") as "standard" | "visual") || "standard";
    }
    return "standard";
  });
  const [searchFocusTrigger, setSearchFocusTrigger] = useState(0);

  const togglePosMode = (mode: "standard" | "visual") => {
    setPosMode(mode);
    localStorage.setItem("pos_mode", mode);
  };

  // Redirect non-admin/vendedor
  useEffect(() => {
    if (user && !["admin", "vendedor", "super_admin"].includes(user.role)) {
      router.push("/dashboard");
    }
  }, [user, router]);

  // Cargar sesión activa al montar
  useEffect(() => {
    if (user) {
      fetchSesionActiva();
      fetchEstadisticas();
      fetchAsistenciaActiva();
    }
  }, [user]);

  // FASE 29: F-keys globales
  useEffect(() => {
    const handleFKey = (e: KeyboardEvent) => {
      // Solo actuar cuando ningún modal esté abierto
      if (showCerrarTurnoModal || showCobroModal || showImeiModal) return;
      // Ignorar si el foco está en un input/textarea (excepto F3)
      const tag = (e.target as HTMLElement)?.tagName;
      const inInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      if (e.key === "F3") {
        e.preventDefault();
        if (posMode === "standard") {
          setSearchFocusTrigger((n) => n + 1);
        }
        return;
      }
      if (inInput) return; // el resto de F-keys no interrumpe el tipeo

      if (e.key === "F9" || e.key === "F10") {
        e.preventDefault();
        // Abrir modal de cobro rápido (F9 en Chrome, F10 en PWA donde no interfiere el browser)
        if (cartItems.length > 0 && sesionCaja) {
          setCobroMonto("");
          setShowCobroModal(true);
        }
        return;
      }

      if (e.key === "F12") {
        e.preventDefault();
        // Pago rápido: efectivo por monto exacto, sin confirmación manual
        document.getElementById("btn-pago-rapido-f12")?.click();
        return;
      }
    };

    window.addEventListener("keydown", handleFKey);
    return () => window.removeEventListener("keydown", handleFKey);
  }, [posMode, showCerrarTurnoModal]);

  const fetchAsistenciaActiva = async () => {
    try {
      const res = await fetch("/api/asistencia/activa");
      const data = await res.json();
      setAsistenciaActiva(data.success && !!data.data);
    } catch {
      setAsistenciaActiva(false);
    }
  };

  const fetchSesionActiva = async () => {
    try {
      setLoadingSesion(true);
      // 1. Verificar sesión propia
      const response = await fetch(`/api/pos/caja?action=activa&usuarioId=${user?.id}`);
      const data = await response.json();

      if (data.success && data.data) {
        setSesionCaja(data.data);
        setCajaOtroEmpleado(null);
      } else {
        setSesionCaja(null);
        // 2. Si no tengo sesión, verificar si hay una sesión de otro empleado en el distribuidor
        try {
          const resAll = await fetch("/api/pos/caja");
          const dataAll = await resAll.json();
          if (dataAll.success && Array.isArray(dataAll.data)) {
            const abierta = dataAll.data.find((s: any) => s.estado === "abierta" && s.usuarioId !== user?.id);
            if (abierta) {
              setCajaOtroEmpleado({
                folio: abierta.folio,
                nombre: abierta.empleadoNombre || "otro empleado",
              });
              setAlertaCajaVisible(true);
            } else {
              setCajaOtroEmpleado(null);
            }
          }
        } catch {}
      }
    } catch (error) {
      console.error("Error fetching sesion activa:", error);
    } finally {
      setLoadingSesion(false);
    }
  };

  const fetchEstadisticas = async () => {
    try {
      const response = await fetch("/api/pos/ventas?action=estadisticas");
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error("Error fetching estadisticas:", error);
    }
  };

  const handleSelectProduct = (producto: Producto) => {
    if (producto.stock <= 0) {
      alert("Producto sin stock disponible");
      return;
    }

    // Buscar si ya está en el carrito
    const existingIndex = cartItems.findIndex(
      (item) => !item.esServicio && item.producto?.id === producto.id
    );

    if (existingIndex >= 0) {
      // Incrementar cantidad si hay stock
      const newItems = [...cartItems];
      if (newItems[existingIndex].cantidad < producto.stock) {
        newItems[existingIndex].cantidad += 1;
        newItems[existingIndex].subtotal =
          newItems[existingIndex].cantidad * newItems[existingIndex].precioUnitario;
        setCartItems(newItems);
      } else {
        alert("No hay más stock disponible de este producto");
      }
    } else {
      // Agregar nuevo item de producto
      const newItem: CartItem = {
        producto,
        esServicio: false,
        cantidad: 1,
        precioUnitario: producto.precio,
        subtotal: producto.precio,
      };
      setCartItems([...cartItems, newItem]);
    }
  };

  // Obtiene la clave única del slot del carrito (compatible con productos y servicios)
  const getCartItemKey = (item: CartItem): string =>
    item.esServicio ? `svc_${item.servicioId}` : (item.producto?.id ?? "");

  const handleUpdateQuantity = (itemKey: string, cantidad: number) => {
    if (cantidad <= 0) {
      handleRemoveItem(itemKey);
      return;
    }

    const newItems = cartItems.map((item) => {
      if (getCartItemKey(item) === itemKey) {
        // Solo validar stock para productos físicos
        if (!item.esServicio && cantidad > (item.producto?.stock ?? 0)) {
          alert("Cantidad excede el stock disponible");
          return item;
        }
        return {
          ...item,
          cantidad,
          subtotal: cantidad * item.precioUnitario,
        };
      }
      return item;
    });

    setCartItems(newItems);
  };

  const handleRemoveItem = (itemKey: string) => {
    setCartItems(cartItems.filter((item) => getCartItemKey(item) !== itemKey));
  };

  // Feature 3: Editar precio unitario de un ítem del carrito
  const handleUpdatePrice = (itemKey: string, precio: number) => {
    setCartItems((prev) =>
      prev.map((item) => {
        if (getCartItemKey(item) === itemKey) {
          return { ...item, precioUnitario: precio, subtotal: precio * item.cantidad };
        }
        return item;
      })
    );
  };

  // FASE 36: Agregar un servicio al carrito
  const handleAgregarServicio = (svcItem: ServicioPOSItem) => {
    if (!svcItem.servicioId) return;

    if (!svcItem.esVarible) {
      // Precio fijo: incrementar cantidad si ya está en el carrito
      // servicioId en CartItem almacena el UUID real (sin prefijo svc_)
      const existingIndex = cartItems.findIndex(
        (i) => i.esServicio && i.servicioId === svcItem.servicioId
      );
      if (existingIndex >= 0) {
        const newItems = [...cartItems];
        newItems[existingIndex].cantidad += 1;
        newItems[existingIndex].subtotal =
          newItems[existingIndex].cantidad * newItems[existingIndex].precioUnitario;
        setCartItems(newItems);
        return;
      }
    }

    // Servicio de precio variable o primer item fijo: añadir nuevo slot
    // Para variables usamos sufijo timestamp como key única en el carrito
    const uniqueCartKey = svcItem.esVarible
      ? `${svcItem.servicioId}_${Date.now()}`
      : svcItem.servicioId;

    const newItem: CartItem = {
      esServicio: true,
      servicioId: uniqueCartKey,  // UUID (o UUID_timestamp para variables)
      servicioNombre: svcItem.nombre,
      cantidad: svcItem.cantidad,
      precioUnitario: svcItem.precioUnitario,
      subtotal: svcItem.subtotal,
    };
    setCartItems([...cartItems, newItem]);
  };

  // FASE 61: Agregar un kit al carrito
  const handleAgregarKit = (kitItem: CartItem) => {
    if (!kitItem.esKit || !kitItem.kitId) return;
    // Si ya está en el carrito, incrementar cantidad
    const existingIdx = cartItems.findIndex((i) => i.esKit && i.kitId === kitItem.kitId);
    if (existingIdx >= 0) {
      const newItems = [...cartItems];
      newItems[existingIdx].cantidad += 1;
      newItems[existingIdx].subtotal =
        newItems[existingIdx].cantidad * newItems[existingIdx].precioUnitario;
      setCartItems(newItems);
      return;
    }
    setCartItems([...cartItems, kitItem]);
  };

  const handleClearCart = () => {
    if (confirm("¿Limpiar carrito?")) {
      setCartItems([]);
      setDescuento(0);
    }
  };

  const handleCompletarVenta = async () => {
    // Validaciones
    if (cartItems.length === 0) {
      alert("El carrito está vacío");
      return;
    }

    if (!paymentData || !paymentData.isValid) {
      alert(paymentData?.errorMessage || "Método de pago inválido");
      return;
    }

    if (!sesionCaja) {
      alert("Debe abrir una sesión de caja para realizar ventas");
      return;
    }

    // Confirmar venta (total ya calculado arriba con propina incluida)
    if (
      !confirm(
        `¿Completar venta por $${total.toFixed(2)} con ${paymentData.metodoPago}?`
      )
    ) {
      return;
    }

    setProcessingVenta(true);

    try {
      // FASE 61: Expandir kits en sus items componentes para ventas_items
      const itemsExpandidos = cartItems.flatMap((item) => {
        if (item.esKit && item.kitItems && item.kitItems.length > 0) {
          // Distribuir el precio del kit proporcionalmente entre sus items
          // Precio unitario por kit × cantidad de kits, distribuido proporcionalmente
          // Por simplicidad: cada item lleva precio = 0 excepto el primero que lleva el total
          return item.kitItems.map((ki, idx) => ({
            productoId:    ki.productoId,
            servicioId:    undefined,
            servicioNombre: undefined,
            esServicio:    false,
            cantidad:      ki.cantidad * item.cantidad,
            precioUnitario: idx === 0 ? item.precioUnitario : 0, // precio completo en el primer item
            imei:          undefined,
            notas:         `Kit: ${item.kitNombre}`,
          }));
        }
        return [{
          productoId: item.esServicio ? undefined : item.producto?.id,
          servicioId: item.esServicio
            ? item.servicioId?.replace(/^svc_/, "").replace(/_\d+$/, "")
            : undefined,
          servicioNombre: item.esServicio ? item.servicioNombre : undefined,
          esServicio: item.esServicio,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
          imei: item.imei,
          notas: item.notas,
        }];
      });

      const ventaFormData: NuevaVentaFormData = {
        clienteId: clienteSeleccionado?.id,
        items: itemsExpandidos,
        descuento,
        propina: propina > 0 ? propina : undefined,
        metodoPago: paymentData.metodoPago,
        desgloseMixto: paymentData.desgloseMixto,
        referenciaPago: paymentData.referenciaPago,
        montoRecibido: paymentData.montoRecibido,
        notas: notasVenta || undefined,
      };

      // ── MODO OFFLINE ──────────────────────────────────────────────
      if (!isOnline) {
        await encolarOperacion({ tipo: "venta", payload: ventaFormData });
        setCartItems([]);
        setDescuento(0);
        setPropina(0);
        setResumenCliente(null);
        alert(`✓ Venta guardada localmente ($${total.toFixed(2)})\nSe enviará al servidor cuando vuelva el internet.`);
        setProcessingVenta(false);
        return;
      }
      // ─────────────────────────────────────────────────────────────

      const response = await fetch("/api/pos/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ventaFormData),
      });

      const data = await response.json();

      if (data.success) {
        setVentaCompletada(data.data);
        setShowReciboModal(true);
        // Limpiar carrito y datos
        setCartItems([]);
        setDescuento(0);
        setPropina(0);
        setResumenCliente(null);
        // Actualizar estadísticas
        fetchEstadisticas();
      } else {
        alert(data.error || "Error al crear venta");
      }
    } catch (error) {
      console.error("Error creating venta:", error);
      alert("Error al procesar la venta");
    } finally {
      setProcessingVenta(false);
    }
  };

  // FASE 29: F12 — pago rápido efectivo exacto
  const handlePagoRapido = async () => {
    if (cartItems.length === 0 || !sesionCaja) return;
    if (processingVenta) return;
    setProcessingVenta(true);
    try {
      const ventaFormData: NuevaVentaFormData = {
        clienteId: clienteSeleccionado?.id,
        items: cartItems.map((item) => ({
          productoId: item.esServicio ? undefined : item.producto?.id,
          servicioId: item.esServicio
            ? item.servicioId?.replace(/^svc_/, "").replace(/_\d+$/, "")
            : undefined,
          servicioNombre: item.esServicio ? item.servicioNombre : undefined,
          esServicio: item.esServicio,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
          imei: item.imei,
          notas: item.notas,
        })),
        descuento,
        propina: propina > 0 ? propina : undefined,
        metodoPago: "efectivo",
        montoRecibido: total,
        notas: notasVenta || undefined,
      };

      // ── MODO OFFLINE ──────────────────────────────────────────────
      if (!isOnline) {
        await encolarOperacion({ tipo: "venta", payload: ventaFormData });
        setCartItems([]);
        setDescuento(0);
        setPropina(0);
        alert(`✓ Venta guardada localmente ($${total.toFixed(2)})\nSe enviará al servidor cuando vuelva el internet.`);
        setProcessingVenta(false);
        return;
      }
      // ─────────────────────────────────────────────────────────────

      const response = await fetch("/api/pos/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ventaFormData),
      });
      const data = await response.json();
      if (data.success) {
        setVentaCompletada(data.data);
        setShowReciboModal(true);
        setCartItems([]);
        setDescuento(0);
        setPropina(0);
        fetchEstadisticas();
      } else {
        alert(data.error || "Error al crear venta");
      }
    } catch (error) {
      console.error("Error pago rápido:", error);
      alert("Error al procesar la venta");
    } finally {
      setProcessingVenta(false);
    }
  };

  // F9: cobrar en efectivo — monto exacto si se deja vacío, o con cambio si se ingresa más
  const handleCobroModal = async () => {
    if (cartItems.length === 0 || !sesionCaja || processingVenta) return;
    const montoIngresado = cobroMonto.trim() === "" ? total : parseFloat(cobroMonto);
    if (isNaN(montoIngresado) || montoIngresado < total) return;
    setShowCobroModal(false);
    setProcessingVenta(true);
    try {
      const ventaFormData: NuevaVentaFormData = {
        clienteId: clienteSeleccionado?.id,
        items: cartItems.map((item) => ({
          productoId: item.esServicio ? undefined : item.producto?.id,
          servicioId: item.esServicio
            ? item.servicioId?.replace(/^svc_/, "").replace(/_\d+$/, "")
            : undefined,
          servicioNombre: item.esServicio ? item.servicioNombre : undefined,
          esServicio: item.esServicio,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
          imei: item.imei,
          notas: item.notas,
        })),
        descuento,
        propina: propina > 0 ? propina : undefined,
        metodoPago: "efectivo",
        montoRecibido: montoIngresado,
        notas: notasVenta || undefined,
      };

      // ── MODO OFFLINE ──────────────────────────────────────────────
      if (!isOnline) {
        await encolarOperacion({ tipo: "venta", payload: ventaFormData });
        setCartItems([]);
        setDescuento(0);
        setPropina(0);
        alert(`✓ Venta guardada localmente ($${total.toFixed(2)})\nSe enviará al servidor cuando vuelva el internet.`);
        setProcessingVenta(false);
        return;
      }
      // ─────────────────────────────────────────────────────────────

      const response = await fetch("/api/pos/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ventaFormData),
      });
      const data = await response.json();
      if (data.success) {
        setVentaCompletada(data.data);
        setShowReciboModal(true);
        setCartItems([]);
        setDescuento(0);
        fetchEstadisticas();
      } else {
        alert(data.error || "Error al crear venta");
      }
    } catch {
      alert("Error al procesar la venta");
    } finally {
      setProcessingVenta(false);
    }
  };

  // FASE 31: Generar Reporte X del turno actual
  const handleReporteX = async () => {
    if (!sesionCaja) return;
    setGenerandoReporteX(true);
    try {
      const response = await fetch(`/api/pos/caja/${sesionCaja.id}?action=reporte`);
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      const { sesion, movimientos, ventas, distribuidorNombre } = data.data;
      const html = generarReporteX({ sesion, movimientos, ventas, distribuidorNombre });
      abrirReporte(html, `Reporte X — ${sesion.folio}`);
    } catch (error) {
      console.error("Error generando Reporte X:", error);
      alert("Error al generar el reporte");
    } finally {
      setGenerandoReporteX(false);
    }
  };

  const handleCerrarTurnoRapido = async () => {
    if (!sesionCaja) return;
    const monto = parseFloat(montoFinalTurno);
    if (isNaN(monto) || monto < 0) {
      alert("Ingresa un monto final válido");
      return;
    }
    setCerrandoTurno(true);
    try {
      const response = await fetch(`/api/pos/caja/${sesionCaja.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cerrar", montoFinal: monto, notas: notasCierreTurno || undefined }),
      });
      const data = await response.json();
      if (data.success) {
        const sesionIdCerrada = sesionCaja.id;
        setSesionCaja(null);
        setShowCerrarTurnoModal(false);
        setMontoFinalTurno("");
        setNotasCierreTurno("");
        fetchEstadisticas();

        // Registrar salida de asistencia si el checkbox está activo y hay sesión activa
        if (registrarSalidaConCaja && asistenciaActiva === true) {
          try {
            await fetch("/api/asistencia/checkout", { method: "POST" });
            setAsistenciaActiva(false);
          } catch { /* silencioso — no bloquear si falla */ }
        }

        // FASE 31: Generar Reporte Z automáticamente al cerrar turno
        try {
          const rptResp = await fetch(`/api/pos/caja/${sesionIdCerrada}?action=reporte`);
          const rptData = await rptResp.json();
          if (rptData.success) {
            const { sesion, movimientos, ventas, distribuidorNombre } = rptData.data;
            const { generarReporteZ } = await import("@/lib/utils/reportes");
            const html = generarReporteZ({ sesion, movimientos, ventas, distribuidorNombre });
            abrirReporte(html, `Reporte Z — ${sesion.folio}`);
          }
        } catch (rptError) {
          console.error("Error generando Reporte Z:", rptError);
          // No bloquear el cierre si falla el reporte
        }
      } else {
        alert(data.error || "Error al cerrar turno");
      }
    } catch (error) {
      console.error("Error cerrando turno:", error);
      alert("Error al cerrar turno");
    } finally {
      setCerrandoTurno(false);
    }
  };

  const handleNuevaVenta = () => {
    setVentaCompletada(null);
    setCartItems([]);
    setDescuento(0);
    setPropina(0);
    setClienteSeleccionado(null);
    setBusquedaCliente("");
    setNotasVenta("");
    setResumenCliente(null);
  };

  // Feature 5: Cargar resumen del cliente cuando se selecciona
  const fetchResumenCliente = async (clienteId: string) => {
    try {
      const res = await fetch(`/api/clientes/${clienteId}/resumen-pos`);
      const data = await res.json();
      if (data.success) setResumenCliente(data.data);
    } catch { /* silencioso */ }
  };

  // FASE 30: Búsqueda de clientes con debounce
  const buscarClientes = async (q: string) => {
    if (q.trim().length < 2) { setResultadosCliente([]); return; }
    setBuscandoCliente(true);
    try {
      const res = await fetch(`/api/clientes?search=${encodeURIComponent(q)}&limit=6`);
      const data = await res.json();
      if (data.success) setResultadosCliente(data.data || []);
    } catch { /* silencioso */ } finally {
      setBuscandoCliente(false);
    }
  };

  // FASE 30: Al seleccionar producto, verificar si es equipo serializado con IMEI
  // I5 fix: se activa por esSerializado o por tipo equipo — independiente de si ya tiene IMEI
  const handleSelectProductoConImei = (producto: Producto) => {
    const esSerializado = producto.esSerializado === true ||
      producto.tipo === "equipo_nuevo" || producto.tipo === "equipo_usado";
    if (esSerializado) {
      setImeiProductoPendiente(producto);
      setImeiInput(producto.imei ?? "");
      setShowImeiModal(true);
    } else {
      handleSelectProduct(producto);
    }
  };

  // FASE 30: Confirmar IMEI y agregar al carrito
  const handleConfirmarImei = () => {
    if (!imeiProductoPendiente) return;
    const producto = imeiProductoPendiente;
    const imei = imeiInput.trim();
    // I5 fix: IMEI obligatorio para equipos serializados (mínimo 8 dígitos, máx 15)
    if (imei.length < 8) {
      alert("El IMEI es obligatorio para equipos serializados (mínimo 8 dígitos).");
      return;
    }

    const existingIndex = cartItems.findIndex(i => !i.esServicio && i.producto?.id === producto.id);
    if (existingIndex >= 0) {
      const newItems = [...cartItems];
      if (newItems[existingIndex].cantidad < producto.stock) {
        newItems[existingIndex].cantidad += 1;
        newItems[existingIndex].subtotal = newItems[existingIndex].cantidad * newItems[existingIndex].precioUnitario;
        newItems[existingIndex].imei = imei || newItems[existingIndex].imei;
        setCartItems(newItems);
      }
    } else {
      setCartItems([...cartItems, {
        producto,
        esServicio: false,
        cantidad: 1,
        precioUnitario: producto.precio,
        subtotal: producto.precio,
        imei: imei || undefined,
      }]);
    }
    setShowImeiModal(false);
    setImeiProductoPendiente(null);
    setImeiInput("");
  };

  const handleAbrirTurno = async () => {
    const monto = parseFloat(montoApertura);
    if (isNaN(monto) || monto < 0) {
      alert("Ingresa un monto inicial válido (puede ser 0)");
      return;
    }
    setAbriendoTurno(true);
    try {
      const response = await fetch("/api/pos/caja", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "abrir", montoInicial: monto, notas: notasApertura || undefined }),
      });
      const data = await response.json();
      if (data.success) {
        setSesionCaja(data.data);
        setShowAbrirTurnoModal(false);
        setMontoApertura("");
        setNotasApertura("");
        setCajaOtroEmpleado(null);
        fetchEstadisticas();

        // Registrar entrada de asistencia si el checkbox está activo y no hay sesión activa
        if (registrarEntradaConCaja && asistenciaActiva === false) {
          try {
            const asistRes = await fetch("/api/asistencia", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ notas: "Entrada registrada al abrir turno de caja" }),
            });
            if (asistRes.ok) setAsistenciaActiva(true);
          } catch { /* silencioso — no bloquear si falla */ }
        }
      } else {
        alert(data.error || "Error al abrir turno");
      }
    } catch (error) {
      console.error("Error abriendo turno:", error);
      alert("Error al abrir turno");
    } finally {
      setAbriendoTurno(false);
    }
  };

  if (!user || !["admin", "vendedor", "super_admin"].includes(user.role)) {
    return null;
  }

  const subtotal = cartItems.reduce((sum, item) => sum + item.subtotal, 0);
  const total = subtotal - descuento + propina;

  // Verificando sesión
  if (loadingSesion) {
    return (
      <div
        className="flex items-center justify-center min-h-screen"
        style={{ background: "var(--color-bg-base)" }}
      >
        <div className="flex flex-col items-center gap-3">
          {/* Skeleton animado */}
          <div
            className="w-10 h-10 rounded-full animate-pulse"
            style={{ background: "var(--color-bg-elevated)" }}
          />
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Verificando sesión de caja...
          </p>
        </div>
      </div>
    );
  }

  // Sin sesión activa → pantalla de apertura con modal integrado
  if (!sesionCaja) {
    return (
      <div
        className="flex items-center justify-center min-h-screen p-4"
        style={{ background: "var(--color-bg-base)" }}
      >
        {/* Card principal */}
        <div
          className="w-full max-w-sm rounded-2xl p-8 text-center"
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-subtle)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          {/* Ícono */}
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: "var(--color-accent-light)" }}
          >
            <DollarSign className="w-8 h-8" style={{ color: "var(--color-accent)" }} />
          </div>

          <h2
            className="text-xl font-bold tracking-tight mb-2"
            style={{ color: "var(--color-text-primary)" }}
          >
            No hay turno abierto
          </h2>
          <p
            className="text-sm mb-6"
            style={{ color: "var(--color-text-muted)" }}
          >
            Abre un turno de caja para comenzar a vender.
          </p>

          {/* Alerta si otro empleado tiene caja abierta */}
          {cajaOtroEmpleado && (
            <div
              className="rounded-xl p-3 mb-5 text-left"
              style={{
                background: "var(--color-warning-bg)",
                border: "1px solid var(--color-warning)",
              }}
            >
              <p className="text-xs font-semibold" style={{ color: "var(--color-warning-text)" }}>
                Caja ocupada
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-warning-text)" }}>
                {cajaOtroEmpleado.nombre} tiene una sesión activa ({cajaOtroEmpleado.folio}). Solo puede haber una a la vez.
              </p>
            </div>
          )}

          {/* Botón abrir turno */}
          <button
            onClick={() => setShowAbrirTurnoModal(true)}
            disabled={!!cajaOtroEmpleado}
            className="w-full py-3 rounded-xl font-semibold text-sm mb-3 transition-all"
            style={{
              background: cajaOtroEmpleado ? "var(--color-bg-elevated)" : "var(--color-primary)",
              color: cajaOtroEmpleado ? "var(--color-text-muted)" : "var(--color-primary-text)",
              cursor: cajaOtroEmpleado ? "not-allowed" : "pointer",
            }}
          >
            <DollarSign className="w-4 h-4 inline mr-2" />
            Abrir Turno
          </button>

          <button
            onClick={() => router.push("/dashboard/pos/historial")}
            className="w-full py-2.5 rounded-xl text-sm font-medium"
            style={{
              background: "var(--color-bg-elevated)",
              color: "var(--color-text-secondary)",
            }}
          >
            <Receipt className="w-4 h-4 inline mr-2" />
            Ver historial de ventas
          </button>
        </div>

        {/* Modal: Abrir Turno */}
        {showAbrirTurnoModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.5)" }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowAbrirTurnoModal(false); }}
          >
            <div
              className="w-full max-w-sm rounded-2xl p-6"
              style={{
                background: "var(--color-bg-surface)",
                boxShadow: "var(--shadow-xl)",
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>
                    Abrir Turno
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                    Registra el efectivo inicial en caja
                  </p>
                </div>
                <button
                  onClick={() => setShowAbrirTurnoModal(false)}
                  className="p-1 rounded-lg"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Monto inicial */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text-secondary)" }}>
                  Efectivo en caja al abrir
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={montoApertura}
                  onChange={(e) => setMontoApertura(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAbrirTurno();
                    if (e.key === "Escape") setShowAbrirTurnoModal(false);
                  }}
                  className="w-full px-3 py-2.5 rounded-lg text-lg font-mono"
                  style={{
                    background: "var(--color-bg-sunken)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text-primary)",
                    outline: "none",
                  }}
                />
              </div>

              {/* Notas opcionales */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text-secondary)" }}>
                  Notas (opcional)
                </label>
                <textarea
                  rows={2}
                  value={notasApertura}
                  onChange={(e) => setNotasApertura(e.target.value)}
                  placeholder="Observaciones de apertura..."
                  className="w-full px-3 py-2.5 rounded-lg text-sm resize-none"
                  style={{
                    background: "var(--color-bg-sunken)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text-primary)",
                    outline: "none",
                  }}
                />
              </div>

              {/* Asistencia integrada */}
              {asistenciaActiva === false && (
                <label
                  className="flex items-center gap-2.5 cursor-pointer mb-4 p-3 rounded-xl"
                  style={{ background: "var(--color-info-bg)", border: "1px solid var(--color-info)" }}
                >
                  <input
                    type="checkbox"
                    checked={registrarEntradaConCaja}
                    onChange={(e) => setRegistrarEntradaConCaja(e.target.checked)}
                    className="w-4 h-4 cursor-pointer shrink-0"
                  />
                  <div>
                    <p className="text-xs font-semibold" style={{ color: "var(--color-info-text)" }}>
                      Registrar entrada de asistencia
                    </p>
                    <p className="text-xs" style={{ color: "var(--color-info-text)", opacity: 0.8 }}>
                      No has checado entrada hoy
                    </p>
                  </div>
                </label>
              )}
              {asistenciaActiva === true && (
                <div
                  className="flex items-center gap-2 mb-4 p-3 rounded-xl"
                  style={{ background: "var(--color-success-bg)", border: "1px solid var(--color-success)" }}
                >
                  <UserCheck className="w-4 h-4 shrink-0" style={{ color: "var(--color-success)" }} />
                  <p className="text-xs" style={{ color: "var(--color-success-text)" }}>
                    Asistencia ya registrada para hoy
                  </p>
                </div>
              )}

              {/* Acciones */}
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setShowAbrirTurnoModal(false)}
                  className="flex-1"
                  disabled={abriendoTurno}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleAbrirTurno}
                  className="flex-1"
                  disabled={abriendoTurno}
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  {abriendoTurno ? "Abriendo..." : "Abrir Turno"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Banner offline — indica falta de internet o ventas pendientes */}
      <OfflineBanner onSyncComplete={() => fetchEstadisticas()} />

      {/* Alerta: caja abierta por otro empleado */}
      {cajaOtroEmpleado && alertaCajaVisible && (
        <div
          className="mb-4 p-4 rounded-lg flex items-start gap-3"
          style={{
            background: "var(--color-warning-bg)",
            border: "1px solid var(--color-warning)",
          }}
        >
          <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "var(--color-warning)" }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: "var(--color-warning-text)" }}>
              {cajaOtroEmpleado.nombre} tiene la caja abierta ({cajaOtroEmpleado.folio})
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-warning-text)" }}>
              Solo puede haber una sesión de caja activa a la vez. Para operar, solicita a {cajaOtroEmpleado.nombre} que cierre su turno.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="secondary"
              onClick={() => router.push("/dashboard/pos/caja")}
            >
              Ver Caja
            </Button>
            <button
              onClick={() => setAlertaCajaVisible(false)}
              className="text-xs px-2"
              style={{ color: "var(--color-text-muted)" }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1
              className="text-2xl sm:text-3xl font-bold tracking-tight"
              style={{ color: "var(--color-text-primary)" }}
            >
              Punto de Venta (POS)
            </h1>
            {sesionCaja && (
              <p className="text-sm mt-1" style={{ color: "var(--color-text-secondary)" }}>
                Sesión: <span style={{ fontFamily: "var(--font-mono)" }}>{sesionCaja.folio}</span>
                {" · "}Monto inicial:{" "}
                <span style={{ fontFamily: "var(--font-data)" }}>${sesionCaja.montoInicial.toFixed(2)}</span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Badge estado de caja */}
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{
                background: sesionCaja ? "var(--color-success-bg)" : "var(--color-bg-elevated)",
                border: `1px solid ${sesionCaja ? "var(--color-success)" : "var(--color-border)"}`,
              }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: sesionCaja ? "var(--color-success)" : "var(--color-text-muted)" }}
              />
              <span
                className="text-xs font-medium"
                style={{ color: sesionCaja ? "var(--color-success-text)" : "var(--color-text-muted)" }}
              >
                {sesionCaja ? `Caja abierta · ${sesionCaja.folio}` : "Sin turno activo"}
              </span>
            </div>

            {sesionCaja ? (
              <div className="flex gap-2">
                {/* FASE 31: Reporte X */}
                <Button
                  variant="secondary"
                  onClick={handleReporteX}
                  disabled={generandoReporteX}
                >
                  <FileText className="w-4 h-4 mr-1" />
                  {generandoReporteX ? "..." : "Rep. X"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setShowCerrarTurnoModal(true)}
                >
                  <CloseIcon className="w-4 h-4 mr-2" />
                  Cerrar Turno
                </Button>
              </div>
            ) : (
              <Button
                variant="secondary"
                onClick={() => setShowAbrirTurnoModal(true)}
              >
                <DollarSign className="w-4 h-4 mr-2" />
                Abrir Turno
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => router.push("/dashboard/pos/historial")}
            >
              <Receipt className="w-4 h-4 mr-2" />
              Historial
            </Button>
          </div>
        </div>

        {/* FASE 29: Toggle modo Standard / Visual */}
        <div className="flex items-center gap-2 mt-4">
          <ModeToggle
            active={posMode === "standard"}
            icon={<SearchIcon className="w-3.5 h-3.5" />}
            label="Standard"
            onClick={() => togglePosMode("standard")}
          />
          <ModeToggle
            active={posMode === "visual"}
            icon={<LayoutGrid className="w-3.5 h-3.5" />}
            label="Visual"
            onClick={() => togglePosMode("visual")}
          />
          {/* Barra de shortcuts — solo en modo standard */}
          {posMode === "standard" && (
            <div className="flex items-center gap-1.5 ml-3">
              {[
                { key: "F3", label: "Búsqueda" },
                { key: "F9/F10", label: "Pagar" },
                { key: "F12", label: "Pago Rápido" },
              ].map(({ key, label }) => (
                <span
                  key={key}
                  className="flex items-center gap-1 text-xs px-2 py-0.5 rounded"
                  style={{
                    background: "var(--color-bg-elevated)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  <kbd
                    className="font-mono text-xs font-semibold"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    {key}
                  </kbd>
                  <span>{label}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            <div
              className="rounded-xl p-4"
              style={{
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-border-subtle)",
                boxShadow: "var(--shadow-xs)",
              }}
            >
              <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>Ventas Hoy</p>
              <p className="text-2xl font-bold mt-1" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>
                {stats.ventasHoy}
              </p>
            </div>
            <div
              className="rounded-xl p-4"
              style={{
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-border-subtle)",
                boxShadow: "var(--shadow-xs)",
              }}
            >
              <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>Total Hoy</p>
              <p className="text-2xl font-bold mt-1" style={{ color: "var(--color-success)", fontFamily: "var(--font-data)" }}>
                ${stats.totalHoy.toFixed(2)}
              </p>
            </div>
            <div
              className="rounded-xl p-4"
              style={{
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-border-subtle)",
                boxShadow: "var(--shadow-xs)",
              }}
            >
              <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>Total Mes</p>
              <p className="text-2xl font-bold mt-1" style={{ color: "var(--color-accent)", fontFamily: "var(--font-data)" }}>
                ${stats.totalMes.toFixed(2)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column — Productos / Servicios */}
        <div className="space-y-4">

          {/* FASE 36: Pestañas Productos | Servicios */}
          <div
            className="flex rounded-xl p-1 gap-1"
            style={{
              background: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border-subtle)",
            }}
          >
            {[
              { id: "productos"    as const, icon: <LayoutGrid className="w-3.5 h-3.5" />, label: "Productos"   },
              { id: "servicios"    as const, icon: <Wrench     className="w-3.5 h-3.5" />, label: "Servicios"   },
              { id: "kits"         as const, icon: <Package2   className="w-3.5 h-3.5" />, label: "Kits"        },
              { id: "reparaciones" as const, icon: <FileText   className="w-3.5 h-3.5" />, label: "Cobrar Rep." },
            ].map(({ id, icon, label }) => (
              <button
                key={id}
                onClick={() => setPosSection(id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: posSection === id ? "var(--color-bg-surface)" : "transparent",
                  color: posSection === id ? "var(--color-accent)" : "var(--color-text-muted)",
                  boxShadow: posSection === id ? "var(--shadow-xs)" : "none",
                }}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>

          {posSection === "productos" ? (
            <>
              {posMode === "standard" ? (
                <>
                  <h2 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>
                    Buscar Producto
                  </h2>
                  <ProductSearchBar
                    onSelectProduct={handleSelectProductoConImei}
                    focusTrigger={searchFocusTrigger}
                    topProductIds={stats?.productosMasVendidos?.slice(0, 6).map((p) => p.productoId)}
                  />
                </>
              ) : (
                <>
                  <h2 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>
                    Productos por Categoría
                  </h2>
                  <ProductCategoryGrid onSelectProduct={handleSelectProductoConImei} />
                </>
              )}
            </>
          ) : posSection === "servicios" ? (
            /* FASE 36: Panel de Servicios */
            <ServiciosPOSPanel onAgregarServicio={handleAgregarServicio} />
          ) : posSection === "kits" ? (
            /* FASE 61: Panel de Kits y bundles */
            <KitsPOSPanel onAgregarKit={handleAgregarKit} />
          ) : (
            /* FASE 41: Panel de cobro de Reparaciones desde POS */
            <ReparacionesPOSPanel />
          )}

        </div>

        {/* Right Column - Cart & Payment (compact redesign) */}
        <div className="flex flex-col gap-3">

          {/* Carrito */}
          <ShoppingCart
            items={cartItems}
            descuento={descuento}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onClear={handleClearCart}
            onUpdatePrice={handleUpdatePrice}
            propina={propina}
            onPropinaChange={setPropina}
          />

          {/* ── Fila de extras: Descuento | Cliente | Notas ── */}
          {cartItems.length > 0 && (
            <div
              className="rounded-xl overflow-hidden"
              style={{
                border: "1px solid var(--color-border-subtle)",
                background: "var(--color-bg-surface)",
              }}
            >
              {/* Botones de toggle — siempre visibles */}
              <div className="flex divide-x" style={{ borderBottom: extrasPanel ? "1px solid var(--color-border-subtle)" : "none" }}>
                {/* Descuento */}
                <button
                  onClick={() => toggleExtras("descuento")}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors"
                  style={{
                    background: extrasPanel === "descuento" ? "var(--color-accent-light)" : "transparent",
                    color: extrasPanel === "descuento"
                      ? "var(--color-accent)"
                      : descuento > 0
                      ? "var(--color-warning)"
                      : "var(--color-text-secondary)",
                    borderRight: "1px solid var(--color-border-subtle)",
                  }}
                >
                  <Tag className="w-3.5 h-3.5" />
                  {descuento > 0 ? `-$${descuento.toFixed(0)}` : "Descuento"}
                </button>

                {/* Cliente */}
                <button
                  onClick={() => toggleExtras("cliente")}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors"
                  style={{
                    background: extrasPanel === "cliente" ? "var(--color-accent-light)" : "transparent",
                    color: extrasPanel === "cliente"
                      ? "var(--color-accent)"
                      : clienteSeleccionado
                      ? "var(--color-success)"
                      : "var(--color-text-secondary)",
                    borderRight: "1px solid var(--color-border-subtle)",
                  }}
                >
                  <User className="w-3.5 h-3.5" />
                  {clienteSeleccionado
                    ? clienteSeleccionado.nombre.split(" ")[0]
                    : "Cliente"}
                </button>

                {/* Notas */}
                <button
                  onClick={() => toggleExtras("notas")}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors"
                  style={{
                    background: extrasPanel === "notas" ? "var(--color-accent-light)" : "transparent",
                    color: extrasPanel === "notas"
                      ? "var(--color-accent)"
                      : notasVenta
                      ? "var(--color-info)"
                      : "var(--color-text-secondary)",
                  }}
                >
                  <FileText className="w-3.5 h-3.5" />
                  {notasVenta ? "Con nota" : "Notas"}
                </button>
              </div>

              {/* Panel expandible — Descuento */}
              {extrasPanel === "descuento" && (
                <div className="p-3">
                  <DescuentoPOS
                    subtotal={subtotal}
                    empleadoNombre={user?.name ?? user?.email ?? ""}
                    contextoItems={cartItems.map((item) => ({
                      nombre: item.esServicio
                        ? (item.servicioNombre ?? "Servicio")
                        : (item.producto?.nombre ?? "Producto"),
                      cantidad: item.cantidad,
                      precio: item.precioUnitario,
                    }))}
                    onChange={(d) => setDescuento(d)}
                  />
                </div>
              )}

              {/* Panel expandible — Cliente */}
              {extrasPanel === "cliente" && (
                <div className="p-3">
                  {clienteSeleccionado ? (
                    <div className="space-y-2">
                      {/* Tag del cliente */}
                      <div
                        className="flex items-center justify-between px-3 py-2 rounded-lg"
                        style={{ background: "var(--color-accent-light)", border: "1px solid var(--color-accent)" }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <User className="w-4 h-4 shrink-0" style={{ color: "var(--color-accent)" }} />
                          <span className="text-sm font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
                            {clienteSeleccionado.nombre} {clienteSeleccionado.apellido ?? ""}
                          </span>
                          <span className="text-xs shrink-0" style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
                            {clienteSeleccionado.telefono}
                          </span>
                        </div>
                        <button
                          onClick={() => { setClienteSeleccionado(null); setBusquedaCliente(""); setResumenCliente(null); }}
                          className="p-0.5 rounded ml-2 shrink-0"
                          style={{ color: "var(--color-text-muted)" }}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Feature 5: Resumen de créditos */}
                      {resumenCliente && (
                        <div
                          className="rounded-lg px-3 py-2 grid grid-cols-2 gap-x-4 gap-y-1"
                          style={{
                            background: "var(--color-bg-elevated)",
                            border: "1px solid var(--color-border-subtle)",
                          }}
                        >
                          <div>
                            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Créditos activos</p>
                            <p className="text-sm font-semibold" style={{
                              color: resumenCliente.creditosActivos > 0 ? "var(--color-warning)" : "var(--color-success)",
                              fontFamily: "var(--font-data)",
                            }}>
                              {resumenCliente.creditosActivos}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Deuda total</p>
                            <p className="text-sm font-semibold" style={{
                              color: resumenCliente.deudaTotal > 0 ? "var(--color-danger)" : "var(--color-success)",
                              fontFamily: "var(--font-data)",
                            }}>
                              ${resumenCliente.deudaTotal.toFixed(0)}
                            </p>
                          </div>
                          {resumenCliente.ultimaVentaMonto !== null && (
                            <div className="col-span-2">
                              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                                Última compra: <span style={{ fontFamily: "var(--font-data)", color: "var(--color-text-secondary)" }}>
                                  ${resumenCliente.ultimaVentaMonto.toFixed(0)}
                                </span>
                                {resumenCliente.ultimaVentaFecha && (
                                  <span className="ml-1" style={{ color: "var(--color-text-muted)" }}>
                                    · {new Date(resumenCliente.ultimaVentaFecha).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}
                                  </span>
                                )}
                              </p>
                            </div>
                          )}
                          {resumenCliente.scoreCategoria && (
                            <div className="col-span-2">
                              <span
                                className="inline-flex items-center text-xs px-1.5 py-0.5 rounded-full font-medium"
                                style={{
                                  background: resumenCliente.scoreCategoria === "excelente" ? "var(--color-success-bg)" :
                                    resumenCliente.scoreCategoria === "bueno" ? "var(--color-info-bg)" :
                                    resumenCliente.scoreCategoria === "regular" ? "var(--color-warning-bg)" :
                                    "var(--color-danger-bg)",
                                  color: resumenCliente.scoreCategoria === "excelente" ? "var(--color-success-text)" :
                                    resumenCliente.scoreCategoria === "bueno" ? "var(--color-info-text)" :
                                    resumenCliente.scoreCategoria === "regular" ? "var(--color-warning-text)" :
                                    "var(--color-danger-text)",
                                }}
                              >
                                Score: {resumenCliente.scoreCategoria}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Nombre o teléfono del cliente..."
                        value={busquedaCliente}
                        autoFocus
                        onChange={(e) => {
                          setBusquedaCliente(e.target.value);
                          setShowClienteDropdown(true);
                          buscarClientes(e.target.value);
                        }}
                        onFocus={() => { if (busquedaCliente.length >= 2) setShowClienteDropdown(true); }}
                        onBlur={() => setTimeout(() => setShowClienteDropdown(false), 150)}
                        className="w-full px-3 py-2 rounded-lg text-sm pl-9"
                        style={{
                          background: "var(--color-bg-sunken)",
                          border: "1px solid var(--color-border)",
                          color: "var(--color-text-primary)",
                          outline: "none",
                        }}
                      />
                      <User className="w-4 h-4 absolute left-2.5 top-2.5" style={{ color: "var(--color-text-muted)" }} />
                      {showClienteDropdown && (buscandoCliente || resultadosCliente.length > 0) && (
                        <div
                          className="absolute z-20 w-full mt-1 rounded-xl overflow-hidden"
                          style={{
                            background: "var(--color-bg-surface)",
                            border: "1px solid var(--color-border)",
                            boxShadow: "var(--shadow-md)",
                          }}
                        >
                          {buscandoCliente && (
                            <div className="px-3 py-2 text-xs" style={{ color: "var(--color-text-muted)" }}>Buscando...</div>
                          )}
                          {resultadosCliente.map((c) => (
                            <button
                              key={c.id}
                              onMouseDown={() => {
                                setClienteSeleccionado(c);
                                setBusquedaCliente("");
                                setShowClienteDropdown(false);
                                setExtrasPanel(null);
                                setResumenCliente(null);
                                fetchResumenCliente(c.id);
                              }}
                              className="w-full px-3 py-2.5 text-left text-sm hover:opacity-80 flex items-center gap-2"
                              style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
                            >
                              <User className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--color-text-muted)" }} />
                              <span style={{ color: "var(--color-text-primary)" }}>
                                {c.nombre} {c.apellido ?? ""}
                              </span>
                              <span className="ml-auto text-xs" style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
                                {c.telefono}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Panel expandible — Notas */}
              {extrasPanel === "notas" && (
                <div className="p-3">
                  <textarea
                    rows={2}
                    value={notasVenta}
                    autoFocus
                    onChange={(e) => setNotasVenta(e.target.value)}
                    placeholder="Observaciones, acuerdos, instrucciones especiales..."
                    className="w-full px-3 py-2 rounded-lg text-sm resize-none"
                    style={{
                      background: "var(--color-bg-sunken)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text-primary)",
                      outline: "none",
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Método de pago + botón completar */}
          {cartItems.length > 0 && (
            <div className="space-y-3">
              <PaymentMethodSelector total={total} onChange={setPaymentData} />

              {/* Botón Completar Venta — id para F9 */}
              <Button
                id="btn-completar-venta"
                onClick={handleCompletarVenta}
                disabled={processingVenta || cartItems.length === 0 || !paymentData?.isValid}
                className="w-full"
                size="lg"
              >
                <CartIcon className="w-5 h-5 mr-2" />
                {processingVenta ? "Procesando..." : `Completar Venta — $${total.toFixed(2)}`}
              </Button>

              {/* Botón oculto F12 pago rápido */}
              <button
                id="btn-pago-rapido-f12"
                onClick={handlePagoRapido}
                className="hidden"
                tabIndex={-1}
                aria-hidden
              />
            </div>
          )}
        </div>
      </div>

      {/* Recibo Modal */}
      {ventaCompletada && (
        <ReciboModal
          venta={ventaCompletada}
          isOpen={showReciboModal}
          onClose={() => setShowReciboModal(false)}
          onNuevaVenta={handleNuevaVenta}
          clienteTelefono={clienteSeleccionado?.telefono ?? undefined}
        />
      )}

      {/* Modal: Cobro Rápido Efectivo (F9) */}
      {showCobroModal && cartItems.length > 0 && (() => {
        const subtotal = cartItems.reduce((sum, item) => sum + item.subtotal, 0);
        const total = subtotal - descuento;
        const montoIngresado = cobroMonto.trim() === "" ? total : parseFloat(cobroMonto) || 0;
        const cambio = Math.max(0, montoIngresado - total);
        const montoInsuficiente = cobroMonto.trim() !== "" && montoIngresado < total;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.55)" }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowCobroModal(false); }}
          >
            <div
              className="w-full max-w-sm rounded-2xl p-6"
              style={{ background: "var(--color-bg-surface)", boxShadow: "var(--shadow-xl)" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  Cobro en Efectivo
                </h2>
                <button
                  onClick={() => setShowCobroModal(false)}
                  className="p-1 rounded-lg"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Total */}
              <div
                className="rounded-xl p-4 mb-4 text-center"
                style={{ background: "var(--color-bg-elevated)" }}
              >
                <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: "var(--color-text-muted)" }}>
                  Total a cobrar
                </p>
                <p className="text-4xl font-bold" style={{ color: "var(--color-accent)", fontFamily: "var(--font-data)" }}>
                  ${total.toFixed(2)}
                </p>
              </div>

              {/* Input monto recibido */}
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>
                ¿Cuánto paga el cliente? <span style={{ color: "var(--color-text-muted)" }}>(vacío = exacto)</span>
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder={`$${total.toFixed(2)}`}
                value={cobroMonto}
                onChange={(e) => setCobroMonto(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !montoInsuficiente) handleCobroModal();
                  if (e.key === "Escape") setShowCobroModal(false);
                }}
                className="w-full px-4 py-3 rounded-xl text-2xl font-mono mb-3"
                style={{
                  background: "var(--color-bg-sunken)",
                  border: `2px solid ${montoInsuficiente ? "var(--color-danger)" : "var(--color-border)"}`,
                  color: "var(--color-text-primary)",
                  outline: "none",
                }}
              />

              {/* Cambio o error */}
              {montoInsuficiente ? (
                <p className="text-sm text-center mb-3" style={{ color: "var(--color-danger)" }}>
                  Monto insuficiente — faltan ${(total - montoIngresado).toFixed(2)}
                </p>
              ) : cambio > 0 ? (
                <div
                  className="rounded-xl px-4 py-2.5 mb-3 flex items-center justify-between"
                  style={{ background: "var(--color-success-bg)" }}
                >
                  <span className="text-sm font-medium" style={{ color: "var(--color-success-text)" }}>Cambio</span>
                  <span className="text-xl font-bold" style={{ color: "var(--color-success)", fontFamily: "var(--font-data)" }}>
                    ${cambio.toFixed(2)}
                  </span>
                </div>
              ) : (
                <p className="text-sm text-center mb-3" style={{ color: "var(--color-text-muted)" }}>
                  Pago exacto — presiona Enter para cobrar
                </p>
              )}

              {/* Botón cobrar */}
              <button
                onClick={handleCobroModal}
                disabled={processingVenta || montoInsuficiente}
                className="w-full py-3 rounded-xl text-base font-semibold transition-all"
                style={{
                  background: processingVenta || montoInsuficiente ? "var(--color-bg-elevated)" : "var(--color-accent)",
                  color: processingVenta || montoInsuficiente ? "var(--color-text-muted)" : "#fff",
                  cursor: processingVenta || montoInsuficiente ? "not-allowed" : "pointer",
                }}
              >
                {processingVenta ? "Procesando..." : cambio > 0 ? `Cobrar — dar $${cambio.toFixed(2)} de cambio` : "Cobrar"}
              </button>
            </div>
          </div>
        );
      })()}

      {/* Modal: Captura IMEI (FASE 30) */}
      {showImeiModal && imeiProductoPendiente && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowImeiModal(false); setImeiProductoPendiente(null); } }}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6"
            style={{ background: "var(--color-bg-surface)", boxShadow: "var(--shadow-xl)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  Confirmar IMEI
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                  {imeiProductoPendiente.marca} {imeiProductoPendiente.modelo}
                </p>
              </div>
              <button
                onClick={() => { setShowImeiModal(false); setImeiProductoPendiente(null); }}
                style={{ color: "var(--color-text-muted)" }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div
              className="rounded-xl p-3 mb-4 flex items-center gap-2"
              style={{ background: "var(--color-info-bg)", border: "1px solid var(--color-info)" }}
            >
              <ScanLine className="w-4 h-4 shrink-0" style={{ color: "var(--color-info)" }} />
              <p className="text-xs" style={{ color: "var(--color-info-text)" }}>
                Equipo serializado. Verifica o edita el IMEI antes de vender.
              </p>
            </div>

            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text-secondary)" }}>
              IMEI
            </label>
            <input
              type="text"
              maxLength={15}
              value={imeiInput}
              onChange={(e) => setImeiInput(e.target.value.replace(/\D/g, ""))}
              placeholder="15 dígitos"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirmarImei();
                if (e.key === "Escape") { setShowImeiModal(false); setImeiProductoPendiente(null); }
              }}
              className="w-full px-3 py-2.5 rounded-lg text-lg mb-5"
              style={{
                background: "var(--color-bg-sunken)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-primary)",
                fontFamily: "var(--font-mono)",
                outline: "none",
                letterSpacing: "0.1em",
              }}
            />

            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => { setShowImeiModal(false); setImeiProductoPendiente(null); }}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button onClick={handleConfirmarImei} className="flex-1">
                <ScanLine className="w-4 h-4 mr-2" />
                Agregar al carrito
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Abrir Turno (FASE 28) */}
      {showAbrirTurnoModal && !sesionCaja && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAbrirTurnoModal(false); }}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6"
            style={{
              background: "var(--color-bg-surface)",
              boxShadow: "var(--shadow-xl)",
            }}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  Abrir Turno
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                  Registra el efectivo inicial en caja
                </p>
              </div>
              <button
                onClick={() => setShowAbrirTurnoModal(false)}
                className="p-1 rounded-lg"
                style={{ color: "var(--color-text-muted)" }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text-secondary)" }}>
                Efectivo en caja al abrir
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={montoApertura}
                onChange={(e) => setMontoApertura(e.target.value)}
                placeholder="0.00"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAbrirTurno();
                  if (e.key === "Escape") setShowAbrirTurnoModal(false);
                }}
                className="w-full px-3 py-2.5 rounded-lg text-lg font-mono"
                style={{
                  background: "var(--color-bg-sunken)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-primary)",
                  outline: "none",
                }}
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text-secondary)" }}>
                Notas (opcional)
              </label>
              <textarea
                rows={2}
                value={notasApertura}
                onChange={(e) => setNotasApertura(e.target.value)}
                placeholder="Observaciones de apertura..."
                className="w-full px-3 py-2.5 rounded-lg text-sm resize-none"
                style={{
                  background: "var(--color-bg-sunken)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-primary)",
                  outline: "none",
                }}
              />
            </div>

            {/* Asistencia integrada */}
            {asistenciaActiva === false && (
              <label
                className="flex items-center gap-2.5 cursor-pointer mb-4 p-3 rounded-xl"
                style={{ background: "var(--color-info-bg)", border: "1px solid var(--color-info)" }}
              >
                <input
                  type="checkbox"
                  checked={registrarEntradaConCaja}
                  onChange={(e) => setRegistrarEntradaConCaja(e.target.checked)}
                  className="w-4 h-4 cursor-pointer shrink-0"
                />
                <div>
                  <p className="text-xs font-semibold" style={{ color: "var(--color-info-text)" }}>
                    Registrar entrada de asistencia
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-info-text)", opacity: 0.8 }}>
                    No has checado entrada hoy
                  </p>
                </div>
              </label>
            )}
            {asistenciaActiva === true && (
              <div
                className="flex items-center gap-2 mb-4 p-3 rounded-xl"
                style={{ background: "var(--color-success-bg)", border: "1px solid var(--color-success)" }}
              >
                <UserCheck className="w-4 h-4 shrink-0" style={{ color: "var(--color-success)" }} />
                <p className="text-xs" style={{ color: "var(--color-success-text)" }}>
                  Asistencia ya registrada para hoy
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => setShowAbrirTurnoModal(false)}
                className="flex-1"
                disabled={abriendoTurno}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleAbrirTurno}
                className="flex-1"
                disabled={abriendoTurno}
              >
                <DollarSign className="w-4 h-4 mr-2" />
                {abriendoTurno ? "Abriendo..." : "Abrir Turno"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Cerrar Turno Rápido (FASE 28) */}
      {showCerrarTurnoModal && sesionCaja && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6"
            style={{
              background: "var(--color-bg-surface)",
              boxShadow: "var(--shadow-xl)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  Cerrar Turno
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
                  {sesionCaja.folio}
                </p>
              </div>
              <button
                onClick={() => setShowCerrarTurnoModal(false)}
                className="p-1 rounded-lg"
                style={{ color: "var(--color-text-muted)" }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Resumen del turno */}
            <div
              className="rounded-xl p-4 mb-5 grid grid-cols-3 gap-3 text-center"
              style={{ background: "var(--color-bg-elevated)" }}
            >
              <div>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Ventas</p>
                <p className="text-xl font-bold mt-0.5" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>
                  {sesionCaja.numeroVentas}
                </p>
              </div>
              <div>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Efectivo</p>
                <p className="text-lg font-bold mt-0.5" style={{ color: "var(--color-success)", fontFamily: "var(--font-data)" }}>
                  ${sesionCaja.totalVentasEfectivo.toFixed(0)}
                </p>
              </div>
              <div>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Otros</p>
                <p className="text-lg font-bold mt-0.5" style={{ color: "var(--color-accent)", fontFamily: "var(--font-data)" }}>
                  ${(sesionCaja.totalVentasTransferencia + sesionCaja.totalVentasTarjeta).toFixed(0)}
                </p>
              </div>
            </div>

            {/* Monto final */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text-secondary)" }}>
                Dinero en caja al cierre
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={montoFinalTurno}
                onChange={(e) => setMontoFinalTurno(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2.5 rounded-lg text-lg font-mono"
                style={{
                  background: "var(--color-bg-sunken)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-primary)",
                  outline: "none",
                }}
                autoFocus
              />
            </div>

            {/* Notas opcionales */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text-secondary)" }}>
                Notas (opcional)
              </label>
              <textarea
                rows={2}
                value={notasCierreTurno}
                onChange={(e) => setNotasCierreTurno(e.target.value)}
                placeholder="Observaciones del turno..."
                className="w-full px-3 py-2.5 rounded-lg text-sm resize-none"
                style={{
                  background: "var(--color-bg-sunken)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-primary)",
                  outline: "none",
                }}
              />
            </div>

            {/* Asistencia integrada: salida */}
            {asistenciaActiva === true && (
              <label
                className="flex items-center gap-2.5 cursor-pointer mb-4 p-3 rounded-xl"
                style={{ background: "var(--color-warning-bg)", border: "1px solid var(--color-warning)" }}
              >
                <input
                  type="checkbox"
                  checked={registrarSalidaConCaja}
                  onChange={(e) => setRegistrarSalidaConCaja(e.target.checked)}
                  className="w-4 h-4 cursor-pointer shrink-0"
                />
                <div>
                  <p className="text-xs font-semibold" style={{ color: "var(--color-warning-text)" }}>
                    Registrar salida de asistencia
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-warning-text)", opacity: 0.8 }}>
                    Tienes una sesión de asistencia activa
                  </p>
                </div>
              </label>
            )}

            {/* Acciones */}
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => setShowCerrarTurnoModal(false)}
                className="flex-1"
                disabled={cerrandoTurno}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCerrarTurnoRapido}
                className="flex-1"
                disabled={cerrandoTurno || !montoFinalTurno}
              >
                <CloseIcon className="w-4 h-4 mr-2" />
                {cerrandoTurno ? "Cerrando..." : "Cerrar Turno"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── ModeToggle — sub-componente local ───────────────── */
function ModeToggle({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
      style={{
        background: active
          ? "var(--color-primary)"
          : hover
          ? "var(--color-bg-elevated)"
          : "var(--color-bg-surface)",
        color: active ? "var(--color-primary-text)" : "var(--color-text-secondary)",
        border: active
          ? "1px solid var(--color-primary)"
          : "1px solid var(--color-border-subtle)",
      }}
    >
      {icon}
      {label}
    </button>
  );
}
