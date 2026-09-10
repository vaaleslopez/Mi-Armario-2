/**
 * sales.js
 * Registro de ventas y estadísticas de ventas.
 * Cada venta descuenta stock automáticamente vía Inventory.
 */

const Sales = {
  /**
   * item: { productId, talle, cantidad, precio }
   * data: { items: [...], customerId, formaPago, descuento, notas }
   */
  async registrarVenta(data) {
    const items = data.items || [];
    if (!items.length) throw new Error('La venta necesita al menos un producto');

    // Descontar stock de cada item vendido
    for (const item of items) {
      await Inventory.quitarStock(item.productId, item.talle, item.cantidad, 'Venta');
      await DB.add(DB.STORES.MOVEMENTS, {
        productId: item.productId,
        talle: item.talle,
        tipo: 'venta',
        cantidad: item.cantidad,
        fecha: Utils.nowISO(),
        nota: 'Venta registrada'
      });
    }

    const subtotal = items.reduce((acc, it) => acc + it.precio * it.cantidad, 0);
    const descuento = Number(data.descuento) || 0;
    const total = Math.max(0, subtotal - descuento);

    const venta = {
      items,
      customerId: data.customerId || null,
      formaPago: data.formaPago || 'Efectivo',
      descuento,
      subtotal,
      total,
      notas: data.notas || '',
      fecha: Utils.nowISO()
    };

    const id = await DB.add(DB.STORES.SALES, venta);
    return id;
  },

  async listarVentas() {
    const ventas = await DB.getAll(DB.STORES.SALES);
    return ventas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  },

  async obtenerVenta(id) {
    return DB.get(DB.STORES.SALES, id);
  },

  /**
   * Edita una venta ya cargada. Primero devuelve al stock las cantidades
   * originales y después descuenta las nuevas, así el inventario siempre
   * queda consistente aunque se hayan cambiado cantidades o productos.
   */
  async actualizarVenta(id, data) {
    const original = await DB.get(DB.STORES.SALES, id);
    if (!original) throw new Error('Venta no encontrada');

    for (const item of original.items) {
      await Inventory.devolverStock(item.productId, item.talle, item.cantidad, 'Edición de venta (restitución)');
    }

    const items = data.items || [];
    if (!items.length) throw new Error('La venta necesita al menos un producto');

    for (const item of items) {
      await Inventory.quitarStock(item.productId, item.talle, item.cantidad, 'Edición de venta');
      await DB.add(DB.STORES.MOVEMENTS, {
        productId: item.productId,
        talle: item.talle,
        tipo: 'venta',
        cantidad: item.cantidad,
        fecha: Utils.nowISO(),
        nota: 'Venta editada'
      });
    }

    const subtotal = items.reduce((acc, it) => acc + it.precio * it.cantidad, 0);
    const descuento = Number(data.descuento) || 0;
    const total = Math.max(0, subtotal - descuento);

    const actualizada = {
      ...original,
      items,
      customerId: data.customerId || null,
      formaPago: data.formaPago || 'Efectivo',
      descuento,
      subtotal,
      total,
      notas: data.notas || '',
      editadoEn: Utils.nowISO()
    };

    await DB.put(DB.STORES.SALES, actualizada);
    return actualizada;
  },

  async eliminarVenta(id) {
    const venta = await DB.get(DB.STORES.SALES, id);
    if (!venta) return;
    // Devolver el stock de cada item antes de borrar la venta
    for (const item of venta.items) {
      await Inventory.devolverStock(item.productId, item.talle, item.cantidad, 'Venta eliminada');
    }
    await DB.delete(DB.STORES.SALES, id);
  },

  _dentroDeRango(fechaISO, desde, hasta) {
    const f = new Date(fechaISO).getTime();
    return f >= desde.getTime() && f <= hasta.getTime();
  },

  async ventasEnRango(desde, hasta) {
    const ventas = await this.listarVentas();
    return ventas.filter((v) => this._dentroDeRango(v.fecha, desde, hasta));
  },

  async resumenPeriodo(tipo = 'dia') {
    const ahora = new Date();
    let desde;
    if (tipo === 'dia') {
      desde = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    } else if (tipo === 'semana') {
      desde = new Date(ahora);
      desde.setDate(ahora.getDate() - 7);
    } else if (tipo === 'mes') {
      desde = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    } else if (tipo === 'anio') {
      desde = new Date(ahora.getFullYear(), 0, 1);
    }
    const ventas = await this.ventasEnRango(desde, ahora);

    let dineroVendido = 0;
    let ganancias = 0;
    const productoContador = {};

    for (const venta of ventas) {
      dineroVendido += venta.total;
      for (const item of venta.items) {
        const producto = await Inventory.obtenerProducto(item.productId);
        const costoUnit = producto ? Number(producto.precioCosto) || 0 : 0;
        ganancias += (item.precio - costoUnit) * item.cantidad;
        const key = producto ? producto.nombre : `#${item.productId}`;
        productoContador[key] = (productoContador[key] || 0) + item.cantidad;
      }
    }

    const masVendidos = Object.entries(productoContador)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([nombre, cantidad]) => ({ nombre, cantidad }));

    return {
      cantidadVentas: ventas.length,
      dineroVendido,
      ganancias,
      masVendidos
    };
  }
};

window.Sales = Sales;
