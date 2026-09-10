/**
 * ui.js
 * Renderizado de vistas, modales y navegación inferior.
 * No contiene lógica de datos (eso vive en inventory/sales/customers/etc),
 * sólo arma el DOM y conecta eventos.
 */

const UI = {
  viewContainer: null,
  modalRoot: null,
  currentView: 'dashboard',
  categoriasSugeridas: ['Body', 'Conjunto', 'Remera', 'Pantalón', 'Vestido', 'Campera', 'Pijama', 'Accesorio', 'Calzado'],

  categoriaIconos: {
    'Body': '👶', 'Conjunto': '🧸', 'Remera': '👕', 'Pantalón': '👖',
    'Vestido': '👗', 'Campera': '🧥', 'Pijama': '🌙', 'Accesorio': '🎀', 'Calzado': '👟'
  },
  coloresCategoria: ['coral', 'mint', 'lav', 'amarillo'],

  iconoCategoria(cat) {
    return this.categoriaIconos[cat] || '🧺';
  },

  colorCategoria(cat) {
    if (!cat) return this.coloresCategoria[0];
    let hash = 0;
    for (let i = 0; i < cat.length; i++) hash = (hash * 31 + cat.charCodeAt(i)) % this.coloresCategoria.length;
    return this.coloresCategoria[Math.abs(hash)];
  },

  // ---- Cache de URLs de fotos (evita la fuga de memoria de createObjectURL) ----
  _urlCache: new Map(),

  /** Devuelve una URL reutilizable para un Blob, creándola sólo la primera vez. */
  blobURL(key, blob) {
    if (!blob) return '';
    if (this._urlCache.has(key)) return this._urlCache.get(key);
    const url = URL.createObjectURL(blob);
    this._urlCache.set(key, url);
    return url;
  },

  /** Libera todas las URLs de fotos asociadas a un producto (usar al editar o borrar). */
  revokeProductURLs(id) {
    const prefijo = `p-${id}-`;
    for (const key of [...this._urlCache.keys()]) {
      if (key.startsWith(prefijo)) {
        URL.revokeObjectURL(this._urlCache.get(key));
        this._urlCache.delete(key);
      }
    }
  },

  init() {
    this.viewContainer = document.getElementById('view-container');
    this.modalRoot = document.getElementById('modal-root');
    document.querySelectorAll('.bottom-nav button').forEach((btn) => {
      btn.addEventListener('click', () => this.navigate(btn.dataset.view));
    });
    this.navigate('dashboard');
  },

  navigate(view) {
    this.currentView = view;
    document.querySelectorAll('.bottom-nav button').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });
    const renderers = {
      dashboard: () => this.renderDashboard(),
      products: () => this.renderProducts(),
      sales: () => this.renderSales(),
      customers: () => this.renderCustomers(),
      more: () => this.renderMore()
    };
    (renderers[view] || renderers.dashboard)();
  },

  closeModal() {
    this.modalRoot.innerHTML = '';
  },

  openModal(html) {
    this.modalRoot.innerHTML = `
      <div class="modal-backdrop" id="modal-backdrop">
        <div class="modal-sheet">${html}</div>
      </div>`;
    document.getElementById('modal-backdrop').addEventListener('click', (e) => {
      if (e.target.id === 'modal-backdrop') this.closeModal();
    });
  },

  /**
   * Cartel de confirmación propio (reemplaza confirm() del navegador).
   * Se agrega directo a <body> para poder mostrarse arriba de un modal ya abierto.
   * Uso: if (await UI.confirmar('¿Eliminar esta prenda?')) { ... }
   */
  confirmar(mensaje, textoConfirmar = 'Eliminar') {
    return new Promise((resolve) => {
      const backdrop = document.createElement('div');
      backdrop.className = 'confirm-backdrop';
      backdrop.innerHTML = `
        <div class="confirm-card">
          <p>${mensaje}</p>
          <div class="confirm-actions">
            <button class="btn-secondary" id="confirm-cancel">Cancelar</button>
            <button class="btn-danger" id="confirm-ok">${textoConfirmar}</button>
          </div>
        </div>`;
      document.body.appendChild(backdrop);

      const cerrar = (valor) => {
        backdrop.remove();
        resolve(valor);
      };
      backdrop.addEventListener('click', (e) => { if (e.target === backdrop) cerrar(false); });
      backdrop.querySelector('#confirm-cancel').onclick = () => cerrar(false);
      backdrop.querySelector('#confirm-ok').onclick = () => cerrar(true);
    });
  },

  // ============================================================
  // DASHBOARD
  // ============================================================
  async renderDashboard() {
    const [resumenInv, resumenDia, resumenMes] = await Promise.all([
      Inventory.resumenInventario(),
      Sales.resumenPeriodo('dia'),
      Sales.resumenPeriodo('mes')
    ]);
    const pocoStock = await Inventory.listarConPocoStock();
    const reservasVencidas = await Inventory.listarReservasVencidas();
    const ultimoBackup = await Backup.obtenerUltimoBackup();

    const diasSinBackup = ultimoBackup
      ? Math.floor((Date.now() - new Date(ultimoBackup).getTime()) / 86400000)
      : null;
    const avisoBackup = diasSinBackup === null || diasSinBackup > 7;

    this.viewContainer.innerHTML = `
      <section class="view fade-in">
        <h1 class="view-title">Mi Armario</h1>
        <div class="stat-grid">
          <div class="stat-card accent-coral">
            <span class="stat-value">${resumenInv.totalPrendas}</span>
            <span class="stat-label">Prendas en stock</span>
          </div>
          <div class="stat-card accent-mint">
            <span class="stat-value">${Utils.formatMoney(resumenInv.valorInventario)}</span>
            <span class="stat-label">Valor inventario</span>
          </div>
          <div class="stat-card accent-lav">
            <span class="stat-value">${resumenDia.cantidadVentas}</span>
            <span class="stat-label">Ventas hoy</span>
          </div>
          <div class="stat-card accent-coral">
            <span class="stat-value">${Utils.formatMoney(resumenDia.dineroVendido)}</span>
            <span class="stat-label">Vendido hoy</span>
          </div>
        </div>

        ${pocoStock.length ? `
        <div class="alert-box">
          ⚠️ ${pocoStock.length} producto(s) con poco stock
          <button class="link-btn" id="ver-poco-stock">Ver</button>
        </div>` : ''}

        ${reservasVencidas.length ? `
        <div class="alert-box alert-danger">
          ⏰ ${reservasVencidas.length} reserva(s) vencida(s)
          <button class="link-btn" id="ver-reservas">Ver</button>
        </div>` : ''}

        ${avisoBackup ? `
        <div class="alert-box alert-info">
          💾 ${ultimoBackup ? `Tu última copia fue hace ${diasSinBackup} días` : 'Nunca hiciste una copia de seguridad'}
          <button class="link-btn" id="ver-backup">Hacer ahora</button>
        </div>` : ''}

        <div class="section-block">
          <h2>Accesos rápidos</h2>
          <div class="quick-actions">
            <button class="quick-btn" id="qa-add-product">➕ Nueva prenda</button>
            <button class="quick-btn" id="qa-new-sale">🛒 Nueva venta</button>
            <button class="quick-btn" id="qa-catalog">📋 Catálogo</button>
          </div>
        </div>

        <div class="section-block">
          <h2>Ventas — últimos 7 días</h2>
          <canvas id="chart-ventas" width="320" height="140"></canvas>
        </div>

        ${resumenMes.masVendidos.length ? `
        <div class="section-block">
          <h2>Más vendidos del mes</h2>
          <canvas id="chart-top" width="320" height="${resumenMes.masVendidos.length * 34 + 10}"></canvas>
        </div>` : ''}
      </section>`;

    document.getElementById('qa-add-product').onclick = () => this.abrirFormularioProducto();
    document.getElementById('qa-new-sale').onclick = () => this.abrirFormularioVenta();
    document.getElementById('qa-catalog').onclick = () => this.navigate('more');
    const btnPoco = document.getElementById('ver-poco-stock');
    if (btnPoco) btnPoco.onclick = () => this.navigate('products');
    const btnReservas = document.getElementById('ver-reservas');
    if (btnReservas) btnReservas.onclick = () => this.abrirReservasVencidas(reservasVencidas);
    const btnBackup = document.getElementById('ver-backup');
    if (btnBackup) btnBackup.onclick = () => this.navigate('more');

    this.dibujarGraficoVentas();
    if (resumenMes.masVendidos.length) this.dibujarGraficoTopVendidos(resumenMes.masVendidos);
  },

  async dibujarGraficoVentas() {
    const canvas = document.getElementById('chart-ventas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const ventas = await Sales.listarVentas();

    const dias = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dias.push(d);
    }
    const totales = dias.map((d) => ventas
      .filter((v) => new Date(v.fecha).toDateString() === d.toDateString())
      .reduce((acc, v) => acc + v.total, 0));

    const max = Math.max(...totales, 1);
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const barWidth = w / dias.length - 12;

    dias.forEach((d, i) => {
      const barHeight = (totales[i] / max) * (h - 30);
      const x = i * (w / dias.length) + 6;
      const y = h - barHeight - 20;
      ctx.fillStyle = '#F4A896';
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 6);
      ctx.fill();
      ctx.fillStyle = '#6b6560';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(d.toLocaleDateString('es-AR', { weekday: 'short' }), x + barWidth / 2, h - 6);
    });
  },

  dibujarGraficoTopVendidos(masVendidos) {
    const canvas = document.getElementById('chart-top');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const max = Math.max(...masVendidos.map((m) => m.cantidad), 1);
    const rowHeight = 30;
    const labelWidth = 110;

    masVendidos.forEach((item, i) => {
      const y = i * (rowHeight + 4) + 4;
      const barMaxWidth = w - labelWidth - 40;
      const barWidth = (item.cantidad / max) * barMaxWidth;

      ctx.fillStyle = '#3D3A3A';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';
      const nombreCorto = item.nombre.length > 16 ? item.nombre.slice(0, 15) + '…' : item.nombre;
      ctx.fillText(nombreCorto, 0, y + rowHeight / 2 + 4);

      ctx.fillStyle = '#A8D5BA';
      ctx.beginPath();
      ctx.roundRect(labelWidth, y, Math.max(barWidth, 2), rowHeight - 8, 6);
      ctx.fill();

      ctx.fillStyle = '#3D3A3A';
      ctx.textAlign = 'left';
      ctx.fillText(String(item.cantidad), labelWidth + barWidth + 8, y + rowHeight / 2 + 4);
    });
  },

  async abrirReservasVencidas(reservas) {
    this.openModal(`
      <div class="modal-header">
        <h2>Reservas vencidas</h2>
        <button class="close-btn" onclick="UI.closeModal()">✕</button>
      </div>
      <div class="detalle-producto">
        ${reservas.map((p) => `
          <div class="sale-row" data-id="${p.id}">
            <div>
              <strong>${p.nombre}</strong>
              <span class="muted">vencía el ${Utils.formatDate(p.reservaHasta)}</span>
            </div>
          </div>`).join('')}
      </div>`);
    document.querySelectorAll('#modal-root .sale-row').forEach((row) => {
      row.addEventListener('click', () => this.abrirDetalleProducto(Number(row.dataset.id)));
    });
  },

  // ============================================================
  // PRODUCTOS
  // ============================================================
  async renderProducts() {
    const productos = await Inventory.listarProductos();
    const categorias = Filters.categoriasUnicas(productos);

    this.viewContainer.innerHTML = `
      <section class="view fade-in">
        <div class="view-header">
          <h1 class="view-title">Productos</h1>
          <button class="fab-inline" id="btn-add-product">➕</button>
        </div>
        <input type="search" id="search-products" class="search-input" placeholder="Buscar por nombre, talle, color, código...">
        <div class="chip-row" id="chip-filters">
          <button class="chip active" data-filter="todos">Todos</button>
          <button class="chip" data-filter="disponibles">Disponibles</button>
          <button class="chip" data-filter="pocoStock">Poco stock</button>
          <button class="chip" data-filter="vendidos">Vendidos</button>
          ${categorias.map((c) => `<button class="chip" data-filter="cat:${c}">${this.iconoCategoria(c)} ${c}</button>`).join('')}
        </div>
        <div id="product-list" class="product-grid"></div>
        <div id="product-list-more" class="ver-mas-container"></div>
      </section>`;

    document.getElementById('btn-add-product').onclick = () => this.abrirFormularioProducto();

    const PAGE_SIZE = 30;
    let filtroActivo = 'todos';
    let listaFiltrada = productos;
    let visibles = PAGE_SIZE;

    const pintar = () => {
      this.pintarListaProductos(listaFiltrada.slice(0, visibles));
      const moreCont = document.getElementById('product-list-more');
      if (listaFiltrada.length > visibles) {
        moreCont.innerHTML = `<button class="btn-secondary" id="btn-ver-mas-productos">Ver más (${listaFiltrada.length - visibles} restantes)</button>`;
        document.getElementById('btn-ver-mas-productos').onclick = () => {
          visibles += PAGE_SIZE;
          pintar();
        };
      } else {
        moreCont.innerHTML = '';
      }
    };

    const aplicarFiltro = () => {
      let lista = productos;
      const texto = document.getElementById('search-products').value;
      lista = Filters.buscar(lista, texto);
      if (filtroActivo === 'disponibles') lista = Filters.aplicarFiltros(lista, { disponibles: true });
      else if (filtroActivo === 'pocoStock') lista = Filters.aplicarFiltros(lista, { pocoStock: true });
      else if (filtroActivo === 'vendidos') lista = Filters.aplicarFiltros(lista, { vendidos: true });
      else if (filtroActivo.startsWith('cat:')) lista = Filters.aplicarFiltros(lista, { categoria: filtroActivo.slice(4) });
      listaFiltrada = lista;
      visibles = PAGE_SIZE;
      pintar();
    };

    document.getElementById('search-products').addEventListener('input', Utils.debounce(aplicarFiltro, 200));
    document.querySelectorAll('#chip-filters .chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#chip-filters .chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        filtroActivo = chip.dataset.filter;
        aplicarFiltro();
      });
    });

    aplicarFiltro();
  },

  pintarListaProductos(productos) {
    const cont = document.getElementById('product-list');
    if (!productos.length) {
      cont.innerHTML = `<div class="empty-state">No hay prendas para mostrar. Agregá la primera con el botón ➕.</div>`;
      return;
    }
    cont.innerHTML = productos.map((p) => this._cardProducto(p)).join('');
    cont.querySelectorAll('.product-card').forEach((card) => {
      card.addEventListener('click', () => this.abrirDetalleProducto(Number(card.dataset.id)));
    });
  },

  _cardProducto(p) {
    const total = Utils.totalTalles(p.talles);
    const nivel = total === 0 ? 'sin-stock' : total <= 2 ? 'poco-stock' : 'con-stock';
    const foto = p.fotoPrincipal ? this.blobURL(`p-${p.id}-main`, p.fotoPrincipal) : '';
    const vencida = p.estado === 'Reservado' && p.reservaHasta && new Date(p.reservaHasta) < new Date();
    return `
      <div class="product-card" data-id="${p.id}">
        <div class="product-photo ${nivel}">
          ${foto ? `<img src="${foto}" alt="${p.nombre}">` : `<span class="placeholder-icon">${this.iconoCategoria(p.categoria)}</span>`}
          <span class="badge badge-${nivel}">${total}</span>
          ${p.estado === 'Reservado' ? `<span class="badge-estado ${vencida ? 'vencida' : ''}">⏰ ${vencida ? 'Vencida' : 'Reservado'}</span>` : ''}
          ${p.estado === 'Vendido' ? `<span class="badge-estado">✔️ Vendido</span>` : ''}
        </div>
        <div class="product-info">
          <strong>${p.nombre}</strong>
          <span class="muted cat-tag cat-${this.colorCategoria(p.categoria)}">${this.iconoCategoria(p.categoria)} ${p.categoria || 'Sin categoría'}</span>
          <span class="price">${Utils.formatMoney(p.precioVenta)}</span>
        </div>
      </div>`;
  },

  tallesPresets: {
    meses: ['RN', '0-3 m', '3-6 m', '6-9 m', '9-12 m', '12-18 m', '18-24 m', '2 años', '3 años'],
    numeros: ['0', '1', '2', '3', '4', '5', '6', '8', '10', '12', '14', '16']
  },

  abrirFormularioProducto(producto = null) {
    const esEdicion = !!producto;
    const tallesState = { ...(producto?.talles || {}) };
    const fotosExtra = [...(producto?.fotos || [])];

    this.openModal(`
      <div class="modal-header">
        <h2>${esEdicion ? 'Editar prenda' : 'Nueva prenda'}</h2>
        <button class="close-btn" onclick="UI.closeModal()">✕</button>
      </div>
      <form id="form-product" class="modal-form">
        <label>Foto principal
          <input type="file" accept="image/*" capture="environment" id="input-foto">
        </label>
        <div id="foto-preview" class="foto-preview">${producto?.fotoPrincipal ? `<img src="${Utils.blobToURL(producto.fotoPrincipal)}">` : ''}</div>

        <label>Fotos adicionales (opcional)
          <input type="file" accept="image/*" multiple id="input-fotos-extra">
        </label>
        <div id="fotos-extra-preview" class="fotos-extra-preview"></div>

        <label>Nombre *
          <input type="text" id="f-nombre" required value="${producto?.nombre || ''}" placeholder="Ej: Conjunto dinosaurio">
        </label>

        <label>Categoría
          <input type="text" id="f-categoria" list="lista-categorias" value="${producto?.categoria || ''}">
          <datalist id="lista-categorias">
            ${this.categoriasSugeridas.map((c) => `<option value="${c}">`).join('')}
          </datalist>
        </label>

        <div class="row-2">
          <label>Color
            <input type="text" id="f-color" value="${producto?.color || ''}">
          </label>
          <label>Marca
            <input type="text" id="f-marca" value="${producto?.marca || ''}">
          </label>
        </div>

        <label>Temporada
          <select id="f-temporada">
            ${['Verano', 'Invierno', 'Todo el año'].map((t) => `<option ${producto?.temporada === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </label>

        <label>Descripción
          <textarea id="f-descripcion" rows="2">${producto?.descripcion || ''}</textarea>
        </label>

        <div class="row-2">
          <label>Precio costo
            <input type="number" id="f-costo" min="0" value="${producto?.precioCosto || ''}">
          </label>
          <label>Precio venta
            <input type="number" id="f-venta" min="0" value="${producto?.precioVenta || ''}">
          </label>
        </div>
        <p class="margen-preview" id="margen-preview">Margen: —</p>

        <fieldset class="talles-fieldset">
          <legend>Stock por talle</legend>
          <div class="talle-tabs">
            <button type="button" class="chip talle-tab active" data-preset="meses">Por meses</button>
            <button type="button" class="chip talle-tab" data-preset="numeros">Por número</button>
            <button type="button" class="chip talle-tab" data-preset="custom">Personalizado</button>
          </div>
          <div id="talle-preset-buttons" class="talle-preset-row"></div>
          <div id="talles-editor" class="talles-editor"></div>
          <div class="talle-add-row" id="talle-add-row-custom" hidden>
            <input type="text" id="talle-custom-input" placeholder="Ej: Único, S, 3-6 meses...">
            <button type="button" id="btn-add-talle-custom" class="btn-secondary">➕</button>
          </div>
        </fieldset>

        <button type="submit" class="btn-primary">${esEdicion ? 'Guardar cambios' : 'Crear prenda'}</button>
      </form>`);

    // ---- Margen en vivo ----
    const costoInput = document.getElementById('f-costo');
    const ventaInput = document.getElementById('f-venta');
    const margenEl = document.getElementById('margen-preview');
    const actualizarMargen = () => {
      const costo = Number(costoInput.value) || 0;
      const venta = Number(ventaInput.value) || 0;
      if (!costo && !venta) { margenEl.textContent = 'Margen: —'; return; }
      const margen = Utils.calcularMargen(costo, venta);
      const ganancia = venta - costo;
      margenEl.textContent = `Margen: ${margen}% (ganás ${Utils.formatMoney(ganancia)} por unidad)`;
    };
    costoInput.addEventListener('input', actualizarMargen);
    ventaInput.addEventListener('input', actualizarMargen);
    actualizarMargen();

    // ---- Editor dinámico de talles (meses / números / personalizado) ----
    const editorEl = document.getElementById('talles-editor');
    const presetButtonsEl = document.getElementById('talle-preset-buttons');
    const customRowEl = document.getElementById('talle-add-row-custom');

    const renderTallesEditor = () => {
      const entradas = Object.entries(tallesState);
      editorEl.innerHTML = entradas.length
        ? entradas.map(([talle, cantidad]) => `
            <div class="talle-row">
              <span class="talle-row-label">${talle}</span>
              <input type="number" min="0" class="talle-row-input" data-talle-key="${talle}" value="${cantidad || 0}">
              <button type="button" class="talle-remove" data-remove="${talle}" aria-label="Quitar talle ${talle}">✕</button>
            </div>`).join('')
        : `<p class="muted talle-empty">Elegí un talle abajo o agregá uno personalizado.</p>`;

      editorEl.querySelectorAll('.talle-row-input').forEach((input) => {
        input.addEventListener('input', () => {
          tallesState[input.dataset.talleKey] = Number(input.value) || 0;
        });
      });
      editorEl.querySelectorAll('.talle-remove').forEach((btn) => {
        btn.addEventListener('click', () => {
          delete tallesState[btn.dataset.remove];
          renderTallesEditor();
          renderPresetButtons(document.querySelector('.talle-tab.active').dataset.preset);
        });
      });
    };

    const agregarTalle = (label) => {
      if (!label || tallesState.hasOwnProperty(label)) return;
      tallesState[label] = 0;
      renderTallesEditor();
    };

    const renderPresetButtons = (preset) => {
      if (preset === 'custom') {
        presetButtonsEl.innerHTML = '';
        customRowEl.hidden = false;
        return;
      }
      customRowEl.hidden = true;
      const lista = this.tallesPresets[preset] || [];
      presetButtonsEl.innerHTML = lista.map((t) => `
        <button type="button" class="talle-preset-btn ${tallesState.hasOwnProperty(t) ? 'added' : ''}" data-add="${t}">${t}</button>
      `).join('');
      presetButtonsEl.querySelectorAll('[data-add]').forEach((btn) => {
        btn.addEventListener('click', () => {
          agregarTalle(btn.dataset.add);
          renderPresetButtons(preset);
        });
      });
    };

    document.querySelectorAll('.talle-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.talle-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        renderPresetButtons(tab.dataset.preset);
      });
    });
    document.getElementById('btn-add-talle-custom').addEventListener('click', () => {
      const input = document.getElementById('talle-custom-input');
      const label = input.value.trim();
      if (!label) return;
      agregarTalle(label);
      input.value = '';
      input.focus();
    });
    document.getElementById('talle-custom-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('btn-add-talle-custom').click();
      }
    });

    renderTallesEditor();
    renderPresetButtons('meses');

    // ---- Foto principal ----
    let fotoBlob = producto?.fotoPrincipal || null;
    document.getElementById('input-foto').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      fotoBlob = await Utils.comprimirImagen(file);
      document.getElementById('foto-preview').innerHTML = `<img src="${Utils.blobToURL(fotoBlob)}">`;
    });

    // ---- Fotos adicionales ----
    const pintarFotosExtra = () => {
      const cont = document.getElementById('fotos-extra-preview');
      cont.innerHTML = fotosExtra.map((blob, i) => `
        <div class="foto-extra-item">
          <img src="${Utils.blobToURL(blob)}">
          <button type="button" class="foto-extra-remove" data-i="${i}">✕</button>
        </div>`).join('');
      cont.querySelectorAll('.foto-extra-remove').forEach((btn) => {
        btn.addEventListener('click', () => {
          fotosExtra.splice(Number(btn.dataset.i), 1);
          pintarFotosExtra();
        });
      });
    };
    pintarFotosExtra();

    document.getElementById('input-fotos-extra').addEventListener('change', async (e) => {
      const files = [...e.target.files];
      for (const file of files) {
        const blob = await Utils.comprimirImagen(file);
        fotosExtra.push(blob);
      }
      pintarFotosExtra();
      e.target.value = '';
    });

    document.getElementById('form-product').addEventListener('submit', async (e) => {
      e.preventDefault();
      const nuevosTalles = {};
      Object.entries(tallesState).forEach(([talle, cantidad]) => {
        const val = Number(cantidad) || 0;
        if (val > 0) nuevosTalles[talle] = val;
      });

      const data = {
        nombre: document.getElementById('f-nombre').value.trim(),
        categoria: document.getElementById('f-categoria').value.trim(),
        color: document.getElementById('f-color').value.trim(),
        marca: document.getElementById('f-marca').value.trim(),
        temporada: document.getElementById('f-temporada').value,
        descripcion: document.getElementById('f-descripcion').value.trim(),
        precioCosto: Number(document.getElementById('f-costo').value) || 0,
        precioVenta: Number(document.getElementById('f-venta').value) || 0,
        talles: nuevosTalles,
        fotoPrincipal: fotoBlob,
        fotos: fotosExtra
      };

      try {
        if (esEdicion) {
          await Inventory.actualizarProducto(producto.id, data);
          this.revokeProductURLs(producto.id);
          Utils.toast('Prenda actualizada');
        } else {
          await Inventory.crearProducto(data);
          Utils.toast('Prenda creada');
        }
        this.closeModal();
        this.navigate('products');
      } catch (err) {
        Utils.toast(err.message, 'error');
      }
    });
  },

  async abrirDetalleProducto(id) {
    const p = await Inventory.obtenerProducto(id);
    if (!p) return;
    const talles = Object.entries(p.talles || {}).filter(([, c]) => c > 0);
    const fotos = [p.fotoPrincipal, ...(p.fotos || [])].filter(Boolean);
    const vencida = p.estado === 'Reservado' && p.reservaHasta && new Date(p.reservaHasta) < new Date();

    this.openModal(`
      <div class="modal-header">
        <h2>${p.nombre}</h2>
        <button class="close-btn" onclick="UI.closeModal()">✕</button>
      </div>
      <div class="detalle-producto">
        ${fotos.length ? `
        <div class="foto-carousel">
          ${fotos.map((f, i) => `<img src="${this.blobURL(`p-${p.id}-foto-${i}`, f)}">`).join('')}
        </div>` : ''}
        <p class="muted cat-tag cat-${this.colorCategoria(p.categoria)}">${this.iconoCategoria(p.categoria)} ${p.categoria || ''} · ${p.marca || ''} · ${p.color || ''}</p>
        <p>${p.descripcion || ''}</p>
        <p><strong>${Utils.formatMoney(p.precioVenta)}</strong> · costo ${Utils.formatMoney(p.precioCosto)} · margen ${p.margen}%</p>
        <p>Código: ${p.codigo} · Estado: <strong>${p.estado}</strong>
          ${p.estado === 'Reservado' && p.reservaHasta ? `<span class="${vencida ? 'texto-danger' : 'muted'}"> (hasta ${Utils.formatDate(p.reservaHasta)}${vencida ? ' — vencida' : ''})</span>` : ''}
        </p>
        <div class="talles-list">
          ${talles.length ? talles.map(([t, c]) => `<span class="talle-pill">Talle ${t}: ${c}</span>`).join('') : '<span class="muted">Sin stock</span>'}
        </div>
        <div class="detalle-actions">
          <button class="btn-secondary" id="btn-sell-product">🛒 Vender</button>
          <button class="btn-secondary" id="btn-edit-product">✏️ Editar</button>
          <button class="btn-secondary" id="btn-share-product">📤 Compartir</button>
          <button class="btn-secondary" id="btn-stock-product">📦 Stock</button>
          <button class="btn-secondary" id="btn-movements-product">📜 Movimientos</button>
          <button class="btn-secondary" id="btn-duplicate-product">🧬 Duplicar</button>
          ${p.estado === 'Reservado'
            ? `<button class="btn-secondary" id="btn-cancel-reserva">↩️ Cancelar reserva</button>`
            : `<button class="btn-secondary" id="btn-reservar-product">⏰ Reservar</button>`}
          <button class="btn-danger" id="btn-delete-product">🗑️</button>
        </div>
      </div>`);

    document.getElementById('btn-sell-product').onclick = () => this.abrirFormularioVenta(p);
    document.getElementById('btn-edit-product').onclick = () => this.abrirFormularioProducto(p);
    document.getElementById('btn-share-product').onclick = () => Share.compartirProducto(p);
    document.getElementById('btn-stock-product').onclick = () => this.abrirAjusteStock(p);
    document.getElementById('btn-movements-product').onclick = () => this.abrirMovimientos(p);
    document.getElementById('btn-duplicate-product').onclick = () => this.duplicarYEditar(p);

    const btnReservar = document.getElementById('btn-reservar-product');
    if (btnReservar) btnReservar.onclick = () => this.abrirReserva(p);
    const btnCancelarReserva = document.getElementById('btn-cancel-reserva');
    if (btnCancelarReserva) btnCancelarReserva.onclick = async () => {
      await Inventory.cancelarReserva(p.id);
      Utils.toast('Reserva cancelada');
      this.closeModal();
      this.navigate('products');
    };

    document.getElementById('btn-delete-product').onclick = async () => {
      if (await UI.confirmar('¿Eliminar esta prenda? Esta acción no se puede deshacer.')) {
        await Inventory.eliminarProducto(p.id);
        this.revokeProductURLs(p.id);
        this.closeModal();
        this.navigate('products');
      }
    };
  },

  /**
   * Duplica un producto: abre el formulario de "nueva prenda" ya precargado
   * con los mismos datos (nombre, categoría, fotos, precios), pero sin talles
   * cargados (el stock de la copia se carga aparte) y con código nuevo.
   * Útil para variantes de color/diseño de una misma prenda.
   */
  duplicarYEditar(producto) {
    const copia = {
      ...producto,
      id: undefined,
      codigo: undefined,
      nombre: producto.nombre + ' (copia)',
      talles: {},
      estado: 'Disponible',
      reservaHasta: null
    };
    this.closeModal();
    this.abrirFormularioProducto(copia);
    Utils.toast('Ajustá el nombre y el talle/stock de la copia');
  },

  abrirReserva(producto) {
    const hoy = new Date().toISOString().slice(0, 10);
    this.openModal(`
      <div class="modal-header">
        <h2>Reservar — ${producto.nombre}</h2>
        <button class="close-btn" onclick="UI.closeModal()">✕</button>
      </div>
      <form id="form-reserva" class="modal-form">
        <label>Reservado hasta
          <input type="date" id="r-fecha" min="${hoy}" value="${hoy}" required>
        </label>
        <label>Nota
          <input type="text" id="r-nota" placeholder="Ej: reservado para Sofía">
        </label>
        <button type="submit" class="btn-primary">Marcar como reservado</button>
      </form>`);

    document.getElementById('form-reserva').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fecha = document.getElementById('r-fecha').value;
      const nota = document.getElementById('r-nota').value.trim();
      await Inventory.marcarComoReservado(producto.id, fecha, nota);
      Utils.toast('Prenda reservada');
      this.closeModal();
      this.navigate('products');
    });
  },

  async abrirMovimientos(producto) {
    const movimientos = (await Inventory.listarMovimientos(producto.id))
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    const iconos = { creacion: '✨', agregado: '➕', quitado: '➖', venta: '🛒', devolucion: '↩️', ajuste: '⚙️' };
    const etiquetas = { creacion: 'Alta', agregado: 'Agregado', quitado: 'Quitado', venta: 'Venta', devolucion: 'Devolución', ajuste: 'Ajuste' };

    this.openModal(`
      <div class="modal-header">
        <h2>Movimientos — ${producto.nombre}</h2>
        <button class="close-btn" onclick="UI.closeModal()">✕</button>
      </div>
      <div class="movimientos-lista">
        ${movimientos.length ? movimientos.map((m) => `
          <div class="movimiento-row">
            <span class="mov-icon">${iconos[m.tipo] || '•'}</span>
            <div class="mov-info">
              <strong>${etiquetas[m.tipo] || m.tipo}${m.talle ? ` · talle ${m.talle}` : ''}</strong>
              <span class="muted">${m.cantidad ? `${m.cantidad} unidad(es) · ` : ''}${Utils.formatDateTime(m.fecha)}</span>
              ${m.nota ? `<span class="muted">${m.nota}</span>` : ''}
            </div>
          </div>`).join('') : '<p class="muted">Todavía no hay movimientos registrados.</p>'}
      </div>`);
  },

  abrirAjusteStock(producto) {
    this.openModal(`
      <div class="modal-header">
        <h2>Ajustar stock — ${producto.nombre}</h2>
        <button class="close-btn" onclick="UI.closeModal()">✕</button>
      </div>
      <form id="form-stock" class="modal-form">
        <label>Talle
          <input type="text" id="s-talle" placeholder="Ej: 2" required>
        </label>
        <label>Cantidad
          <input type="number" id="s-cantidad" min="1" value="1" required>
        </label>
        <label>Nota
          <input type="text" id="s-nota" placeholder="Opcional">
        </label>
        <div class="row-2">
          <button type="button" id="btn-sumar" class="btn-secondary">➕ Agregar</button>
          <button type="button" id="btn-restar" class="btn-secondary">➖ Quitar</button>
        </div>
      </form>`);

    const ejecutar = async (tipo) => {
      const talle = document.getElementById('s-talle').value.trim();
      const cantidad = Number(document.getElementById('s-cantidad').value);
      const nota = document.getElementById('s-nota').value.trim();
      if (!talle || !cantidad) return Utils.toast('Completá talle y cantidad', 'error');
      if (tipo === 'sumar') await Inventory.agregarStock(producto.id, talle, cantidad, nota);
      else await Inventory.quitarStock(producto.id, talle, cantidad, nota);
      Utils.toast('Stock actualizado');
      this.closeModal();
      this.navigate('products');
    };
    document.getElementById('btn-sumar').onclick = () => ejecutar('sumar');
    document.getElementById('btn-restar').onclick = () => ejecutar('restar');
  },

  // ============================================================
  // VENTAS
  // ============================================================
  async renderSales() {
    const [ventas, resumenDia, resumenSemana, resumenMes] = await Promise.all([
      Sales.listarVentas(),
      Sales.resumenPeriodo('dia'),
      Sales.resumenPeriodo('semana'),
      Sales.resumenPeriodo('mes')
    ]);

    this.viewContainer.innerHTML = `
      <section class="view fade-in">
        <div class="view-header">
          <h1 class="view-title">Ventas</h1>
          <button class="fab-inline" id="btn-add-sale">➕</button>
        </div>
        <div class="stat-grid compact">
          <div class="stat-card accent-coral"><span class="stat-value">${Utils.formatMoney(resumenDia.dineroVendido)}</span><span class="stat-label">Hoy</span></div>
          <div class="stat-card accent-mint"><span class="stat-value">${Utils.formatMoney(resumenSemana.dineroVendido)}</span><span class="stat-label">Semana</span></div>
          <div class="stat-card accent-lav"><span class="stat-value">${Utils.formatMoney(resumenMes.dineroVendido)}</span><span class="stat-label">Mes</span></div>
        </div>
        <div id="sales-list" class="sales-list"></div>
      </section>`;

    document.getElementById('btn-add-sale').onclick = () => this.abrirFormularioVenta();

    const cont = document.getElementById('sales-list');
    if (!ventas.length) {
      cont.innerHTML = `<div class="empty-state">Todavía no registraste ventas.</div>`;
      return;
    }
    cont.innerHTML = ventas.map((v) => `
      <div class="sale-row" data-id="${v.id}">
        <div>
          <strong>${Utils.formatMoney(v.total)}</strong>
          <span class="muted">${v.items.length} prenda(s) · ${v.formaPago}</span>
        </div>
        <div class="sale-row-right">
          <span class="muted">${Utils.formatDateTime(v.fecha)}</span>
          <button class="icon-btn" data-edit="${v.id}" aria-label="Editar venta">✏️</button>
          <button class="icon-btn" data-del="${v.id}" aria-label="Eliminar venta">🗑️</button>
        </div>
      </div>`).join('');

    cont.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const venta = await Sales.obtenerVenta(Number(btn.dataset.edit));
        if (venta) this.abrirFormularioVenta(null, venta);
      });
    });

    cont.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!(await UI.confirmar('¿Eliminar esta venta? El stock vendido se devuelve automáticamente al inventario.'))) return;
        await Sales.eliminarVenta(Number(btn.dataset.del));
        Utils.toast('Venta eliminada y stock repuesto');
        this.renderSales();
      });
    });
  },

  /**
   * presetProducto: si se abre desde el detalle de un producto, se agrega directo al carrito.
   * ventaExistente: si se pasa, el formulario edita esa venta en vez de crear una nueva.
   */
  async abrirFormularioVenta(presetProducto = null, ventaExistente = null) {
    let productos = await Inventory.listarProductos();

    // Si estamos editando, las unidades de la venta original todavía "cuentan" como
    // disponibles (se devuelven al guardar), así que las sumamos de vuelta acá para
    // poder mostrarlas y no bloquear la edición por falta de stock.
    if (ventaExistente) {
      for (const item of ventaExistente.items) {
        let p = productos.find((x) => x.id === item.productId);
        if (!p) {
          p = await Inventory.obtenerProducto(item.productId);
          if (p) productos.push(p);
        }
        if (p) {
          p.talles = { ...p.talles };
          p.talles[item.talle] = (Number(p.talles[item.talle]) || 0) + item.cantidad;
        }
      }
    }
    productos = productos.filter((p) => Utils.totalTalles(p.talles) > 0);

    const clientes = await Customers.listarClientes();

    if (!productos.length) {
      Utils.toast('No hay productos con stock disponible', 'error');
      return;
    }

    const carrito = ventaExistente
      ? ventaExistente.items.map((it) => ({
          ...it,
          nombre: (productos.find((p) => p.id === it.productId) || {}).nombre || `#${it.productId}`
        }))
      : [];

    this.openModal(`
      <div class="modal-header">
        <h2>${ventaExistente ? 'Editar venta' : 'Nueva venta'}</h2>
        <button class="close-btn" onclick="UI.closeModal()">✕</button>
      </div>

      <div class="modal-form">
        <label>Producto
          <select id="v-producto">
            ${productos.map((p) => `<option value="${p.id}">${p.nombre} (${Utils.formatMoney(p.precioVenta)})</option>`).join('')}
          </select>
        </label>
        <label>Talle
          <select id="v-talle"></select>
        </label>
        <div class="row-2">
          <label>Cantidad
            <input type="number" id="v-cantidad" min="1" value="1">
          </label>
          <label>Precio unitario
            <input type="number" id="v-precio" min="0">
          </label>
        </div>
        <button type="button" id="btn-add-cart-item" class="btn-secondary">➕ Agregar al carrito</button>

        <div id="carrito-lista" class="carrito-lista"></div>
        <p id="carrito-subtotal" class="carrito-subtotal">Subtotal: ${Utils.formatMoney(0)}</p>

        <label>Cliente (opcional)
          <select id="v-cliente">
            <option value="" ${!ventaExistente?.customerId ? 'selected' : ''}>Sin cliente</option>
            ${clientes.map((c) => `<option value="${c.id}" ${ventaExistente?.customerId === c.id ? 'selected' : ''}>${c.nombre}</option>`).join('')}
          </select>
        </label>
        <label>Forma de pago
          <select id="v-pago">
            ${['Efectivo', 'Transferencia', 'Tarjeta', 'Mercado Pago'].map((f) => `<option ${ventaExistente?.formaPago === f ? 'selected' : ''}>${f}</option>`).join('')}
          </select>
        </label>
        <label>Descuento
          <input type="number" id="v-descuento" min="0" value="${ventaExistente?.descuento || 0}">
        </label>
        <label>Notas
          <input type="text" id="v-notas" value="${ventaExistente?.notas || ''}">
        </label>
        <button type="button" id="btn-registrar-venta" class="btn-primary">${ventaExistente ? 'Guardar cambios' : 'Registrar venta'}</button>
      </div>`);

    const selectProducto = document.getElementById('v-producto');
    const selectTalle = document.getElementById('v-talle');
    const inputCantidad = document.getElementById('v-cantidad');
    const inputPrecio = document.getElementById('v-precio');
    const inputDescuento = document.getElementById('v-descuento');

    const actualizarTalles = () => {
      const p = productos.find((x) => x.id === Number(selectProducto.value));
      if (!p) return;
      const talles = Object.entries(p.talles || {}).filter(([, c]) => c > 0);
      selectTalle.innerHTML = talles.map(([t, c]) => `<option value="${t}">Talle ${t} (${c} disp.)</option>`).join('');
      inputPrecio.value = p.precioVenta;
    };
    selectProducto.addEventListener('change', actualizarTalles);
    actualizarTalles();

    const renderCarrito = () => {
      const cont = document.getElementById('carrito-lista');
      cont.innerHTML = carrito.length
        ? carrito.map((it, i) => `
            <div class="carrito-item">
              <span>${it.nombre} · talle ${it.talle} × ${it.cantidad}</span>
              <span>${Utils.formatMoney(it.precio * it.cantidad)}</span>
              <button type="button" class="talle-remove" data-i="${i}">✕</button>
            </div>`).join('')
        : `<p class="muted talle-empty">El carrito está vacío. Agregá al menos una prenda.</p>`;

      cont.querySelectorAll('[data-i]').forEach((btn) => {
        btn.addEventListener('click', () => {
          carrito.splice(Number(btn.dataset.i), 1);
          renderCarrito();
        });
      });

      const subtotal = carrito.reduce((acc, it) => acc + it.precio * it.cantidad, 0);
      const descuento = Number(inputDescuento.value) || 0;
      document.getElementById('carrito-subtotal').textContent =
        `Subtotal: ${Utils.formatMoney(subtotal)}` + (descuento ? ` · Total: ${Utils.formatMoney(Math.max(0, subtotal - descuento))}` : '');
    };
    inputDescuento.addEventListener('input', renderCarrito);

    document.getElementById('btn-add-cart-item').addEventListener('click', () => {
      const productId = Number(selectProducto.value);
      const p = productos.find((x) => x.id === productId);
      if (!p) return;
      const talle = selectTalle.value;
      const cantidad = Number(inputCantidad.value) || 1;
      const precio = Number(inputPrecio.value) || 0;
      const disponible = Number((p.talles || {})[talle]) || 0;
      const yaEnCarrito = carrito.filter((it) => it.productId === productId && it.talle === talle).reduce((a, it) => a + it.cantidad, 0);

      if (cantidad + yaEnCarrito > disponible) {
        Utils.toast(`Sólo hay ${disponible} disponible(s) en talle ${talle}`, 'error');
        return;
      }
      carrito.push({ productId, nombre: p.nombre, talle, cantidad, precio });
      renderCarrito();
      inputCantidad.value = 1;
    });

    document.getElementById('btn-registrar-venta').addEventListener('click', async () => {
      if (!carrito.length) return Utils.toast('Agregá al menos una prenda al carrito', 'error');
      const data = {
        items: carrito.map(({ productId, talle, cantidad, precio }) => ({ productId, talle, cantidad, precio })),
        customerId: document.getElementById('v-cliente').value ? Number(document.getElementById('v-cliente').value) : null,
        formaPago: document.getElementById('v-pago').value,
        descuento: Number(inputDescuento.value) || 0,
        notas: document.getElementById('v-notas').value.trim()
      };
      try {
        if (ventaExistente) {
          await Sales.actualizarVenta(ventaExistente.id, data);
          Utils.toast('Venta actualizada');
        } else {
          await Sales.registrarVenta(data);
          Utils.toast('Venta registrada');
        }
        this.closeModal();
        this.navigate('sales');
      } catch (err) {
        Utils.toast(err.message, 'error');
      }
    });

    renderCarrito();

    // Si venimos del detalle de un producto, lo pre-cargamos en el carrito.
    if (presetProducto) {
      selectProducto.value = presetProducto.id;
      actualizarTalles();
      document.getElementById('btn-add-cart-item').click();
    }
  },

  // ============================================================
  // CLIENTES
  // ============================================================
  async renderCustomers() {
    const clientes = await Customers.listarClientes();
    this.viewContainer.innerHTML = `
      <section class="view fade-in">
        <div class="view-header">
          <h1 class="view-title">Clientes</h1>
          <button class="fab-inline" id="btn-add-customer">➕</button>
        </div>
        <div id="customer-list" class="customer-list">
          ${clientes.length ? clientes.map((c) => `
            <div class="customer-row" data-id="${c.id}">
              <div>
                <strong>${c.nombre}</strong>
                <span class="muted">${c.telefono || ''}</span>
              </div>
              <button class="icon-btn" data-wa="${c.id}">💬</button>
            </div>`).join('') : '<div class="empty-state">Todavía no cargaste clientes.</div>'}
        </div>
      </section>`;

    document.getElementById('btn-add-customer').onclick = () => this.abrirFormularioCliente();
    document.querySelectorAll('[data-wa]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const c = clientes.find((x) => x.id === Number(btn.dataset.wa));
        Share.abrirWhatsappCliente(c.telefono, `¡Hola ${c.nombre}! 🧸`);
      });
    });
    document.querySelectorAll('.customer-row').forEach((row) => {
      row.addEventListener('click', () => this.abrirDetalleCliente(Number(row.dataset.id)));
    });
  },

  abrirFormularioCliente(cliente = null) {
    this.openModal(`
      <div class="modal-header">
        <h2>${cliente ? 'Editar cliente' : 'Nuevo cliente'}</h2>
        <button class="close-btn" onclick="UI.closeModal()">✕</button>
      </div>
      <form id="form-customer" class="modal-form">
        <label>Nombre *
          <input type="text" id="c-nombre" required value="${cliente?.nombre || ''}">
        </label>
        <label>Teléfono (con código de país, ej: 549...)
          <input type="text" id="c-telefono" value="${cliente?.telefono || ''}">
        </label>
        <label>Dirección
          <input type="text" id="c-direccion" value="${cliente?.direccion || ''}">
        </label>
        <label>Notas
          <textarea id="c-notas" rows="2">${cliente?.notas || ''}</textarea>
        </label>
        <button type="submit" class="btn-primary">${cliente ? 'Guardar' : 'Crear cliente'}</button>
      </form>`);

    document.getElementById('form-customer').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        nombre: document.getElementById('c-nombre').value.trim(),
        telefono: document.getElementById('c-telefono').value.trim(),
        direccion: document.getElementById('c-direccion').value.trim(),
        notas: document.getElementById('c-notas').value.trim()
      };
      if (cliente) await Customers.actualizarCliente(cliente.id, data);
      else await Customers.crearCliente(data);
      Utils.toast('Cliente guardado');
      this.closeModal();
      this.navigate('customers');
    });
  },

  async abrirDetalleCliente(id) {
    const cliente = await Customers.obtenerCliente(id);
    const compras = await Customers.comprasDeCliente(id);
    const totalGastado = compras.reduce((acc, v) => acc + v.total, 0);

    this.openModal(`
      <div class="modal-header">
        <h2>${cliente.nombre}</h2>
        <button class="close-btn" onclick="UI.closeModal()">✕</button>
      </div>
      <div class="detalle-producto">
        <p>${cliente.telefono || ''}</p>
        <p>${cliente.direccion || ''}</p>
        <p class="muted">${cliente.notas || ''}</p>
        <p><strong>${compras.length}</strong> compra(s) · total ${Utils.formatMoney(totalGastado)}</p>
        <div class="detalle-actions">
          <button class="btn-secondary" id="btn-edit-customer">✏️ Editar</button>
          <button class="btn-secondary" id="btn-wa-customer">💬 WhatsApp</button>
          <button class="btn-danger" id="btn-delete-customer">🗑️</button>
        </div>
      </div>`);

    document.getElementById('btn-edit-customer').onclick = () => this.abrirFormularioCliente(cliente);
    document.getElementById('btn-wa-customer').onclick = () => Share.abrirWhatsappCliente(cliente.telefono, `¡Hola ${cliente.nombre}! 🧸`);
    document.getElementById('btn-delete-customer').onclick = async () => {
      if (await UI.confirmar('¿Eliminar este cliente?')) {
        await Customers.eliminarCliente(id);
        this.closeModal();
        this.navigate('customers');
      }
    };
  },

  // ============================================================
  // MÁS (catálogo, backup, estadísticas)
  // ============================================================
  async renderMore() {
    const ultimoBackup = await Backup.obtenerUltimoBackup();
    const productos = await Inventory.listarProductos();
    const categorias = Filters.categoriasUnicas(productos);
    const temaOscuro = document.documentElement.getAttribute('data-theme') === 'dark';

    this.viewContainer.innerHTML = `
      <section class="view fade-in">
        <h1 class="view-title">Más</h1>

        <div class="section-block">
          <h2>Catálogo para clientes</h2>
          <p class="muted">Generá y compartí el catálogo actualizado con el stock disponible.</p>
          <button class="btn-primary" id="btn-generar-catalogo">Generar catálogo</button>
        </div>

        <div class="section-block">
          <h2>Ajustar precios por categoría</h2>
          <p class="muted">Subí o bajá el precio de venta de varios productos a la vez (por ejemplo, +15% en toda una temporada).</p>
          <label>Categoría
            <select id="ap-categoria">
              <option value="">Todas las categorías</option>
              ${categorias.map((c) => `<option value="${c}">${this.iconoCategoria(c)} ${c}</option>`).join('')}
            </select>
          </label>
          <label>Porcentaje (positivo para subir, negativo para bajar)
            <input type="number" id="ap-porcentaje" placeholder="Ej: 15 o -10">
          </label>
          <button class="btn-secondary" id="btn-ajustar-precios">Aplicar ajuste</button>
        </div>

        <div class="section-block">
          <h2>Copia de seguridad</h2>
          <p class="muted">
            ${ultimoBackup ? `Última copia: ${Utils.formatDateTime(ultimoBackup)}` : 'Todavía no hiciste ninguna copia de seguridad.'}
          </p>
          <p class="muted">Exportá tus datos para no perder el inventario si cambiás de celular.</p>
          <div class="row-2">
            <button class="btn-secondary" id="btn-export">⬇️ Exportar</button>
            <label class="btn-secondary file-btn">⬆️ Importar
              <input type="file" id="input-import" accept="application/json" hidden>
            </label>
          </div>
        </div>

        <div class="section-block">
          <h2>Apariencia</h2>
          <label class="switch-row">
            <span>Modo oscuro</span>
            <span class="switch">
              <input type="checkbox" id="toggle-dark" ${temaOscuro ? 'checked' : ''}>
              <span class="switch-slider"></span>
            </span>
          </label>
        </div>
      </section>`;

    document.getElementById('btn-generar-catalogo').onclick = () => this.abrirCatalogo();

    document.getElementById('btn-ajustar-precios').onclick = async () => {
      const categoria = document.getElementById('ap-categoria').value || null;
      const porcentaje = Number(document.getElementById('ap-porcentaje').value);
      if (!porcentaje) return Utils.toast('Ingresá un porcentaje distinto de 0', 'error');
      const etiquetaCategoria = categoria || 'todas las categorías';
      const mensaje = `Esto va a ${porcentaje > 0 ? 'subir' : 'bajar'} un ${Math.abs(porcentaje)}% el precio de venta en ${etiquetaCategoria}. ¿Continuar?`;
      if (!(await UI.confirmar(mensaje, 'Aplicar'))) return;
      const cantidad = await Inventory.ajustarPreciosPorCategoria(categoria, porcentaje);
      Utils.toast(`Precio actualizado en ${cantidad} producto(s)`);
    };

    document.getElementById('btn-export').onclick = async () => {
      await Backup.exportarJSON();
      Utils.toast('Backup exportado');
      this.renderMore();
    };
    document.getElementById('input-import').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!(await UI.confirmar('Importar reemplaza todos los datos actuales. ¿Continuar?', 'Importar'))) return;
      await Backup.importarJSON(file);
      Utils.toast('Backup restaurado');
      this.navigate('dashboard');
    });

    document.getElementById('toggle-dark').addEventListener('change', async (e) => {
      const oscuro = e.target.checked;
      document.documentElement.setAttribute('data-theme', oscuro ? 'dark' : 'light');
      await DB.put(DB.STORES.SETTINGS, { key: 'theme', value: oscuro ? 'dark' : 'light' });
    });
  },

  async abrirCatalogo() {
    const productos = await Catalog.productosParaCatalogo();
    this.openModal(`
      <div class="modal-header">
        <h2>Catálogo (${productos.length})</h2>
        <button class="close-btn" onclick="UI.closeModal()">✕</button>
      </div>
      ${productos.length ? `
      <div class="row-2" style="margin-bottom:10px;">
        <button type="button" class="btn-secondary" id="btn-seleccionar-todos">Seleccionar todos</button>
        <button type="button" class="btn-secondary" id="btn-seleccionar-ninguno">Ninguno</button>
      </div>` : ''}
      <div class="catalogo-lista">
        ${productos.map((p) => `
          <label class="catalogo-item">
            <input type="checkbox" value="${p.id}" checked>
            ${p.nombre} — ${Utils.formatMoney(p.precioVenta)}
          </label>`).join('') || '<p class="muted">No hay productos disponibles.</p>'}
      </div>
      <button class="btn-primary" id="btn-compartir-catalogo">📤 Compartir por WhatsApp</button>`);

    const btnTodos = document.getElementById('btn-seleccionar-todos');
    const btnNinguno = document.getElementById('btn-seleccionar-ninguno');
    if (btnTodos) btnTodos.onclick = () => {
      document.querySelectorAll('.catalogo-item input').forEach((cb) => { cb.checked = true; });
    };
    if (btnNinguno) btnNinguno.onclick = () => {
      document.querySelectorAll('.catalogo-item input').forEach((cb) => { cb.checked = false; });
    };

    document.getElementById('btn-compartir-catalogo').onclick = async () => {
      const ids = [...document.querySelectorAll('.catalogo-item input:checked')].map((i) => Number(i.value));
      const seleccion = productos.filter((p) => ids.includes(p.id));
      await Share.compartirCatalogo(seleccion);
    };
  }
};

window.UI = UI;
