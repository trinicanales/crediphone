"use client";

import Link from "next/link";

// href siempre "#"; window.open() navega al wa.me solo en el cliente.
// Así ninguna extensión del navegador puede modificar el href en el HTML
// del servidor y provocar hydration mismatch en React 19.
const WA_NUMERO = process.env.NEXT_PUBLIC_WHATSAPP_SOPORTE || "526181245391";

function abrirWhatsApp() {
  window.open(`https://wa.me/${WA_NUMERO}`, "_blank", "noopener,noreferrer");
}

export function Footer() {

  return (
    <footer className="bg-gray-900 dark:bg-gray-950 text-white border-t border-gray-800 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <h3 className="text-xl font-bold text-blue-400 mb-2">CREDIPHONE</h3>
            <p className="text-gray-400 text-sm">
              Venta de celulares a credito, accesorios y servicio de reparacion profesional.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold text-gray-200 mb-3">Enlaces</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/catalogo" className="text-gray-400 hover:text-blue-400 transition-colors">
                  Catalogo de Productos
                </Link>
              </li>
              <li>
                {/* href solo se establece después del mount para evitar que extensiones
                    de Chrome modifiquen el wa.me URL en el HTML del servidor */}
                <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); abrirWhatsApp(); }}
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-green-400 transition-colors"
                >
                  Contacto por WhatsApp
                </a>
              </li>
              <li>
                <Link href="/dashboard" className="text-gray-400 hover:text-blue-400 transition-colors">
                  Panel Administrativo
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold text-gray-200 mb-3">Contacto</h4>
            <p className="text-gray-400 text-sm">
              Escribenos por WhatsApp para cotizaciones, pedidos o agendar una reparacion.
            </p>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-6 text-center">
          {/* getFullYear() también es client-only para evitar mismatch en año nuevo */}
          <p className="text-gray-500 text-xs" suppressHydrationWarning>
            &copy; {new Date().getFullYear()} CREDIPHONE. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
