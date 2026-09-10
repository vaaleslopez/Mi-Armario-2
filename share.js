/**
 * share.js
 * Compartir productos y catálogos por WhatsApp / Instagram / Web Share API.
 */

const Share = {
  /** Comparte un producto individual (texto + foto si el navegador lo soporta). */
  async compartirProducto(producto) {
    const texto = Catalog.textoProducto(producto);

    if (navigator.share) {
      try {
        const filesPayload = [];
        if (producto.fotoPrincipal && navigator.canShare) {
          const file = new File([producto.fotoPrincipal], `${Utils.slug(producto.nombre)}.jpg`, {
            type: 'image/jpeg'
          });
          if (navigator.canShare({ files: [file] })) filesPayload.push(file);
        }
        await navigator.share({
          title: producto.nombre,
          text: texto,
          files: filesPayload.length ? filesPayload : undefined
        });
        return true;
      } catch (err) {
        // el usuario canceló o falló: seguimos con el fallback de WhatsApp
      }
    }
    this.abrirWhatsappTexto(texto);
    return false;
  },

  async compartirCatalogo(productos) {
    const texto = Catalog.textoCatalogoCompleto(productos);
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Catálogo Mi Armario', text: texto });
        return true;
      } catch (err) {
        // fallback abajo
      }
    }
    this.abrirWhatsappTexto(texto);
    return false;
  },

  abrirWhatsappTexto(texto) {
    const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
  },

  abrirWhatsappCliente(telefono, texto) {
    const url = Customers.linkWhatsapp(telefono, texto);
    window.open(url, '_blank');
  }
};

window.Share = Share;
