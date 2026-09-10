/**
 * catalog.js
 * Genera un catálogo (texto + imágenes) a partir de los productos disponibles,
 * listo para compartir por WhatsApp. Se recalcula siempre desde el stock actual,
 * así nunca queda desactualizado.
 */

const Catalog = {
  /** Devuelve sólo productos con stock disponible, opcionalmente filtrado por ids. */
  async productosParaCatalogo(idsSeleccionados = null) {
    let productos = await Inventory.listarProductos();
    productos = productos.filter((p) => Utils.totalTalles(p.talles) > 0 && p.estado !== 'Vendido');
    if (idsSeleccionados && idsSeleccionados.length) {
      productos = productos.filter((p) => idsSeleccionados.includes(p.id));
    }
    return productos;
  },

  /** Texto de un producto individual, formato listo para WhatsApp. */
  textoProducto(p) {
    const talles = Object.entries(p.talles || {})
      .filter(([, cant]) => Number(cant) > 0)
      .map(([talle, cant]) => `Talle ${talle} (${cant} disp.)`)
      .join(' | ');

    return [
      `🧸 *${p.nombre}*`,
      p.descripcion ? p.descripcion : null,
      `💰 ${Utils.formatMoney(p.precioVenta)}`,
      talles ? `📏 ${talles}` : null,
      p.color ? `🎨 Color: ${p.color}` : null,
      `🔖 Cod: ${p.codigo}`
    ].filter(Boolean).join('\n');
  },

  /** Arma el texto completo del catálogo con todos los productos pasados. */
  textoCatalogoCompleto(productos, titulo = 'Catálogo Mi Armario 🧸') {
    const cuerpo = productos.map((p) => this.textoProducto(p)).join('\n\n———\n\n');
    return `*${titulo}*\n\n${cuerpo}`;
  }
};

window.Catalog = Catalog;
