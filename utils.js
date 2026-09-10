/**
 * utils.js
 * Funciones generales reutilizables por toda la app.
 */

const Utils = {
  formatMoney(value) {
    const n = Number(value) || 0;
    return '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  },

  formatDate(isoString) {
    const d = new Date(isoString);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  },

  formatDateTime(isoString) {
    const d = new Date(isoString);
    return d.toLocaleDateString('es-AR') + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  },

  nowISO() {
    return new Date().toISOString();
  },

  /** Genera un código interno corto tipo MA-000123 */
  generarCodigo(numero) {
    return 'MA-' + String(numero).padStart(6, '0');
  },

  /** Calcula margen de ganancia en % a partir de costo y venta. */
  calcularMargen(costo, venta) {
    costo = Number(costo) || 0;
    venta = Number(venta) || 0;
    if (costo <= 0) return 0;
    return Math.round(((venta - costo) / costo) * 100);
  },

  debounce(fn, wait = 300) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  },

  /**
   * Comprime y redimensiona una imagen (File/Blob) usando canvas.
   * Devuelve un Blob JPEG liviano, ideal para guardar miles de fotos en IndexedDB.
   */
  comprimirImagen(file, maxWidth = 900, maxHeight = 900, calidad = 0.72) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.onload = () => {
          let { width, height } = img;
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo comprimir la imagen'))),
            'image/jpeg',
            calidad
          );
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  blobToURL(blob) {
    if (!blob) return '';
    return URL.createObjectURL(blob);
  },

  /** Suma total de unidades a partir del objeto de talles { "1": 3, "2": 5 } */
  totalTalles(talles) {
    if (!talles) return 0;
    return Object.values(talles).reduce((acc, n) => acc + (Number(n) || 0), 0);
  },

  slug(str) {
    return (str || '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  },

  toast(mensaje, tipo = 'info') {
    const cont = document.getElementById('toast-container');
    if (!cont) return alert(mensaje);
    const el = document.createElement('div');
    el.className = `toast toast-${tipo}`;
    el.textContent = mensaje;
    cont.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, 2600);
  }
};

window.Utils = Utils;
