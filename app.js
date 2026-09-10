/**
 * app.js
 * Punto de entrada. Inicializa la base de datos, registra el service worker
 * y arranca la interfaz.
 */

(async function init() {
  try {
    await DB.get(DB.STORES.SETTINGS, 'init'); // fuerza apertura/creación de la DB
  } catch (err) {
    console.error('Error inicializando la base de datos', err);
  }

  // Aplicar tema guardado (claro/oscuro) antes de pintar la interfaz
  try {
    const temaGuardado = await DB.get(DB.STORES.SETTINGS, 'theme');
    if (temaGuardado?.value === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch (err) {
    // sin preferencia guardada todavía, se usa el tema claro por defecto
  }

  UI.init();

  // Atajos del ícono de la app (manifest.json → "shortcuts")
  const params = new URLSearchParams(window.location.search);
  const accion = params.get('accion');
  if (accion === 'nueva-venta') {
    UI.abrirFormularioVenta();
  } else if (accion === 'nueva-prenda') {
    UI.abrirFormularioProducto();
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch((err) => {
        console.warn('No se pudo registrar el service worker', err);
      });
    });
  }

  // Aviso de instalación PWA
  let deferredPrompt;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btn = document.getElementById('btn-install');
    if (btn) {
      btn.hidden = false;
      btn.onclick = async () => {
        btn.hidden = true;
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
      };
    }
  });
})();
