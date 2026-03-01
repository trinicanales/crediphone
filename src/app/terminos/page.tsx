import type { Metadata } from "next";
import { Shield, Clock, Wrench, AlertTriangle, Lock, Phone, FileText, CheckCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Términos y Condiciones — CREDIPHONE",
  description:
    "Términos y condiciones del servicio de reparación de CREDIPHONE. Política de garantía, privacidad y condiciones de servicio conforme a la LFPC y NOM-024-SCFI-2013.",
};

/* ── Componentes de estructura ───────────────────────────────────────────── */

function SeccionCard({
  icono,
  titulo,
  children,
}: {
  icono: React.ReactNode;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-border-subtle)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div
        className="flex items-center gap-3 px-6 py-4"
        style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
      >
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "var(--color-accent-light)" }}
        >
          <span style={{ color: "var(--color-accent)" }}>{icono}</span>
        </div>
        <h2
          className="text-base font-bold"
          style={{ color: "var(--color-text-primary)" }}
        >
          {titulo}
        </h2>
      </div>
      <div className="px-6 py-5 space-y-3">{children}</div>
    </div>
  );
}

function Item({
  numero,
  texto,
  resaltado = false,
}: {
  numero: number;
  texto: string;
  resaltado?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <span
        className="text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
        style={{
          background: resaltado
            ? "var(--color-accent-light)"
            : "var(--color-bg-elevated)",
          color: resaltado
            ? "var(--color-accent)"
            : "var(--color-text-muted)",
          fontFamily: "var(--font-mono)",
        }}
      >
        {numero}
      </span>
      <p
        className="text-sm leading-relaxed"
        style={{ color: "var(--color-text-secondary)" }}
      >
        {texto}
      </p>
    </div>
  );
}

function Advertencia({ texto }: { texto: string }) {
  return (
    <div
      className="flex gap-3 rounded-xl p-4"
      style={{
        background: "var(--color-warning-bg)",
        border: "1px solid var(--color-warning)",
      }}
    >
      <AlertTriangle
        className="w-4 h-4 shrink-0 mt-0.5"
        style={{ color: "var(--color-warning)" }}
      />
      <p
        className="text-sm leading-relaxed"
        style={{ color: "var(--color-warning-text)" }}
      >
        {texto}
      </p>
    </div>
  );
}

function Destacado({ texto }: { texto: string }) {
  return (
    <div
      className="flex gap-3 rounded-xl p-4"
      style={{
        background: "var(--color-success-bg)",
        border: "1px solid var(--color-success)",
      }}
    >
      <CheckCircle
        className="w-4 h-4 shrink-0 mt-0.5"
        style={{ color: "var(--color-success)" }}
      />
      <p
        className="text-sm leading-relaxed font-medium"
        style={{ color: "var(--color-success-text)" }}
      >
        {texto}
      </p>
    </div>
  );
}

/* ── Página principal ────────────────────────────────────────────────────── */

