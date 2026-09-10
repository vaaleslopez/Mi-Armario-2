/**
 * filters.js
 * Búsqueda y filtrado de productos en memoria (rápido, sin re-consultar IndexedDB).
 */

const Filters = {
  /**
   * texto: búsqueda libre por nombre, categoría, talle, color, marca, código, precio.
   * opciones: { categoria, talle, estado, colorFiltro }
   */
  buscar(productos, texto) {
    if (!texto) return productos;
    const q = texto.toLowerCase().trim();
    return productos.filter((p) => {
      const talles = Object.keys(p.talles || {}).join(' ');
      const campos = [
        p.nombre, p.categoria, p.color, p.marca, p.codigo,
        String(p.precioVenta), talles
      ].join(' ').toLowerCase();
      return campos.includes(q);
    });
  },

  aplicarFiltros(productos, opciones = {}) {
    let resultado = [...productos];

    if (opciones.categoria) {
      resultado = resultado.filter((p) => p.categoria === opciones.categoria);
    }
    if (opciones.talle) {
      resultado = resultado.filter((p) => p.talles && Number(p.talles[opciones.talle]) > 0);
    }
    if (opciones.estado) {
      resultado = resultado.filter((p) => p.estado === opciones.estado);
    }
    if (opciones.marca) {
      resultado = resultado.filter((p) => p.marca === opciones.marca);
    }
    if (opciones.pocoStock) {
      resultado = resultado.filter((p) => {
        const total = Utils.totalTalles(p.talles);
        return total > 0 && total <= 2;
      });
    }
    if (opciones.disponibles) {
      resultado = resultado.filter((p) => p.estado === 'Disponible');
    }
    if (opciones.vendidos) {
      resultado = resultado.filter((p) => p.estado === 'Vendido');
    }
    return resultado;
  },

  categoriasUnicas(productos) {
    return [...new Set(productos.map((p) => p.categoria).filter(Boolean))].sort();
  },

  marcasUnicas(productos) {
    return [...new Set(productos.map((p) => p.marca).filter(Boolean))].sort();
  },

  tallesUnicos(productos) {
    const set = new Set();
    productos.forEach((p) => Object.keys(p.talles || {}).forEach((t) => set.add(t)));
    return [...set].sort();
  }
};

window.Filters = Filters;
