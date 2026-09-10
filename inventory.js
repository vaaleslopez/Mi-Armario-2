/**
 * inventory.js
 * CRUD de productos + gestión de stock por talle + movimientos.
 */

const Inventory = {
  ESTADOS: ['Disponible', 'Reservado', 'Vendido', 'Sin stock'],

  /**
   * Crea un producto nuevo.
   * talles: { "1": 3, "2": 5, "3": 2 }
   * fotoPrincipal / fotos: Blobs ya comprimidos (opcional).
   */
  async crearProducto(data) {
    const count = await DB.count(DB.STORES.PRODUCTS);
    const producto = {
      nombre: data.nombre || '',
      categoria: data.categoria || '',
      descripcion: data.descripcion || '',
      color: data.color || '',
      marca: data.marca || '',
      temporada: data.temporada || '',
      talles: data.talles || {},
      precioVenta: Number(data.precioVenta) || 0,
      precioCosto: Number(data.precioCosto) || 0,
      codigo: data.codigo || Utils.generarCodigo(count + 1),
      estado: 'Disponible',
      reservaHasta: data.reservaHasta || null,
      fotoPrincipal: data.fotoPrincipal || null,
      fotos: data.fotos || [],
      creadoEn: Utils.nowISO(),
      actualizadoEn: Utils.nowISO()
    };
    producto.margen = Utils.calcularMargen(producto.precioCosto, producto.precioVenta);
    this._actualizarEstadoPorStock(producto);

    const id = await DB.add(DB.STORES.PRODUCTS, producto);
    await this._registrarMovimiento(id, null, 'creacion', Utils.totalTalles(producto.talles), 'Alta de producto');
    return id;
  },

  async actualizarProducto(id, data) {
    const producto = await DB.get(DB.STORES.PRODUCTS, id);
    if (!producto) throw new Error('Producto no encontrado');
    Object.assign(producto, data, { actualizadoEn: Utils.nowISO() });
    producto.margen = Utils.calcularMargen(producto.precioCosto, producto.precioVenta);
    this._actualizarEstadoPorStock(producto);
    await DB.put(DB.STORES.PRODUCTS, producto);
    return producto;
  },

  async eliminarProducto(id) {
    await DB.delete(DB.STORES.PRODUCTS, id);
  },

  async obtenerProducto(id) {
    return DB.get(DB.STORES.PRODUCTS, id);
  },

  async listarProductos() {
    return DB.getAll(DB.STORES.PRODUCTS);
  },

  /** Si el estado no es manual (Reservado/Vendido), lo recalcula según stock. */
  _actualizarEstadoPorStock(producto) {
    if (producto.estado === 'Reservado' || producto.estado === 'Vendido') return;
    const total = Utils.totalTalles(producto.talles);
    producto.estado = total > 0 ? 'Disponible' : 'Sin stock';
  },

  async _registrarMovimiento(productId, talle, tipo, cantidad, nota) {
    await DB.add(DB.STORES.MOVEMENTS, {
      productId,
      talle,
      tipo, // creacion | agregado | quitado | venta | devolucion | ajuste
      cantidad,
      fecha: Utils.nowISO(),
      nota: nota || ''
    });
  },

  async listarMovimientos(productId) {
    if (productId) return DB.getByIndex(DB.STORES.MOVEMENTS, 'productId', productId);
    return DB.getAll(DB.STORES.MOVEMENTS);
  },

  /** Agrega stock a un talle específico. */
  async agregarStock(productId, talle, cantidad, nota) {
    const producto = await DB.get(DB.STORES.PRODUCTS, productId);
    if (!producto) throw new Error('Producto no encontrado');
    producto.talles = producto.talles || {};
    producto.talles[talle] = (Number(producto.talles[talle]) || 0) + Number(cantidad);
    producto.actualizadoEn = Utils.nowISO();
    this._actualizarEstadoPorStock(producto);
    await DB.put(DB.STORES.PRODUCTS, producto);
    await this._registrarMovimiento(productId, talle, 'agregado', cantidad, nota);
    return producto;
  },

  /** Quita stock manualmente (pérdida, rotura, ajuste, etc). */
  async quitarStock(productId, talle, cantidad, nota) {
    const producto = await DB.get(DB.STORES.PRODUCTS, productId);
    if (!producto) throw new Error('Producto no encontrado');
    producto.talles = producto.talles || {};
    const actual = Number(producto.talles[talle]) || 0;
    producto.talles[talle] = Math.max(0, actual - Number(cantidad));
    producto.actualizadoEn = Utils.nowISO();
    this._actualizarEstadoPorStock(producto);
    await DB.put(DB.STORES.PRODUCTS, producto);
    await this._registrarMovimiento(productId, talle, 'quitado', cantidad, nota);
    return producto;
  },

  /** Devuelve stock (por ejemplo, un cliente devuelve una prenda). */
  async devolverStock(productId, talle, cantidad, nota) {
    return this.agregarStock(productId, talle, cantidad, nota || 'Devolución');
  },

  /** Marca el producto como reservado hasta una fecha (YYYY-MM-DD). */
  async marcarComoReservado(id, fechaLimite, nota) {
    const producto = await this.actualizarProducto(id, { estado: 'Reservado', reservaHasta: fechaLimite || null });
    await this._registrarMovimiento(id, null, 'ajuste', 0, nota || `Reservado hasta ${fechaLimite || 's/fecha'}`);
    return producto;
  },

  /** Cancela la reserva y vuelve el estado a Disponible/Sin stock según el stock actual. */
  async cancelarReserva(id) {
    const producto = await DB.get(DB.STORES.PRODUCTS, id);
    if (!producto) throw new Error('Producto no encontrado');
    producto.estado = 'Disponible';
    producto.reservaHasta = null;
    this._actualizarEstadoPorStock(producto);
    await DB.put(DB.STORES.PRODUCTS, producto);
    await this._registrarMovimiento(id, null, 'ajuste', 0, 'Reserva cancelada');
    return producto;
  },

  async listarReservasVencidas() {
    const productos = await this.listarProductos();
    const hoy = new Date();
    return productos.filter((p) => p.estado === 'Reservado' && p.reservaHasta && new Date(p.reservaHasta) < hoy);
  },

  /**
   * Ajusta el precio de venta de varios productos a la vez, sumando/restando
   * un porcentaje. categoria=null aplica a todos los productos.
   * Devuelve la cantidad de productos modificados.
   */
  async ajustarPreciosPorCategoria(categoria, porcentaje) {
    const productos = await this.listarProductos();
    const objetivo = categoria ? productos.filter((p) => p.categoria === categoria) : productos;
    const factor = 1 + (Number(porcentaje) || 0) / 100;

    for (const p of objetivo) {
      const nuevoPrecio = Math.max(0, Math.round(p.precioVenta * factor));
      await this.actualizarProducto(p.id, { precioVenta: nuevoPrecio });
    }
    return objetivo.length;
  },

  async listarConPocoStock(umbral = 2) {
    const productos = await this.listarProductos();
    return productos.filter((p) => {
      const total = Utils.totalTalles(p.talles);
      return total > 0 && total <= umbral;
    });
  },

  async listarSinStock() {
    const productos = await this.listarProductos();
    return productos.filter((p) => Utils.totalTalles(p.talles) === 0);
  },

  /** Resumen para el dashboard/estadísticas. */
  async resumenInventario() {
    const productos = await this.listarProductos();
    let totalPrendas = 0;
    let valorInventario = 0;
    productos.forEach((p) => {
      const total = Utils.totalTalles(p.talles);
      totalPrendas += total;
      valorInventario += total * (Number(p.precioVenta) || 0);
    });
    return {
      totalProductos: productos.length,
      totalPrendas,
      valorInventario
    };
  }
};

window.Inventory = Inventory;