export default function TerminosPage() {
  const fechaActualizacion = new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="min-h-screen app-bg py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* ── Encabezado ───────────────────────────────────────────── */}
        <div className="text-center space-y-2 pb-2">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-2"
            style={{
              background: "var(--color-accent-light)",
              color: "var(--color-accent)",
              border: "1px solid var(--color-accent)",
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.08em",
            }}
          >
            <Shield className="w-3.5 h-3.5" />
            DOCUMENTO LEGAL
          </div>
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-ui)" }}
          >
            Términos y Condiciones
          </h1>
          <p className="text-lg font-medium" style={{ color: "var(--color-accent)" }}>
            CREDIPHONE — Servicio de Reparación
          </p>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Última actualización: {fechaActualizacion}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
            Conforme a la Ley Federal de Protección al Consumidor (LFPC) · NOM-024-SCFI-2013 ·
            Ley Federal de Protección de Datos Personales en Posesión de Particulares (LFPDPPP)
          </p>
        </div>

        {/* ── 1. Aceptación del servicio ───────────────────────────── */}
        <SeccionCard
          icono={<FileText className="w-5 h-5" />}
          titulo="1. Aceptación del Servicio"
        >
          <Item
            numero={1}
            texto="Al entregar un dispositivo en CREDIPHONE para diagnóstico o reparación, el cliente acepta íntegramente los presentes términos y condiciones."
          />
          <Item
            numero={2}
            texto="El cliente declara ser propietario legítimo del equipo entregado o contar con autorización expresa del propietario, asumiendo plena responsabilidad legal por dicha declaración (Art. 1794, Código Civil Federal)."
          />
          <Item
            numero={3}
            texto="Estos términos aplican a todos los servicios prestados por CREDIPHONE, incluyendo diagnóstico, reparación, mantenimiento preventivo y garantías."
          />
          <Item
            numero={4}
            texto="CREDIPHONE se reserva el derecho de rechazar un servicio si el equipo presenta condiciones que imposibiliten la reparación segura o representa un riesgo para el personal técnico."
          />
        </SeccionCard>

        {/* ── 2. Proceso de diagnóstico y presupuesto ──────────────── */}
        <SeccionCard
          icono={<Wrench className="w-5 h-5" />}
          titulo="2. Diagnóstico y Presupuesto"
        >
          <Item
            numero={1}
            texto="Todo equipo recibido es sometido a un diagnóstico técnico. El diagnóstico tiene un costo de revisión que se informa al momento de la recepción."
          />
          <Item
            numero={2}
            texto="Una vez concluido el diagnóstico, CREDIPHONE emite un presupuesto detallado con el costo total de la reparación. El cliente debe aprobar o rechazar el presupuesto dentro de los 3 días hábiles siguientes a su notificación."
          />
          <Item
            numero={3}
            texto="Si el cliente rechaza el presupuesto, el equipo será devuelto en el estado en que se recibió. El costo de diagnóstico sigue siendo aplicable. No se garantiza la restitución al estado original previo al diagnóstico."
          />
          <Item
            numero={4}
            texto="Al aprobar el presupuesto, el cliente autoriza expresamente la realización de los trabajos descritos. Cualquier trabajo adicional no incluido en el presupuesto aprobado requiere una nueva autorización."
          />
          <Advertencia texto="Si el cliente no responde en 5 días hábiles tras la notificación del presupuesto, el equipo será devuelto cobrando únicamente el costo de diagnóstico." />
        </SeccionCard>

        {/* ── 3. Garantía ──────────────────────────────────────────── */}
        <SeccionCard
          icono={<Shield className="w-5 h-5" />}
          titulo="3. Garantía del Servicio"
        >
          <Destacado texto={`Garantía de 90 días naturales sobre la mano de obra realizada, conforme al Art. 76 bis de la Ley Federal de Protección al Consumidor (LFPC), vigente ${new Date().getFullYear()}.`} />
          <Item
            numero={1}
            texto="La garantía cubre exclusivamente la mano de obra correspondiente al servicio realizado y las piezas instaladas por CREDIPHONE durante la reparación."
          />
          <Item
            numero={2}
            texto="Los 90 días naturales de garantía se computan a partir de la fecha de entrega del equipo al cliente, documentada en la orden de servicio."
          />
          <Item
            numero={3}
            resaltado
            texto="Para hacer válida la garantía, el cliente debe presentar su orden de servicio original (física o digital) y el equipo debe ser entregado en CREDIPHONE dentro del período de vigencia."
          />
          <div
            className="rounded-xl p-4 space-y-2"
            style={{
              background: "var(--color-danger-bg)",
              border: "1px solid var(--color-danger)",
            }}
          >
            <p
              className="text-sm font-bold"
              style={{ color: "var(--color-danger-text)" }}
            >
              La garantía NO aplica en los siguientes casos:
            </p>
            {[
              "Daños ocasionados por golpes, caídas o impacto físico posterior a la reparación.",
              "Daños por contacto con líquidos, humedad o condiciones ambientales extremas.",
              "Mal uso, modificaciones o reparaciones realizadas por terceros no autorizados.",
              "Daños por virus, software malicioso o actualizaciones de firmware.",
              "Desgaste natural del equipo no relacionado con el servicio prestado.",
              "Fallas preexistentes documentadas al momento de la recepción (ver condiciones en la orden de servicio).",
            ].map((excl, i) => (
              <div key={i} className="flex gap-2">
                <span
                  className="text-xs font-bold shrink-0 mt-0.5"
                  style={{ color: "var(--color-danger)" }}
                >
                  ✗
                </span>
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: "var(--color-danger-text)" }}
                >
                  {excl}
                </p>
              </div>
            ))}
          </div>
        </SeccionCard>

        {/* ── 4. Plazo de custodia ─────────────────────────────────── */}
        <SeccionCard
          icono={<Clock className="w-5 h-5" />}
          titulo="4. Plazos y Custodia del Equipo"
        >
          <Item
            numero={1}
            texto="Una vez que el equipo esté listo para su entrega, CREDIPHONE notificará al cliente por los medios registrados (WhatsApp, SMS o llamada telefónica)."
          />
          <Item
            numero={2}
            texto="El cliente tiene hasta 30 días naturales, contados a partir de la notificación de equipo listo, para recoger su dispositivo sin costo adicional de resguardo."
          />
          <Item
            numero={3}
            texto="Transcurridos los 30 días sin que el cliente recoja el equipo, CREDIPHONE podrá cobrar una tarifa de almacenaje. Transcurridos 90 días sin reclamación, CREDIPHONE podrá disponer del equipo conforme a la legislación aplicable."
          />
          <Item
            numero={4}
            texto="El tiempo estimado de reparación señalado en la orden es referencial y no constituye una garantía de entrega. Factores como disponibilidad de piezas pueden modificar dicho plazo."
          />
          <Advertencia texto="CREDIPHONE no se hace responsable por retrasos derivados de falta de disponibilidad de refacciones en el mercado o causas de fuerza mayor." />
        </SeccionCard>

        {/* ── 5. Limitación de responsabilidad ────────────────────── */}
        <SeccionCard
          icono={<AlertTriangle className="w-5 h-5" />}
          titulo="5. Responsabilidad y Condiciones Especiales"
        >
          <Item
            numero={1}
            texto="CREDIPHONE no se hace responsable por pérdida de datos, archivos, aplicaciones, contactos, fotos o configuraciones almacenadas en el dispositivo durante el diagnóstico o la reparación. Se recomienda encarecidamente realizar un respaldo (backup) completo antes de entregar el equipo."
          />
          <Item
            numero={2}
            texto="Los equipos con daño previo por contacto con líquidos (agua, refrescos, sudor, etc.) presentan corrosión interna que puede progresar de forma imprevisible. CREDIPHONE no responde por fallas adicionales derivadas de dicho daño preexistente (NOM-024-SCFI-2013)."
          />
          <Item
            numero={3}
            texto="Las baterías con deformación física (hinchamiento) representan un riesgo de incendio o explosión. Si el equipo presenta esta condición, CREDIPHONE recomienda su sustitución inmediata y no es responsable por daños derivados de una batería en esas condiciones."
          />
          <Item
            numero={4}
            texto="Las fallas preexistentes documentadas al momento de la recepción (pantalla rota, micrófono dañado, etc.) quedan registradas en la orden de servicio. CREDIPHONE no responde por dichas preexistencias ni por su agravamiento durante la reparación de otro componente."
          />
          <Item
            numero={5}
            texto="La responsabilidad máxima de CREDIPHONE por cualquier daño atribuible al servicio prestado se limita al valor comercial del equipo al momento de su recepción, debidamente documentado."
          />
        </SeccionCard>

        {/* ── 6. Pagos y cancelaciones ────────────────────────────── */}
        <SeccionCard
          icono={<FileText className="w-5 h-5" />}
          titulo="6. Pagos, Anticipos y Cancelaciones"
        >
          <Item
            numero={1}
            texto="Los precios cotizados incluyen mano de obra y refacciones necesarias para la reparación aprobada. Cualquier cargo adicional requerirá aprobación previa del cliente."
          />
          <Item
            numero={2}
            texto="CREDIPHONE puede solicitar un anticipo al momento de la recepción del equipo o al aprobar el presupuesto. El anticipo se descuenta del total al momento de la entrega."
          />
          <Item
            numero={3}
            texto="En caso de cancelación por parte del cliente después de haber aprobado el presupuesto e iniciados los trabajos, el anticipo puede ser retenido parcial o totalmente según el avance de la reparación."
          />
          <Item
            numero={4}
            texto="Los métodos de pago aceptados son: efectivo, transferencia bancaria, depósito y los medios indicados en la orden de servicio."
          />
          <Item
            numero={5}
            texto="CREDIPHONE emite comprobante de pago por cada transacción realizada. El cliente puede solicitar factura fiscal con su RFC al momento del pago."
          />
        </SeccionCard>

        {/* ── 7. Privacidad de datos ───────────────────────────────── */}
        <SeccionCard
          icono={<Lock className="w-5 h-5" />}
          titulo="7. Privacidad y Protección de Datos"
        >
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>
            Conforme a la Ley Federal de Protección de Datos Personales en Posesión de Particulares (LFPDPPP)
          </p>
          <Item
            numero={1}
            texto="CREDIPHONE recopila únicamente los datos personales necesarios para la prestación del servicio: nombre, teléfono, dirección y datos del dispositivo. Estos datos son tratados de forma confidencial."
          />
          <Item
            numero={2}
            texto="Los datos del cliente son utilizados exclusivamente para la gestión de la orden de servicio, notificaciones sobre el estado de la reparación, y seguimiento de garantías."
          />
          <Item
            numero={3}
            texto="CREDIPHONE no vende, alquila ni comparte los datos personales de sus clientes con terceros, salvo requerimiento de autoridad competente."
          />
          <Item
            numero={4}
            resaltado
            texto="El cliente tiene derecho a acceder, rectificar, cancelar u oponerse al tratamiento de sus datos (derechos ARCO). Para ejercerlos, puede comunicarse directamente en cualquier sucursal CREDIPHONE."
          />
          <Item
            numero={5}
            texto="Las contraseñas, patrones de desbloqueo y cuentas de dispositivo proporcionados son utilizados exclusivamente para el diagnóstico y reparación, y son eliminados de nuestros registros al momento de la entrega."
          />
          <Advertencia texto="CREDIPHONE no accede al contenido personal del dispositivo (mensajes, fotos, aplicaciones) más allá de lo estrictamente necesario para el diagnóstico técnico." />
        </SeccionCard>

        {/* ── 8. Modificaciones ───────────────────────────────────── */}
        <SeccionCard
          icono={<FileText className="w-5 h-5" />}
          titulo="8. Modificaciones a los Términos"
        >
          <Item
            numero={1}
            texto="CREDIPHONE se reserva el derecho de modificar los presentes términos en cualquier momento. Las modificaciones serán publicadas en esta página con la fecha de actualización correspondiente."
          />
          <Item
            numero={2}
            texto="Las modificaciones no afectan retroactivamente los servicios en proceso al momento del cambio. Los nuevos términos aplican a partir de la fecha de publicación para servicios nuevos."
          />
          <Item
            numero={3}
            texto="El uso continuo del servicio de reparación de CREDIPHONE después de la publicación de cambios constituye la aceptación de los nuevos términos."
          />
        </SeccionCard>

        {/* ── Contacto ─────────────────────────────────────────────── */}
        <div
          className="rounded-2xl p-6 text-center space-y-4"
          style={{
            background: "var(--color-sidebar-bg)",
            border: "1px solid var(--color-sidebar-border)",
          }}
        >
          <div>
            <p
              className="text-base font-bold"
              style={{
                color: "var(--color-sidebar-active)",
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.1em",
              }}
            >
              CREDIPHONE
            </p>
            <p
              className="text-sm mt-1"
              style={{ color: "var(--color-sidebar-text)" }}
            >
              ¿Tienes preguntas sobre estos términos?
            </p>
          </div>
          <div className="flex items-center justify-center gap-2">
            <Phone
              className="w-4 h-4"
              style={{ color: "var(--color-sidebar-active)" }}
            />
            <p
              className="text-sm"
              style={{ color: "var(--color-sidebar-text)", fontFamily: "var(--font-mono)" }}
            >
              Visítanos en cualquier sucursal o contáctanos por WhatsApp
            </p>
          </div>
          <p
            className="text-xs"
            style={{ color: "var(--color-sidebar-text-dim)" }}
          >
            Estos términos están vigentes a partir del {fechaActualizacion}
          </p>
        </div>

        {/* ── Footer legal ─────────────────────────────────────────── */}
        <div className="text-center pb-4 space-y-1">
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            Términos conforme a LFPC · NOM-024-SCFI-2013 · LFPDPPP · Código Civil Federal
          </p>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            © {new Date().getFullYear()} CREDIPHONE — Todos los derechos reservados
          </p>
        </div>

      </div>
    </div>
  );
}
