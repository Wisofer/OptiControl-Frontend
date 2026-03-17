/** Plantillas de mensajes WhatsApp (demo estático). */
export const mockWhatsappTemplates = [
  {
    id: 1,
    nombre: "Factura estándar",
    mensaje: "Hola {NombreCliente}, te enviamos tu factura {NumeroFactura}. Monto: C${Monto}. Fecha de creación: {FechaCreacion}. Descarga: {EnlacePDF}. Gracias por tu preferencia.",
    activa: true,
    predeterminada: true,
  },
  {
    id: 2,
    nombre: "Recordatorio de pago",
    mensaje: "Hola {NombreCliente}, te recordamos que la factura {NumeroFactura} por C${Monto} está {Estado}. Fecha de vencimiento próxima. ¿Necesitas el enlace? {EnlacePDF}",
    activa: true,
    predeterminada: false,
  },
  {
    id: 3,
    nombre: "Factura por categoría",
    mensaje: "Estimado/a {NombreCliente}, adjuntamos factura {NumeroFactura} - {Categoria}. Monto: C${Monto}. Mes: {Mes}. Estado: {Estado}. Enlace: {EnlacePDF}.",
    activa: true,
    predeterminada: false,
  },
  {
    id: 4,
    nombre: "Código cliente",
    mensaje: "Hola, tu código de cliente es {CodigoCliente}. Factura: {NumeroFactura}, monto C${Monto}. Descargar: {EnlacePDF}. Saludos.",
    activa: false,
    predeterminada: false,
  },
];
