import Link from "next/link";

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
                <a
                  href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_SOPORTE || "526181245391"}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-green-400 transition-colors"
                  suppressHydrationWarning
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
          <p className="text-gray-500 text-xs" suppressHydrationWarning>
            &copy; {new Date().getFullYear()} CREDIPHONE. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
