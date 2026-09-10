// Base de datos local
let productos = JSON.parse(localStorage.getItem('productos')) || [];
let fotosTemp = [];

// Elementos del DOM
const modal = document.getElementById('modal');
const form = document.getElementById('formProducto');
const productosContainer = document.getElementById('productos');
const btnAgregar = document.getElementById('btnAgregar');
const btnCancelar = document.getElementById('btnCancelar');
const btnCompartir = document.getElementById('btnCompartir');
const previewFotos = document.getElementById('previewFotos');
const inputFotos = document.getElementById('fotos');

// Filtros
const filtroTipo = document.getElementById('filtroTipo');
const filtroTalle = document.getElementById('filtroTalle');
const filtroGenero = document.getElementById('filtroGenero');

// Abrir modal para agregar
btnAgregar.addEventListener('click', () => {
    form.reset();
    document.getElementById('productoId').value = '';
    document.getElementById('modalTitulo').textContent = 'Agregar Prenda';
    fotosTemp = [];
    previewFotos.innerHTML = '';
    modal.classList.remove('oculto');
});

// Cerrar modal
btnCancelar.addEventListener('click', () => {
    modal.classList.add('oculto');
});

// Preview de fotos
inputFotos.addEventListener('change', (e) => {
    previewFotos.innerHTML = '';
    fotosTemp = [];
    
    Array.from(e.target.files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = document.createElement('img');
            img.src = event.target.result;
            previewFotos.appendChild(img);
            fotosTemp.push(event.target.result);
        };
        reader.readAsDataURL(file);
    });
});

// Guardar producto
form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const id = document.getElementById('productoId').value;
    const producto = {
        id: id || Date.now().toString(),
        nombre: document.getElementById('nombre').value,
        tipo: document.getElementById('tipo').value,
        talle: document.getElementById('talle').value.toUpperCase(),
        genero: document.getElementById('genero').value,
        precio: parseFloat(document.getElementById('precio').value),
        stock: parseInt(document.getElementById('stock').value),
        descripcion: document.getElementById('descripcion').value,
        fotos: fotosTemp.length > 0 ? fotosTemp : (id ? productos.find(p => p.id === id).fotos : [])
    };
    
    if (id) {
        // Editar
        const index = productos.findIndex(p => p.id === id);
        productos[index] = producto;
    } else {
        // Nuevo
        productos.push(producto);
    }
    
    guardarProductos();
    mostrarProductos();
    modal.classList.add('oculto');
});

// Guardar en localStorage
function guardarProductos() {
    localStorage.setItem('productos', JSON.stringify(productos));
}

// Mostrar productos
function mostrarProductos() {
    const productosFiltrados = filtrarProductos();
    
    if (productosFiltrados.length === 0) {
        productosContainer.innerHTML = `
            <div class="empty-state">
                <h3>📦 No hay prendas</h3>
                <p>Agregá tu primera prenda para empezar</p>
            </div>
        `;
        return;
    }
    
    productosContainer.innerHTML = productosFiltrados.map(p => `
        <div class="producto">
            ${p.fotos && p.fotos.length > 0 ? 
                `<img src="${p.fotos[0]}" class="producto-img" alt="${p.nombre}">` : 
                `<div class="producto-img" style="background:#ddd;display:flex;align-items:center;justify-content:center;color:#999;">Sin foto</div>`
            }
            <div class="producto-info">
                <div class="producto-nombre">${p.nombre}</div>
                <div class="producto-detalles">
                    <span class="badge">${p.tipo}</span>
                    <span class="badge">Talle ${p.talle}</span>
                    <span class="badge">${p.genero}</span>
                    <span class="badge badge-stock ${p.stock === 0 ? 'sin-stock' : ''}">Stock: ${p.stock}</span>
                </div>
                <div class="producto-precio">$${p.precio.toLocaleString()}</div>
                ${p.descripcion ? `<div class="producto-desc">${p.descripcion}</div>` : ''}
                <div class="producto-botones">
                    <button class="btn-editar" onclick="editarProducto('${p.id}')">️ Editar</button>
                    <button class="btn-eliminar" onclick="eliminarProducto('${p.id}')">🗑️ Eliminar</button>
                </div>
            </div>
        </div>
    `).join('');
}

