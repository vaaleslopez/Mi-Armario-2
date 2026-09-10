/**
 * backup.js
 * Exporta e importa toda la base de datos como un único archivo JSON.
 * Las fotos (Blobs) se convierten a base64 para poder guardarlas en JSON.
 */

const Backup = {
  async _blobToBase64(blob) {
    if (!blob) return null;
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  },

  async _base64ToBlob(base64) {
    if (!base64) return null;
    const res = await fetch(base64);
    return res.blob();
  },

  async exportarJSON() {
    const [productos, movimientos, ventas, clientes] = await Promise.all([
      DB.getAll(DB.STORES.PRODUCTS),
      DB.getAll(DB.STORES.MOVEMENTS),
      DB.getAll(DB.STORES.SALES),
      DB.getAll(DB.STORES.CUSTOMERS)
    ]);

    // Convertir fotos (Blob) a base64 para que entren en el JSON
    const productosSerializables = await Promise.all(
      productos.map(async (p) => ({
        ...p,
        fotoPrincipal: await this._blobToBase64(p.fotoPrincipal),
        fotos: await Promise.all((p.fotos || []).map((f) => this._blobToBase64(f)))
      }))
    );

    const data = {
      version: 1,
      generadoEn: Utils.nowISO(),
      productos: productosSerializables,
      movimientos,
      ventas,
      clientes
    };

    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const fecha = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `mi-armario-backup-${fecha}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    await DB.put(DB.STORES.SETTINGS, { key: 'lastBackup', value: Utils.nowISO() });
    return data;
  },

  async obtenerUltimoBackup() {
    try {
      const registro = await DB.get(DB.STORES.SETTINGS, 'lastBackup');
      return registro ? registro.value : null;
    } catch (err) {
      return null;
    }
  },

  /** Restaura desde un archivo JSON exportado previamente. Reemplaza todos los datos actuales. */
  async importarJSON(file) {
    const texto = await file.text();
    const data = JSON.parse(texto);

    const productos = await Promise.all(
      (data.productos || []).map(async (p) => ({
        ...p,
        fotoPrincipal: await this._base64ToBlob(p.fotoPrincipal),
        fotos: await Promise.all((p.fotos || []).map((f) => this._base64ToBlob(f)))
      }))
    );

    await DB.replaceAll(DB.STORES.PRODUCTS, productos);
    await DB.replaceAll(DB.STORES.MOVEMENTS, data.movimientos || []);
    await DB.replaceAll(DB.STORES.SALES, data.ventas || []);
    await DB.replaceAll(DB.STORES.CUSTOMERS, data.clientes || []);

    return true;
  }
};

window.Backup = Backup;
