/**
 * customers.js
 * CRUD de clientes + historial de compras + link directo a WhatsApp.
 */

const Customers = {
  async crearCliente(data) {
    const cliente = {
      nombre: data.nombre || '',
      telefono: data.telefono || '',
      direccion: data.direccion || '',
      notas: data.notas || '',
      creadoEn: Utils.nowISO()
    };
    return DB.add(DB.STORES.CUSTOMERS, cliente);
  },

  async actualizarCliente(id, data) {
    const cliente = await DB.get(DB.STORES.CUSTOMERS, id);
    if (!cliente) throw new Error('Cliente no encontrado');
    Object.assign(cliente, data);
    await DB.put(DB.STORES.CUSTOMERS, cliente);
    return cliente;
  },

  async eliminarCliente(id) {
    await DB.delete(DB.STORES.CUSTOMERS, id);
  },

  async obtenerCliente(id) {
    return DB.get(DB.STORES.CUSTOMERS, id);
  },

  async listarClientes() {
    const clientes = await DB.getAll(DB.STORES.CUSTOMERS);
    return clientes.sort((a, b) => a.nombre.localeCompare(b.nombre));
  },

  async comprasDeCliente(customerId) {
    const ventas = await Sales.listarVentas();
    return ventas.filter((v) => v.customerId === customerId);
  },

  /** Genera un link wa.me listo para abrir, con mensaje opcional. */
  linkWhatsapp(telefono, mensaje = '') {
    const numero = (telefono || '').replace(/[^0-9]/g, '');
    const texto = encodeURIComponent(mensaje);
    return `https://wa.me/${numero}${texto ? '?text=' + texto : ''}`;
  }
};

window.Customers = Customers;
