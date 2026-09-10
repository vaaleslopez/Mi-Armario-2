/**
 * database.js
 * Capa de acceso a datos con IndexedDB.
 * Todos los demás módulos (inventory, sales, customers, backup...) pasan
 * por este archivo para leer/escribir. No usar localStorage para datos
 * de negocio (sólo se usa para configuraciones muy pequeñas si hace falta).
 */

const DB_NAME = 'MiArmarioDB';
const DB_VERSION = 1;

const STORES = {
  PRODUCTS: 'products',
  MOVEMENTS: 'movements',
  SALES: 'sales',
  CUSTOMERS: 'customers',
  SETTINGS: 'settings'
};

let _dbPromise = null;

/**
 * Abre (o crea) la base de datos. Devuelve una Promise<IDBDatabase>.
 * Se cachea la promesa para no reabrir la conexión cada vez.
 */
function openDB() {
  if (_dbPromise) return _dbPromise;

  _dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORES.PRODUCTS)) {
        const products = db.createObjectStore(STORES.PRODUCTS, {
          keyPath: 'id',
          autoIncrement: true
        });
        products.createIndex('nombre', 'nombre', { unique: false });
        products.createIndex('categoria', 'categoria', { unique: false });
        products.createIndex('codigo', 'codigo', { unique: true });
        products.createIndex('estado', 'estado', { unique: false });
        products.createIndex('marca', 'marca', { unique: false });
        products.createIndex('color', 'color', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.MOVEMENTS)) {
        const movements = db.createObjectStore(STORES.MOVEMENTS, {
          keyPath: 'id',
          autoIncrement: true
        });
        movements.createIndex('productId', 'productId', { unique: false });
        movements.createIndex('fecha', 'fecha', { unique: false });
        movements.createIndex('tipo', 'tipo', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.SALES)) {
        const sales = db.createObjectStore(STORES.SALES, {
          keyPath: 'id',
          autoIncrement: true
        });
        sales.createIndex('fecha', 'fecha', { unique: false });
        sales.createIndex('customerId', 'customerId', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.CUSTOMERS)) {
        const customers = db.createObjectStore(STORES.CUSTOMERS, {
          keyPath: 'id',
          autoIncrement: true
        });
        customers.createIndex('nombre', 'nombre', { unique: false });
        customers.createIndex('telefono', 'telefono', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });

  return _dbPromise;
}

/** Helper genérico para transacciones. */
function tx(storeName, mode = 'readonly') {
  return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const DB = {
  STORES,

  async add(storeName, value) {
    const store = await tx(storeName, 'readwrite');
    return promisifyRequest(store.add(value));
  },

  async put(storeName, value) {
    const store = await tx(storeName, 'readwrite');
    return promisifyRequest(store.put(value));
  },

  async get(storeName, key) {
    const store = await tx(storeName, 'readonly');
    return promisifyRequest(store.get(key));
  },

  async getAll(storeName) {
    const store = await tx(storeName, 'readonly');
    return promisifyRequest(store.getAll());
  },

  async delete(storeName, key) {
    const store = await tx(storeName, 'readwrite');
    return promisifyRequest(store.delete(key));
  },

  async clear(storeName) {
    const store = await tx(storeName, 'readwrite');
    return promisifyRequest(store.clear());
  },

  async getByIndex(storeName, indexName, value) {
    const store = await tx(storeName, 'readonly');
    const index = store.index(indexName);
    return promisifyRequest(index.getAll(value));
  },

  async count(storeName) {
    const store = await tx(storeName, 'readonly');
    return promisifyRequest(store.count());
  },

  /** Reemplaza TODO el contenido de una tabla (usado por backup/restore). */
  async replaceAll(storeName, items) {
    const db = await openDB();
    const t = db.transaction(storeName, 'readwrite');
    const store = t.objectStore(storeName);
    store.clear();
    items.forEach((item) => store.put(item));
    return new Promise((resolve, reject) => {
      t.oncomplete = () => resolve(true);
      t.onerror = () => reject(t.error);
    });
  }
};

window.DB = DB;
