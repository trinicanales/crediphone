"use client";

import { useState } from "react";
import { useCarritoStore } from "@/store/carritoStore";
import { Button } from "@/components/ui/Button";
import { obtenerUrlImagen } from "@/lib/storage";

export function CarritoFlotante() {
  const [isOpen, setIsOpen] = useState(false);
  const { productos, quitarProducto, actualizarCantidad, obtenerTotal, obtenerCantidadTotal, limpiarCarrito } =
    useCarritoStore();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(price);
  };

  const generarMensajeWhatsApp = () => {
    const mensaje = `*Nuevo Pedido - CREDIPHONE*\n\n` +
      `*Productos:*\n` +
      productos.map((p, i) =>
        `${i + 1}. ${p.nombre}\n` +
        `   Marca: ${p.marca}\n` +
        `   Modelo: ${p.modelo}\n` +
        `   Cantidad: ${p.cantidad}\n` +
        `   Precio: ${formatPrice(Number(p.precio))}\n` +
        `   Subtotal: ${formatPrice(Number(p.precio) * p.cantidad)}\n`
      ).join('\n') +
      `\n*Total: ${formatPrice(obtenerTotal())}*\n\n` +
      `Pueden ayudarme con este pedido?`;

    return encodeURIComponent(mensaje);
  };

  const handleCheckoutWhatsApp = () => {
    const numeroWhatsApp = process.env.NEXT_PUBLIC_WHATSAPP_SOPORTE || "526181245391";
    const mensaje = generarMensajeWhatsApp();
    const url = `https://wa.me/${numeroWhatsApp}?text=${mensaje}`;
    window.open(url, "_blank");
  };

  const cantidadTotal = obtenerCantidadTotal();

  return (
    <>
      {/* Boton flotante del carrito */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 bg-green-600 hover:bg-green-700 text-white rounded-full p-4 shadow-lg transition-all duration-300 flex items-center gap-2"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        {cantidadTotal > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">
            {cantidadTotal}
          </span>
        )}
      </button>

      {/* Panel lateral del carrito */}
      <div
        className={`fixed top-0 right-0 h-full w-full md:w-96 bg-white dark:bg-gray-900 shadow-2xl z-50 transform transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Mi Carrito ({cantidadTotal})
            </h2>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Productos */}
          <div className="flex-1 overflow-y-auto p-4">
            {productos.length === 0 ? (
              <div className="text-center py-12">
                <svg
                  className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                  />
                </svg>
                <p className="text-gray-500 dark:text-gray-400">Tu carrito esta vacio</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                  Agrega productos del catalogo
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {productos.map((producto) => (
                  <div
                    key={producto.id}
                    className="flex gap-3 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    {/* Imagen */}
                    {producto.imagen ? (
                      <img
                        src={obtenerUrlImagen(producto.imagen) || ""}
                        alt={producto.nombre}
                        className="w-20 h-20 object-cover rounded border border-gray-300 dark:border-gray-600"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}

                    {/* Detalles */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 dark:text-white text-sm truncate">
                        {producto.nombre}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {producto.marca} - {producto.modelo}
                      </p>
                      <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 mt-1">
                        {formatPrice(Number(producto.precio))}
                      </p>

                      {/* Controles de cantidad */}
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() =>
                            actualizarCantidad(producto.id, producto.cantidad - 1)
                          }
                          className="w-7 h-7 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 flex items-center justify-center text-sm"
                        >
                          -
                        </button>
                        <span className="text-sm font-medium w-8 text-center text-gray-900 dark:text-white">
                          {producto.cantidad}
                        </span>
                        <button
                          onClick={() =>
                            actualizarCantidad(producto.id, producto.cantidad + 1)
                          }
                          className="w-7 h-7 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 flex items-center justify-center text-sm"
                        >
                          +
                        </button>
                        <button
                          onClick={() => quitarProducto(producto.id)}
                          className="ml-auto text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer con total y botones */}
          {productos.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4 space-y-3">
              {/* Total */}
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-gray-900 dark:text-white">Total:</span>
                <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {formatPrice(obtenerTotal())}
                </span>
              </div>

              {/* Boton de WhatsApp */}
              <Button
                onClick={handleCheckoutWhatsApp}
                className="w-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                </svg>
                Hacer Pedido por WhatsApp
              </Button>

              {/* Boton limpiar carrito */}
              <button
                onClick={limpiarCarrito}
                className="w-full text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 py-2"
              >
                Vaciar carrito
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Overlay */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/50 z-40"
        />
      )}
    </>
  );
}