// Filtrar productos
function filtrarProductos() {
    return productos.filter(p => {
        const coincideTipo = !filtroTipo.value || p.tipo === filtroTipo.value;
        const coincideTalle = !filtroTalle.value || p.talle === filtroTalle.value.toUpperCase();
        const coincideGenero = !filtroGenero.value || p.genero === filtroGenero.value;
        return coincideTipo && coincideTalle && coincideGenero;
    });
}

// Eventos de filtros
filtroTipo.addEventListener('change', mostrarProductos);
filtroTalle.addEventListener('change', mostrarProductos);
filtroGenero.addEventListener('change', mostrarProductos);

// Editar producto
window.editarProducto = function(id) {
    const p = productos.find(prod => prod.id === id);
    if (!p) return;
    
    document.getElementById('productoId').value = p.id;
    document.getElementById('nombre').value = p.nombre;
    document.getElementById('tipo').value = p.tipo;
    document.getElementById('talle').value = p.talle.toLowerCase();
    document.getElementById('genero').value = p.genero;
    document.getElementById('precio').value = p.precio;
    document.getElementById('stock').value = p.stock;
    document.getElementById('descripcion').value = p.descripcion || '';
    document.getElementById('modalTitulo').textContent = 'Editar Prenda';
    
    fotosTemp = p.fotos || [];
    previewFotos.innerHTML = fotosTemp.map(f => `<img src="${f}">`).join('');
    
    modal.classList.remove('oculto');
};

// Eliminar producto
window.eliminarProducto = function(id) {
    if (confirm('¿Estás seguro de eliminar esta prenda?')) {
        productos = productos.filter(p => p.id !== id);
        guardarProductos();
        mostrarProductos();
    }
};

// Compartir productos filtrados
btnCompartir.addEventListener('click', async () => {
    const productosFiltrados = filtrarProductos();
    
    if (productosFiltrados.length === 0) {
        alert('No hay prendas para compartir con estos filtros');
        return;
    }
    
    // Crear texto con la info
    let texto = '🛍️ *MI STOCK DE ROPA*\n\n';
    
    productosFiltrados.forEach((p, i) => {
        texto += `${i + 1}. *${p.nombre}*\n`;
        texto += `   📏 Talle: ${p.talle}\n`;
        texto += `   💰 Precio: $${p.precio.toLocaleString()}\n`;
        texto += `   📦 Stock: ${p.stock}\n`;
        if (p.descripcion) texto += `   📝 ${p.descripcion}\n`;
        texto += '\n';
    });
    
    texto += `\n¡Consultame por cualquier prenda! 😊`;
    
    // Intentar compartir con Web Share API
    if (navigator.share) {
        try {
            // Si hay fotos, intentar compartir con archivos
            if (productosFiltrados[0].fotos && productosFiltrados[0].fotos.length > 0) {
                const archivos = [];
                for (const p of productosFiltrados.slice(0, 5)) {
                    if (p.fotos && p.fotos[0]) {
                        const response = await fetch(p.fotos[0]);
                        const blob = await response.blob();
                        archivos.push(new File([blob], `${p.nombre}.jpg`, { type: 'image/jpeg' }));
                    }
                }
                
                if (archivos.length > 0) {
                    await navigator.share({
                        title: 'Mi Stock de Ropa',
                        text: texto,
                        files: archivos
                    });
                    return;
                }
            }
            
            // Si no hay fotos o falla, compartir solo texto
            await navigator.share({
                title: 'Mi Stock de Ropa',
                text: texto
            });
        } catch (err) {
            if (err.name !== 'AbortError') {
                copiarAlPortapapeles(texto);
            }
        }
    } else {
        copiarAlPortapapeles(texto);
    }
});

function copiarAlPortapapeles(texto) {
    const textarea = document.createElement('textarea');
    textarea.value = texto;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    alert('✅ Info copiada al portapapeles. Podés pegarla en WhatsApp o donde quieras!');
}

// Inicializar
mostrarProductos();
