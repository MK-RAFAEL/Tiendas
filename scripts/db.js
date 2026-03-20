(function initMakeupByLalaDatabase() {
  const DB_NAME = "MakeupByLalaDB";
  const DB_VERSION = 1;
  const APP_STATE_STORE = "app_state";
  const ORDERS_STORE = "orders";
  const FALLBACK_STATE_KEY = "makeupByLalaStoreState";
  const FALLBACK_ORDERS_KEY = "makeupByLalaOrders";

  let dbPromise = null;
  let mode = "Cargando";
  let ready = false;

  function parseJson(value, fallbackValue) {
    try {
      return value ? JSON.parse(value) : fallbackValue;
    } catch (error) {
      return fallbackValue;
    }
  }

  function openDatabase() {
    if (dbPromise) return dbPromise;

    if (!("indexedDB" in window)) {
      mode = "Respaldo local";
      ready = true;
      dbPromise = Promise.resolve(null);
      return dbPromise;
    }

    dbPromise = new Promise((resolve) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const database = event.target.result;

        if (!database.objectStoreNames.contains(APP_STATE_STORE)) {
          database.createObjectStore(APP_STATE_STORE, { keyPath: "id" });
        }

        if (!database.objectStoreNames.contains(ORDERS_STORE)) {
          const orderStore = database.createObjectStore(ORDERS_STORE, { keyPath: "id" });
          orderStore.createIndex("updatedAt", "updatedAt", { unique: false });
          orderStore.createIndex("status", "status", { unique: false });
        }
      };

      request.onsuccess = () => {
        mode = "IndexedDB";
        ready = true;
        resolve(request.result);
      };

      request.onerror = () => {
        mode = "Respaldo local";
        ready = true;
        resolve(null);
      };
    });

    return dbPromise;
  }

  function runTransaction(storeName, transactionMode, handler) {
    return openDatabase().then((database) => {
      if (!database) return null;

      return new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, transactionMode);
        const store = transaction.objectStore(storeName);
        const request = handler(store);

        transaction.oncomplete = () => resolve(request ? request.result : null);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    });
  }

  function readFallbackState() {
    return parseJson(window.localStorage.getItem(FALLBACK_STATE_KEY), null);
  }

  function writeFallbackState(state) {
    window.localStorage.setItem(FALLBACK_STATE_KEY, JSON.stringify(state));
  }

  function readFallbackOrders() {
    return parseJson(window.localStorage.getItem(FALLBACK_ORDERS_KEY), []);
  }

  function writeFallbackOrders(orders) {
    window.localStorage.setItem(FALLBACK_ORDERS_KEY, JSON.stringify(orders));
  }

  async function loadAppState() {
    const database = await openDatabase();

    if (!database) {
      return readFallbackState();
    }

    try {
      const saved = await runTransaction(APP_STATE_STORE, "readonly", (store) => store.get("main"));
      if (saved && saved.payload) {
        return saved.payload;
      }

      const fallbackState = readFallbackState();
      if (fallbackState) {
        await saveAppState(fallbackState);
        return fallbackState;
      }

      return null;
    } catch (error) {
      mode = "Respaldo local";
      return readFallbackState();
    }
  }

  async function saveAppState(payload) {
    const cleanPayload = structuredClone(payload);
    writeFallbackState(cleanPayload);

    const database = await openDatabase();
    if (!database) return cleanPayload;

    const record = {
      id: "main",
      payload: cleanPayload,
      updatedAt: new Date().toISOString()
    };

    try {
      await runTransaction(APP_STATE_STORE, "readwrite", (store) => store.put(record));
    } catch (error) {
      mode = "Respaldo local";
    }

    return cleanPayload;
  }

  async function listOrders() {
    const database = await openDatabase();

    if (!database) {
      return readFallbackOrders()
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    }

    try {
      const records = await runTransaction(ORDERS_STORE, "readonly", (store) => store.getAll());
      return (records || [])
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    } catch (error) {
      mode = "Respaldo local";
      return readFallbackOrders()
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    }
  }

  async function getOrder(orderId) {
    const database = await openDatabase();

    if (!database) {
      return readFallbackOrders().find((order) => order.id === orderId) || null;
    }

    try {
      return await runTransaction(ORDERS_STORE, "readonly", (store) => store.get(orderId));
    } catch (error) {
      mode = "Respaldo local";
      return readFallbackOrders().find((order) => order.id === orderId) || null;
    }
  }

  async function upsertOrder(orderRecord) {
    const payload = structuredClone(orderRecord);
    const fallbackOrders = readFallbackOrders();
    const existingIndex = fallbackOrders.findIndex((order) => order.id === payload.id);

    if (existingIndex >= 0) {
      fallbackOrders[existingIndex] = payload;
    } else {
      fallbackOrders.push(payload);
    }

    writeFallbackOrders(fallbackOrders);

    const database = await openDatabase();
    if (!database) return payload;

    try {
      await runTransaction(ORDERS_STORE, "readwrite", (store) => store.put(payload));
    } catch (error) {
      mode = "Respaldo local";
    }

    return payload;
  }

  async function exportBackup() {
    const [appState, orders] = await Promise.all([loadAppState(), listOrders()]);
    return {
      exportedAt: new Date().toISOString(),
      mode,
      appState,
      orders
    };
  }

  window.makeupDb = {
    init: openDatabase,
    loadAppState,
    saveAppState,
    listOrders,
    getOrder,
    upsertOrder,
    exportBackup,
    getMode: () => mode,
    isReady: () => ready
  };
})();
