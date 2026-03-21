"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Header from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { obtenerUrlImagen } from "@/lib/storage";
import { CreditCard, Wrench, Smartphone } from "lucide-react";
import type { Producto } from "@/types";

// Número de WhatsApp — se usa solo en el cliente para evitar
// que extensiones del navegador modifiquen el href antes de que React hidrate
const WA_NUMERO = process.env.NEXT_PUBLIC_WHATSAPP_SOPORTE ?? "526181245391";

export default function Home() {
  const [productos, setProductos] = useState<Producto[]>([]);
  // mounted controla que los links wa.me NO se rendericen en el servidor.
  // Esto evita la hydration mismatch causada por extensiones de Chrome que
  // reemplazan URLs wa.me en el DOM antes de que React cargue.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function fetchProductos() {
      try {
        // Endpoint público — sin autenticación requerida para visitantes
        const response = await fetch("/api/public/productos?limit=4");
        const data = await response.json();
        if (data.success) {
          setProductos((data.data as Producto[]).slice(0, 4));
        }
      } catch (error) {
        console.error("Error cargando productos:", error);
      }
    }
    fetchProductos();
  }, []);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Header />

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-blue-600 to-blue-800 dark:from-blue-800 dark:to-blue-950 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-300 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6">
              Tu celular ideal,{" "}
              <span className="text-blue-200">a tu alcance</span>
            </h1>
            <p className="text-lg sm:text-xl text-blue-100 max-w-2xl mx-auto mb-10">
              Venta de celulares a credito, accesorios originales y servicio de
              reparacion profesional. Financiamiento accesible para todos.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/catalogo"
                className="inline-flex items-center justify-center px-8 py-3.5 bg-white text-blue-700 font-semibold rounded-lg hover:bg-blue-50 transition-colors shadow-lg"
              >
                Ver Catalogo
              </Link>
              <a
                href={mounted ? `https://wa.me/${WA_NUMERO}` : "#"}
                target={mounted ? "_blank" : undefined}
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors shadow-lg"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                </svg>
                Contactar por WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Servicios */}
      <section className="py-16 sm:py-20 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
              Nuestros Servicios
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-3 max-w-xl mx-auto">
              Todo lo que necesitas para tu celular en un solo lugar
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-sm border border-gray-200 dark:border-gray-700 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl mb-5">
                <CreditCard className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Venta a Credito
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Llevate tu celular hoy con planes de financiamiento flexibles.
                Pagos semanales o quincenales accesibles.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-sm border border-gray-200 dark:border-gray-700 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-xl mb-5">
                <Wrench className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Reparacion Profesional
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Reparamos pantallas, baterias, puertos de carga y mas.
                Diagnostico gratuito y garantia en todas las reparaciones.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-sm border border-gray-200 dark:border-gray-700 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl mb-5">
                <Smartphone className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Accesorios y Mas
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Fundas, micas, cargadores, audifonos y todo tipo de accesorios
                para proteger y complementar tu equipo.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Productos Destacados */}
      {productos.length > 0 && (
        <section className="py-16 sm:py-20 bg-white dark:bg-gray-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                Productos Destacados
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mt-3">
                Los equipos mas populares disponibles ahora
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {productos.map((producto) => (
                <div
                  key={producto.id}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-shadow"
                >
                  <div className="h-48 bg-gray-100 dark:bg-gray-700">
                    {producto.imagen ? (
                      <img
                        src={obtenerUrlImagen(producto.imagen) || ""}
                        alt={producto.nombre}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Smartphone className="w-12 h-12 text-gray-300 dark:text-gray-500" />
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm line-clamp-1">
                      {producto.nombre}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {producto.marca} - {producto.modelo}
                    </p>
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-2">
                      {formatPrice(Number(producto.precio))}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center mt-10">
              <Link
                href="/catalogo"
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Ver todo el catalogo
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* CTA Contacto */}
      <section className="py-16 sm:py-20 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Listo para estrenar?
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8 text-lg">
            Contactanos por WhatsApp para cotizaciones, pedidos o agendar una
            reparacion. Respuesta inmediata.
          </p>
          <a
            href={mounted ? `https://wa.me/${WA_NUMERO}` : "#"}
            target={mounted ? "_blank" : undefined}
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-4 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors shadow-lg text-lg"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
            </svg>
            Escribenos por WhatsApp
          </a>
        </div>
      </section>

      <Footer />
    </div>
  );
}
