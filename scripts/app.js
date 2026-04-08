const products = Array.isArray(window.catalogProducts) ? window.catalogProducts : [];
const productMap = new Map(products.map((product) => [product.id, product]));
const availableBrands = [...new Set(products.map((product) => product.brand).filter(Boolean))]
  .sort((left, right) => left.localeCompare(right));
const availableBrandSet = new Set(availableBrands);
const brandProductCounts = products.reduce((counts, product) => {
  if (!product.brand) return counts;
  counts[product.brand] = (counts[product.brand] || 0) + 1;
  return counts;
}, {});
const storageKey = "makeupByLalaStoreState";
let catalogVisibleCount = 24;
let catalogSearchDebounceId = 0;
let checkoutInputDebounceId = 0;
let pricingCacheKey = "";
let pricingCacheValue = null;
const performanceMode = {
  lite: Boolean(
    navigator.connection?.saveData
    || (typeof navigator.deviceMemory === "number" && navigator.deviceMemory <= 4)
    || (typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency <= 4)
  )
};

const shippingCountries = [
  {
    name: "Republica Dominicana",
    eta: "1 a 3 dias",
    surcharge: 0,
    note: "Cobertura principal con mejores tiempos, same-day local y opciones de pickup boutique."
  },
  {
    name: "Puerto Rico",
    eta: "2 a 4 dias",
    surcharge: 4,
    note: "Seguimiento disponible y elegibilidad parcial para fulfillment acelerado."
  },
  {
    name: "Mexico",
    eta: "4 a 7 dias",
    surcharge: 6,
    note: "Ideal para pedidos grandes con empaque reforzado y seguimiento digital."
  },
  {
    name: "Colombia",
    eta: "4 a 7 dias",
    surcharge: 7,
    note: "Ventana equilibrada para standard shipping y premium insured."
  },
  {
    name: "Chile",
    eta: "5 a 8 dias",
    surcharge: 8,
    note: "Se recomienda premium insured para compras de ticket alto."
  },
  {
    name: "Peru",
    eta: "5 a 8 dias",
    surcharge: 7,
    note: "Seguimiento digital y confirmacion de despacho por correo."
  },
  {
    name: "Panama",
    eta: "4 a 6 dias",
    surcharge: 5,
    note: "Excelente balance entre rapidez, control de envio y costo."
  },
  {
    name: "Costa Rica",
    eta: "4 a 7 dias",
    surcharge: 6,
    note: "Disponible en standard shipping y premium insured."
  },
  {
    name: "Guatemala",
    eta: "4 a 7 dias",
    surcharge: 6,
    note: "Pedidos disponibles con preparacion beauty-safe y tracking."
  }
];

const localFulfillmentCountries = new Set(["Republica Dominicana", "Puerto Rico"]);

const shippingMethods = {
  standard: {
    label: "Standard shipping",
    base: 12,
    eta: "3 a 7 dias",
    description: "Entrega regular con seguimiento digital y envio gratis en ordenes elegibles."
  },
  "same-day": {
    label: "Same-day delivery",
    base: 22,
    eta: "Mismo dia",
    description: "Entrega prioritaria local inspirada en beauty on demand."
  },
  premium: {
    label: "Premium insured",
    base: 34,
    eta: "2 a 5 dias",
    description: "Cobertura reforzada para ordenes de mayor valor."
  },
  pickup: {
    label: "Buy online & pick up",
    base: 0,
    eta: "Listo el mismo dia",
    description: "Retiro en studio sin costo."
  },
  curbside: {
    label: "Curbside pickup",
    base: 0,
    eta: "Listo en 2 horas",
    description: "Retiro rapido en punto acordado."
  }
};

const paymentLabels = {
  card: "Tarjeta",
  transfer: "Transferencia bancaria",
  cash: "Pago contra entrega",
  "pickup-pay": "Pago en studio"
};

const promoCatalog = {
  LALA10: {
    label: "10% de descuento en el pedido",
    type: "percent",
    value: 0.1,
    minSubtotal: 75
  },
  GLOW15: {
    label: "15% en skincare y suncare",
    type: "percent-category",
    value: 0.15,
    minSubtotal: 60,
    categories: ["skincare", "suncare"]
  },
  FREESHIP: {
    label: "Envio gratis en standard shipping",
    type: "shipping",
    value: 1,
    minSubtotal: 70
  },
  BUNDLE20: {
    label: "$20 de ahorro en carritos altos",
    type: "fixed",
    value: 20,
    minSubtotal: 180
  }
};

const sampleCatalog = [
  {
    id: "sample-laneige-cream-skin",
    brand: "LANEIGE",
    name: "Cream Skin toner mini",
    description: "Mini muestra hidratante para rutina glow.",
    image: "assets/images/hero-skincare.jpg"
  },
  {
    id: "sample-sephora-cleanser",
    brand: "SEPHORA COLLECTION",
    name: "Cleanser sachet",
    description: "Muestra limpiadora de uso rapido.",
    image: "assets/images/skincare-flatlay.jpg"
  },
  {
    id: "sample-supergoop-spf",
    brand: "Supergoop!",
    name: "SPF daily sample",
    description: "Muestra solar ligera para usar a diario.",
    image: "assets/images/sun-care.jpg"
  },
  {
    id: "sample-rare-mini-blush",
    brand: "Rare Beauty",
    name: "Mini blush card",
    description: "Muestra enfocada en complexion y color.",
    image: "assets/images/showcase-artist.jpg"
  }
];

const concernDefinitions = [
  {
    id: "glow",
    label: "Glow y luminosidad",
    category: "makeup",
    searchSeed: "blush",
    description: "Ideal para tints, blushes, bronzers suaves e iluminacion que deja el rostro mas fresco.",
    tags: ["Blush", "Radiance", "Complexion"],
    keywords: ["blush", "glow", "radiant", "luminous", "highlighter", "bronzer", "illuminator", "skin tint"]
  },
  {
    id: "hydration",
    label: "Hidratacion profunda",
    category: "skincare",
    searchSeed: "moisturizer",
    description: "Para rutinas con serum, cream, essence y barrera enfocadas en piel sedienta o tirante.",
    tags: ["Barrier", "Moisture", "Skin ritual"],
    keywords: ["moisturizer", "cream", "hydrating", "hyaluronic", "serum", "essence", "barrier", "dewy"]
  },
  {
    id: "clarity",
    label: "Acne y poros",
    category: "skincare",
    searchSeed: "acne",
    description: "Seleccion guiada para blemishes, oil control, poros visibles y formulas clarificantes.",
    tags: ["Clarifying", "Blemish", "Pore care"],
    keywords: ["acne", "blemish", "clarifying", "clarify", "salicylic", "niacinamide", "pores", "oil"]
  },
  {
    id: "spf",
    label: "Proteccion solar diaria",
    category: "suncare",
    searchSeed: "sunscreen",
    description: "SPF y cuidados diarios pensados para proteccion, retoque y feel ligero.",
    tags: ["SPF", "Daily wear", "Sun care"],
    keywords: ["sunscreen", "spf", "sun", "uv", "sunscreen", "sun care"]
  },
  {
    id: "lips",
    label: "Labios completos",
    category: "lips",
    searchSeed: "lip",
    description: "Gloss, balm, oil, liners y tintes para armar una rutina de labios mas completa.",
    tags: ["Gloss", "Balm", "Lip color"],
    keywords: ["lip", "gloss", "balm", "liner", "oil", "lipstick", "tint", "mask"]
  },
  {
    id: "eyes",
    label: "Ojos y brows",
    category: "eyes",
    searchSeed: "mascara",
    description: "Mascaras, paletas, liners y brow products para un edit mas definido de ojos.",
    tags: ["Mascara", "Brows", "Palette"],
    keywords: ["mascara", "brow", "eyeliner", "eyeshadow", "palette", "lashes", "eyes"]
  }
];

const offerBannerConfig = [
  {
    code: "LALA10",
    eyebrow: "Online offer",
    title: "10% en el pedido beauty",
    copy: "Activa un descuento general en compras elegibles y llévalo directo al checkout.",
    accent: "soft"
  },
  {
    code: "GLOW15",
    eyebrow: "Skin event",
    title: "15% en skincare y suncare",
    copy: "Ideal para rutinas de hidratacion, protectores y reposiciones tipo skincare haul.",
    accent: "bright"
  },
  {
    code: "FREESHIP",
    eyebrow: "Shipping perk",
    title: "Envio gratis en standard",
    copy: "Ahorro instantaneo cuando tu carrito alcanza el minimo y quieres dejarlo listo para despacho.",
    accent: "gold"
  },
  {
    code: "BUNDLE20",
    eyebrow: "High cart reward",
    title: "$20 off en carritos altos",
    copy: "Pensado para compras grandes, reposiciones o mixes premium con varias categorias.",
    accent: "deep"
  }
];

const screenIds = [
  "homeScreen",
  "catalogScreen",
  "brandsScreen",
  "offersScreen",
  "finderScreen",
  "lovesScreen",
  "cartScreen",
  "checkoutScreen",
  "invoiceScreen",
  "historyScreen",
  "shippingScreen",
  "supportScreen"
];

const dom = {
  screens: [...document.querySelectorAll(".screen")],
  screenButtons: [...document.querySelectorAll("[data-screen-target]")],
  categoryButtons: [...document.querySelectorAll("[data-category-filter]")],
  catalogGrid: document.getElementById("catalogGrid"),
  catalogSearch: document.getElementById("catalogSearch"),
  catalogBrandFilter: document.getElementById("catalogBrandFilter"),
  catalogSort: document.getElementById("catalogSort"),
  clearCatalogFilters: document.getElementById("clearCatalogFilters"),
  catalogSummary: document.getElementById("catalogSummary"),
  catalogGridFooter: document.getElementById("catalogGridFooter"),
  catalogLoadMore: document.getElementById("catalogLoadMore"),
  lovesGrid: document.getElementById("lovesGrid"),
  recentlyViewedGrid: document.getElementById("recentlyViewedGrid"),
  lovesCount: document.getElementById("lovesCount"),
  recentlyViewedCount: document.getElementById("recentlyViewedCount"),
  lovesTierBadge: document.getElementById("lovesTierBadge"),
  cartItems: document.getElementById("cartItems"),
  checkoutSummary: document.getElementById("checkoutSummary"),
  shippingCountriesGrid: document.getElementById("shippingCountriesGrid"),
  headerCartCount: document.getElementById("headerCartCount"),
  headerLovesCount: document.getElementById("headerLovesCount"),
  catalogCartCount: document.getElementById("catalogCartCount"),
  catalogLovesCount: document.getElementById("catalogLovesCount"),
  heroProductCount: document.getElementById("heroProductCount"),
  cartItemsCount: document.getElementById("cartItemsCount"),
  cartSubtotal: document.getElementById("cartSubtotal"),
  cartSavings: document.getElementById("cartSavings"),
  cartShipping: document.getElementById("cartShipping"),
  cartTotal: document.getElementById("cartTotal"),
  goToCheckout: document.getElementById("goToCheckout"),
  createInvoiceFromCart: document.getElementById("createInvoiceFromCart"),
  clearCart: document.getElementById("clearCart"),
  checkoutForm: document.getElementById("checkoutForm"),
  customerCountry: document.getElementById("customerCountry"),
  payNowButton: document.getElementById("payNowButton"),
  downloadPdf: document.getElementById("downloadPdf"),
  refreshHistory: document.getElementById("refreshHistory"),
  exportBackup: document.getElementById("exportBackup"),
  historyList: document.getElementById("historyList"),
  dbModeLabel: document.getElementById("dbModeLabel"),
  dbLastSync: document.getElementById("dbLastSync"),
  dbOrdersCount: document.getElementById("dbOrdersCount"),
  dbPaidCount: document.getElementById("dbPaidCount"),
  invoiceStatusBadge: document.getElementById("invoiceStatusBadge"),
  invoiceStatusText: document.getElementById("invoiceStatusText"),
  invoiceItemCount: document.getElementById("invoiceItemCount"),
  invoicePaidDate: document.getElementById("invoicePaidDate"),
  invoiceEarnedPoints: document.getElementById("invoiceEarnedPoints"),
  invoiceTierStatus: document.getElementById("invoiceTierStatus"),
  invoiceCheckoutButton: document.getElementById("invoiceCheckoutButton"),
  invoiceCatalogButton: document.getElementById("invoiceCatalogButton"),
  invoiceItems: document.getElementById("invoiceItems"),
  invoicePreviewNumber: document.getElementById("invoicePreviewNumber"),
  invoicePreviewDate: document.getElementById("invoicePreviewDate"),
  invoicePreviewPayment: document.getElementById("invoicePreviewPayment"),
  invoicePreviewName: document.getElementById("invoicePreviewName"),
  invoicePreviewPhone: document.getElementById("invoicePreviewPhone"),
  invoicePreviewEmail: document.getElementById("invoicePreviewEmail"),
  invoicePreviewShipping: document.getElementById("invoicePreviewShipping"),
  invoicePreviewCountry: document.getElementById("invoicePreviewCountry"),
  invoicePreviewAddress: document.getElementById("invoicePreviewAddress"),
  invoicePreviewNotes: document.getElementById("invoicePreviewNotes"),
  invoicePreviewGiftMessage: document.getElementById("invoicePreviewGiftMessage"),
  invoicePreviewPromo: document.getElementById("invoicePreviewPromo"),
  invoicePreviewReward: document.getElementById("invoicePreviewReward"),
  invoicePreviewTier: document.getElementById("invoicePreviewTier"),
  invoicePreviewSamples: document.getElementById("invoicePreviewSamples"),
  invoicePreviewSubtotal: document.getElementById("invoicePreviewSubtotal"),
  invoicePreviewSavings: document.getElementById("invoicePreviewSavings"),
  invoicePreviewRewardSavings: document.getElementById("invoicePreviewRewardSavings"),
  invoicePreviewShippingCost: document.getElementById("invoicePreviewShippingCost"),
  invoicePreviewTotal: document.getElementById("invoicePreviewTotal"),
  invoicePreviewPoints: document.getElementById("invoicePreviewPoints"),
  catalogTierBadge: document.getElementById("catalogTierBadge"),
  catalogPointsBalance: document.getElementById("catalogPointsBalance"),
  catalogAvailableReward: document.getElementById("catalogAvailableReward"),
  catalogViewedCount: document.getElementById("catalogViewedCount"),
  samplesGrid: document.getElementById("samplesGrid"),
  promoFeedback: document.getElementById("promoFeedback"),
  loyaltyTierLabel: document.getElementById("loyaltyTierLabel"),
  loyaltyPointsLabel: document.getElementById("loyaltyPointsLabel"),
  loyaltyRewardLabel: document.getElementById("loyaltyRewardLabel"),
  brandsOverview: document.getElementById("brandsOverview"),
  brandShowcaseGrid: document.getElementById("brandShowcaseGrid"),
  brandIndex: document.getElementById("brandIndex"),
  offerBannerGrid: document.getElementById("offerBannerGrid"),
  offerUnder25Grid: document.getElementById("offerUnder25Grid"),
  offerReplenishGrid: document.getElementById("offerReplenishGrid"),
  offerLuxuryGrid: document.getElementById("offerLuxuryGrid"),
  concernGrid: document.getElementById("concernGrid"),
  routineGrid: document.getElementById("routineGrid"),
  applyPromoCode: document.getElementById("applyPromoCode"),
  clearPromoCode: document.getElementById("clearPromoCode"),
  quickViewModal: document.getElementById("quickViewModal"),
  quickViewImage: document.getElementById("quickViewImage"),
  quickViewBrand: document.getElementById("quickViewBrand"),
  quickViewTitle: document.getElementById("quickViewTitle"),
  quickViewDescription: document.getElementById("quickViewDescription"),
  quickViewPrice: document.getElementById("quickViewPrice"),
  quickViewRating: document.getElementById("quickViewRating"),
  quickViewCategory: document.getElementById("quickViewCategory"),
  quickViewBadge: document.getElementById("quickViewBadge"),
  quickViewSource: document.getElementById("quickViewSource"),
  quickViewAutoReplenish: document.getElementById("quickViewAutoReplenish"),
  quickViewLoveButton: document.getElementById("quickViewLoveButton"),
  quickViewAddButton: document.getElementById("quickViewAddButton"),
  toast: document.getElementById("toast")
};

const checkoutFields = {
  customerName: document.getElementById("customerName"),
  customerPhone: document.getElementById("customerPhone"),
  customerEmail: document.getElementById("customerEmail"),
  customerAddress: document.getElementById("customerAddress"),
  customerCity: document.getElementById("customerCity"),
  customerCountry: document.getElementById("customerCountry"),
  orderDate: document.getElementById("orderDate"),
  shippingMethod: document.getElementById("shippingMethod"),
  paymentMethod: document.getElementById("paymentMethod"),
  orderNotes: document.getElementById("orderNotes"),
  invoiceNumber: document.getElementById("invoiceNumber"),
  giftMessage: document.getElementById("giftMessage"),
  promoCode: document.getElementById("promoCode"),
  applyBeautyCash: document.getElementById("applyBeautyCash")
};

function getTodayInputValue() {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0")
  ].join("-");
}

function generateInvoiceNumber() {
  const now = new Date();
  const dateStamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("");
  const random = Math.floor(100 + Math.random() * 900);
  return `MBL-${dateStamp}-${random}`;
}

function roundCurrency(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(Number(value || 0));
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "Pendiente";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Pendiente";

  return new Intl.DateTimeFormat("es-DO", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(date);
}

function formatDateTime(value) {
  if (!value) return "Pendiente";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Pendiente";

  return new Intl.DateTimeFormat("es-DO", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeCode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();
}

const productTextIndex = new Map(products.map((product) => [
  product.id,
  normalizeText([
    product.brand,
    product.name,
    product.category,
    product.categoryLabel,
    product.subcategory,
    product.description
  ].join(" "))
]));

const productsByBrand = products.reduce((map, product) => {
  if (!map.has(product.brand)) {
    map.set(product.brand, []);
  }
  map.get(product.brand).push(product);
  return map;
}, new Map());

productsByBrand.forEach((brandProducts) => {
  brandProducts.sort((left, right) => left.featuredOrder - right.featuredOrder);
});

const brandInsights = [...productsByBrand.entries()]
  .map(([brand, brandProducts]) => ({
    brand,
    count: brandProducts.length,
    averagePrice: roundCurrency(
      brandProducts.reduce((sum, product) => sum + product.price, 0) / brandProducts.length
    ),
    categories: [...new Set(brandProducts.map((product) => product.categoryLabel))],
    spotlight: brandProducts[0],
    products: brandProducts.slice(0, 4)
  }))
  .sort((left, right) => right.count - left.count || left.brand.localeCompare(right.brand));

const brandInsightMap = new Map(brandInsights.map((insight) => [insight.brand, insight]));

function getProductSearchText(product) {
  return productTextIndex.get(product.id) || "";
}

function productMatchesKeywords(product, keywords = []) {
  const haystack = getProductSearchText(product);
  return keywords.some((keyword) => haystack.includes(normalizeText(keyword)));
}

function getCuratedProducts(predicate, limit = 4, fallbackCategory = "makeup") {
  const matched = products.filter(predicate).sort((left, right) => left.featuredOrder - right.featuredOrder);
  if (matched.length >= limit) {
    return matched.slice(0, limit);
  }

  const fallback = products
    .filter((product) => product.category === fallbackCategory)
    .sort((left, right) => left.featuredOrder - right.featuredOrder);

  return [...new Map([...matched, ...fallback].map((product) => [product.id, product])).values()].slice(0, limit);
}

const concernCollections = concernDefinitions.map((concern) => {
  const matched = products
    .filter((product) => {
      if (concern.category && ![concern.category, "all"].includes(product.category) && !productMatchesKeywords(product, concern.keywords)) {
        return false;
      }
      return productMatchesKeywords(product, concern.keywords) || product.category === concern.category;
    })
    .sort((left, right) => left.featuredOrder - right.featuredOrder);

  const productsForConcern = matched.length >= 8
    ? matched.slice(0, 8)
    : getCuratedProducts((product) => product.category === concern.category, 8, concern.category);

  return {
    ...concern,
    count: matched.length || productsForConcern.length,
    products: productsForConcern
  };
});

const concernCollectionMap = new Map(concernCollections.map((concern) => [concern.id, concern]));

const offerCollections = {
  under25: {
    label: "Favoritos accesibles",
    description: "Picks por debajo de $25 para compra agil, regalo o first try.",
    products: getCuratedProducts((product) => product.price <= 25, 4, "makeup")
  },
  replenish: {
    label: "Auto-Replenish",
    description: "Skincare y suncare que encajan mejor en una rutina de recompra.",
    products: getCuratedProducts((product) => isAutoReplenishEligible(product), 4, "skincare")
  },
  luxury: {
    label: "Luxury splurge",
    description: "Selecciones premium para carritos mas altos y una experiencia mas prestige.",
    products: getCuratedProducts((product) => product.price >= 48, 4, "makeup")
  }
};

function getCountryMeta(countryName) {
  return shippingCountries.find((country) => country.name === countryName) || shippingCountries[0];
}

function getShippingMeta(methodKey) {
  return shippingMethods[methodKey] || shippingMethods.standard;
}

function getRewardValueFromPoints(points) {
  return Math.floor(Number(points || 0) / 500) * 10;
}

function getTierFromSpend(spend) {
  const total = Number(spend || 0);
  if (total >= 1000) return "Rouge";
  if (total >= 350) return "VIB";
  return "Insider";
}

function getTierMultiplier(tier) {
  if (tier === "Rouge") return 1.35;
  if (tier === "VIB") return 1.15;
  return 1;
}

function getNumericSeed(value) {
  return [...String(value || "")].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function isAutoReplenishEligible(product) {
  if (!product) return false;
  return ["skincare", "suncare"].includes(product.category)
    || ["Lip Balm", "Lip Mask", "Lip Treatment", "Cleanser", "Serum", "Moisturizer", "Mask", "Eye Care", "Sunscreen"].includes(product.subcategory);
}

function getProductInsights(product) {
  const seed = getNumericSeed(`${product.id}-${product.brand}-${product.name}`);
  const rating = (4.1 + ((seed % 9) / 10)).toFixed(1);
  const reviews = 120 + ((seed * 17) % 2800);
  const primaryBadge = product.featuredOrder <= 12
    ? "Bestseller"
    : product.category === "skincare"
      ? "Skin favorite"
      : product.category === "lips"
        ? "Trending lips"
        : product.category === "eyes"
          ? "Top eyes"
          : product.category === "tools"
            ? "Beauty tool"
            : "Editor pick";
  const secondaryBadge = isAutoReplenishEligible(product)
    ? "Auto-Replenish 5%"
    : product.subcategory;

  return {
    rating,
    reviews,
    primaryBadge,
    secondaryBadge
  };
}

function createDefaultState() {
  return {
    activeScreen: "homeScreen",
    filters: {
      category: "all",
      brand: "all",
      search: "",
      sort: "featured"
    },
    cart: [],
    loves: [],
    recentlyViewed: [],
    quickViewProductId: "",
    checkout: {
      customerName: "",
      customerPhone: "",
      customerEmail: "",
      customerAddress: "",
      customerCity: "Santo Domingo",
      customerCountry: "Republica Dominicana",
      orderDate: getTodayInputValue(),
      shippingMethod: "standard",
      paymentMethod: "card",
      orderNotes: "Gracias por confiar en Makeup by Lala.",
      invoiceNumber: generateInvoiceNumber(),
      promoCode: "",
      appliedPromoCode: "",
      giftMessage: "",
      sampleIds: sampleCatalog.slice(0, 2).map((sample) => sample.id),
      applyBeautyCash: false
    },
    invoice: {
      status: "Draft",
      createdAt: "",
      paidAt: "",
      lastPointsEarned: 0,
      snapshot: null
    },
    loyalty: {
      points: 620,
      lifetimeSpend: 220,
      tier: "Insider"
    },
    orderHistory: [],
    database: {
      mode: "Inicializando",
      ready: false,
      lastSyncedAt: ""
    }
  };
}

function normalizeCartEntry(entry) {
  if (!entry || !productMap.has(entry.id)) return null;
  const qty = Math.max(1, Number(entry.qty) || 1);
  return {
    id: entry.id,
    qty,
    autoReplenish: Boolean(entry.autoReplenish)
  };
}

function loadState() {
  const defaults = createDefaultState();

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return defaults;

    const parsed = JSON.parse(raw);
    const merged = {
      ...defaults,
      ...parsed,
      filters: {
        ...defaults.filters,
        ...(parsed.filters || {})
      },
      checkout: {
        ...defaults.checkout,
        ...(parsed.checkout || {})
      },
      invoice: {
        ...defaults.invoice,
        ...(parsed.invoice || {})
      },
      loyalty: {
        ...defaults.loyalty,
        ...(parsed.loyalty || {})
      }
    };

    merged.cart = (Array.isArray(parsed.cart) ? parsed.cart : [])
      .map(normalizeCartEntry)
      .filter(Boolean);
    merged.loves = [...new Set(Array.isArray(parsed.loves) ? parsed.loves : [])].filter((id) => productMap.has(id));
    merged.recentlyViewed = [...new Set(Array.isArray(parsed.recentlyViewed) ? parsed.recentlyViewed : [])]
      .filter((id) => productMap.has(id))
      .slice(0, 12);

    merged.activeScreen = defaults.activeScreen;

    if (!merged.filters.brand || (merged.filters.brand !== "all" && !availableBrandSet.has(merged.filters.brand))) {
      merged.filters.brand = defaults.filters.brand;
    }

    const shippingAliases = {
      express: "same-day"
    };
    if (shippingAliases[merged.checkout.shippingMethod]) {
      merged.checkout.shippingMethod = shippingAliases[merged.checkout.shippingMethod];
    }

    if (!shippingCountries.some((country) => country.name === merged.checkout.customerCountry)) {
      merged.checkout.customerCountry = defaults.checkout.customerCountry;
    }

    if (!shippingMethods[merged.checkout.shippingMethod]) {
      merged.checkout.shippingMethod = defaults.checkout.shippingMethod;
    }

    if (!paymentLabels[merged.checkout.paymentMethod]) {
      merged.checkout.paymentMethod = defaults.checkout.paymentMethod;
    }

    if (!merged.checkout.invoiceNumber) {
      merged.checkout.invoiceNumber = generateInvoiceNumber();
    }

    if (!merged.checkout.orderDate) {
      merged.checkout.orderDate = getTodayInputValue();
    }

    merged.checkout.promoCode = normalizeCode(merged.checkout.promoCode);
    merged.checkout.appliedPromoCode = normalizeCode(merged.checkout.appliedPromoCode);
    merged.checkout.sampleIds = Array.isArray(merged.checkout.sampleIds)
      ? merged.checkout.sampleIds.filter((id) => sampleCatalog.some((sample) => sample.id === id)).slice(0, 2)
      : defaults.checkout.sampleIds;
    merged.checkout.applyBeautyCash = Boolean(merged.checkout.applyBeautyCash);

    merged.loyalty.points = Math.max(0, Number(merged.loyalty.points) || 0);
    merged.loyalty.lifetimeSpend = Math.max(0, Number(merged.loyalty.lifetimeSpend) || 0);
    merged.loyalty.tier = getTierFromSpend(merged.loyalty.lifetimeSpend);

    return merged;
  } catch (error) {
    return defaults;
  }
}

const state = loadState();

function saveState() {
  invalidatePricingCache();

  const payload = {
    activeScreen: state.activeScreen,
    filters: structuredClone(state.filters),
    cart: structuredClone(state.cart),
    loves: structuredClone(state.loves),
    recentlyViewed: structuredClone(state.recentlyViewed),
    checkout: structuredClone(state.checkout),
    invoice: structuredClone(state.invoice),
    loyalty: structuredClone(state.loyalty)
  };

  localStorage.setItem(storageKey, JSON.stringify(payload));

  if (window.makeupDb?.saveAppState) {
    window.makeupDb.saveAppState(payload).then(() => {
      state.database.mode = window.makeupDb.getMode();
      state.database.ready = window.makeupDb.isReady();
      state.database.lastSyncedAt = new Date().toISOString();
      renderHistorySummary();
    });
  }
}

function showToast(message) {
  dom.toast.textContent = message;
  dom.toast.classList.add("is-visible");
  clearTimeout(showToast.timeoutId);
  showToast.timeoutId = setTimeout(() => {
    dom.toast.classList.remove("is-visible");
  }, 2800);
}
function createSparkles(originElement) {
  if (!originElement || performanceMode.lite || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const rect = originElement.getBoundingClientRect();
  const amount = 12;

  for (let index = 0; index < amount; index += 1) {
    const sparkle = document.createElement("span");
    sparkle.className = "sparkle";
    sparkle.style.left = `${rect.left + rect.width / 2 + (Math.random() * 90 - 45)}px`;
    sparkle.style.top = `${rect.top + rect.height / 2 + (Math.random() * 48 - 24)}px`;
    sparkle.style.animationDelay = `${index * 22}ms`;
    document.body.appendChild(sparkle);
    setTimeout(() => sparkle.remove(), 1100);
  }
}

function setActiveScreen(screenId) {
  if (!screenIds.includes(screenId)) return;

  state.activeScreen = screenId;
  dom.screens.forEach((screen) => {
    screen.classList.toggle("is-active", screen.id === screenId);
  });

  dom.screenButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.screenTarget === screenId);
  });

  document.querySelectorAll(`#${screenId} .reveal`).forEach((element) => {
    element.classList.add("is-visible");
  });

  renderVisibleScreenContent(true);

  saveState();
  window.scrollTo({ top: 0, behavior: performanceMode.lite ? "auto" : "smooth" });
}

function syncCategoryButtons() {
  dom.categoryButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.categoryFilter === state.filters.category);
  });
}

function setCategoryFilter(category) {
  state.filters.category = category;
  resetCatalogVisibleCount();
  syncCategoryButtons();
  saveState();
  renderCatalog();
}

function setBrandFilter(brand) {
  const nextBrand = brand === "all" || availableBrandSet.has(brand) ? brand : "all";
  state.filters.brand = nextBrand;
  resetCatalogVisibleCount();
  if (dom.catalogBrandFilter) {
    dom.catalogBrandFilter.value = nextBrand;
  }
  saveState();
  renderCatalog(true);
}

function clearFilters() {
  state.filters.category = "all";
  state.filters.brand = "all";
  state.filters.search = "";
  state.filters.sort = "featured";
  resetCatalogVisibleCount();
  dom.catalogSearch.value = "";
  if (dom.catalogBrandFilter) {
    dom.catalogBrandFilter.value = "all";
  }
  dom.catalogSort.value = "featured";
  setCategoryFilter("all");
}

function openCatalogShortcut({
  category = "all",
  brand = "all",
  search = "",
  sort = "featured"
} = {}, feedbackMessage = "") {
  state.filters.category = category;
  state.filters.brand = brand === "all" || availableBrandSet.has(brand) ? brand : "all";
  state.filters.search = search;
  state.filters.sort = sort;
  resetCatalogVisibleCount();
  syncCategoryButtons();

  if (dom.catalogSearch) {
    dom.catalogSearch.value = search;
  }
  if (dom.catalogBrandFilter) {
    dom.catalogBrandFilter.value = state.filters.brand;
  }
  if (dom.catalogSort) {
    dom.catalogSort.value = sort;
  }

  saveState();
  setActiveScreen("catalogScreen");
  if (feedbackMessage) {
    showToast(feedbackMessage);
  }
}

function openBrandExperience(brand) {
  if (!brandInsightMap.has(brand)) return;
  openCatalogShortcut({
    category: "all",
    brand,
    search: "",
    sort: "brand-asc"
  }, `${brand} abierta en el catalogo.`);
}

function openConcernExperience(concernId) {
  const concern = concernCollectionMap.get(concernId);
  if (!concern) return;

  openCatalogShortcut({
    category: concern.category || "all",
    brand: "all",
    search: concern.searchSeed || "",
    sort: "featured"
  }, `Mostrando seleccion para ${concern.label}.`);
}

function openOfferCollection(offerKey) {
  if (offerKey === "under25") {
    openCatalogShortcut({
      category: "all",
      brand: "all",
      search: "",
      sort: "price-asc"
    }, "Mostrando picks accesibles.");
    return;
  }

  if (offerKey === "replenish") {
    openCatalogShortcut({
      category: "skincare",
      brand: "all",
      search: "",
      sort: "featured"
    }, "Mostrando favoritos de recompra.");
    return;
  }

  if (offerKey === "luxury") {
    openCatalogShortcut({
      category: "all",
      brand: "all",
      search: "",
      sort: "price-desc"
    }, "Mostrando picks premium.");
  }
}

function getCatalogBatchSize() {
  if (performanceMode.lite) return window.innerWidth <= 680 ? 8 : 16;
  return window.innerWidth <= 680 ? 12 : 24;
}

function resetCatalogVisibleCount() {
  catalogVisibleCount = getCatalogBatchSize();
}

function showMoreCatalogProducts() {
  catalogVisibleCount += getCatalogBatchSize();
  renderCatalog(true);
}

function invalidatePricingCache() {
  pricingCacheKey = "";
  pricingCacheValue = null;
}

function getPricingStateKey() {
  return JSON.stringify({
    cart: state.cart,
    country: state.checkout.customerCountry,
    shippingMethod: state.checkout.shippingMethod,
    paymentMethod: state.checkout.paymentMethod,
    promoCode: state.checkout.promoCode,
    appliedPromoCode: state.checkout.appliedPromoCode,
    applyBeautyCash: state.checkout.applyBeautyCash,
    sampleIds: state.checkout.sampleIds,
    points: state.loyalty.points,
    tier: state.loyalty.tier
  });
}

function renderVisibleScreenContent(force = false) {
  switch (state.activeScreen) {
    case "catalogScreen":
      renderCatalog(force);
      break;
    case "brandsScreen":
      renderBrandsScreen(force);
      break;
    case "offersScreen":
      renderOffersScreen(force);
      break;
    case "finderScreen":
      renderFinderScreen(force);
      break;
    case "lovesScreen":
      renderLoves(force);
      break;
    case "cartScreen":
      renderCart(force);
      break;
    case "checkoutScreen":
      renderCheckoutPerks(force);
      renderCheckoutSummary(force);
      break;
    case "invoiceScreen":
      renderInvoice(force);
      break;
    case "historyScreen":
      renderHistory(force);
      break;
    default:
      break;
  }
}

function renderStoreChrome() {
  updateHeaderMetrics();
  renderLoyaltyPanels();
  renderHistorySummary();
}

function scheduleCheckoutRefresh(immediate = false) {
  clearTimeout(checkoutInputDebounceId);

  const refresh = () => {
    saveState();
    renderStoreChrome();
    renderVisibleScreenContent();
    renderQuickView();
  };

  if (immediate) {
    refresh();
    return;
  }

  checkoutInputDebounceId = window.setTimeout(refresh, performanceMode.lite ? 220 : 120);
}

function applyFiltersAndSort() {
  const searchValue = normalizeText(state.filters.search);
  let result = [...products];

  if (state.filters.category !== "all") {
    result = result.filter((product) => product.category === state.filters.category);
  }

  if (state.filters.brand !== "all") {
    result = result.filter((product) => product.brand === state.filters.brand);
  }

  if (searchValue) {
    result = result.filter((product) => {
      const haystack = normalizeText([
        product.brand,
        product.name,
        product.categoryLabel,
        product.subcategory,
        product.description
      ].join(" "));

      return haystack.includes(searchValue);
    });
  }

  switch (state.filters.sort) {
    case "price-asc":
      result.sort((a, b) => a.price - b.price);
      break;
    case "price-desc":
      result.sort((a, b) => b.price - a.price);
      break;
    case "name-asc":
      result.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "brand-asc":
      result.sort((a, b) => a.brand.localeCompare(b.brand));
      break;
    default:
      result.sort((a, b) => a.featuredOrder - b.featuredOrder);
      break;
  }

  return result;
}

function attachImageFallbacks(container) {
  if (!container) return;

  container.querySelectorAll("img[data-fallback]").forEach((image) => {
    if (image.dataset.errorBound === "true") return;
    image.dataset.errorBound = "true";

    image.addEventListener("error", () => {
      const safeDefault = "assets/images/hero-products.jpg";

      if (image.dataset.fallback && !image.dataset.fallbackApplied && image.src !== image.dataset.fallback) {
        image.dataset.fallbackApplied = "true";
        image.src = image.dataset.fallback;
        image.closest(".product-card__media, .cart-item__media, .quick-view__media")?.classList.add("is-editorial");
        return;
      }

      if (!image.dataset.defaultApplied) {
        image.dataset.defaultApplied = "true";
        image.src = safeDefault;
        image.closest(".product-card__media, .cart-item__media, .quick-view__media")?.classList.add("is-editorial");
      }
    });
  });
}

function recordProductView(productId, shouldPersist = true) {
  if (!productMap.has(productId)) return;

  state.recentlyViewed = [productId, ...state.recentlyViewed.filter((id) => id !== productId)].slice(0, 12);

  if (shouldPersist) {
    saveState();
  }
}

function toggleLove(productId, triggerElement) {
  if (!productMap.has(productId)) return;

  if (state.loves.includes(productId)) {
    state.loves = state.loves.filter((id) => id !== productId);
    showToast("Producto removido de loves.");
  } else {
    state.loves = [productId, ...state.loves.filter((id) => id !== productId)];
    recordProductView(productId, false);
    showToast("Producto guardado en loves.");
    createSparkles(triggerElement);
  }

  saveState();
  renderStoreChrome();
  renderVisibleScreenContent();
  renderQuickView();
}

function getSelectedSamples() {
  return sampleCatalog.filter((sample) => state.checkout.sampleIds.includes(sample.id));
}

function toggleSample(sampleId) {
  if (!sampleCatalog.some((sample) => sample.id === sampleId)) return;

  if (state.checkout.sampleIds.includes(sampleId)) {
    state.checkout.sampleIds = state.checkout.sampleIds.filter((id) => id !== sampleId);
  } else {
    if (state.checkout.sampleIds.length >= 2) {
      showToast("Solo puedes elegir hasta 2 muestras.");
      return;
    }
    state.checkout.sampleIds = [...state.checkout.sampleIds, sampleId];
  }

  markOrderChanged();
  saveState();
  renderStoreChrome();
  renderVisibleScreenContent();
  renderQuickView();
}

function getCartItemsDetailed() {
  return state.cart
    .map((entry) => {
      const product = productMap.get(entry.id);
      if (!product) return null;

      const qty = Math.max(1, Number(entry.qty) || 1);
      const autoReplenish = Boolean(entry.autoReplenish && isAutoReplenishEligible(product));
      const baseLineTotal = roundCurrency(qty * product.price);
      const lineSavings = autoReplenish ? roundCurrency(baseLineTotal * 0.05) : 0;
      const lineTotal = roundCurrency(baseLineTotal - lineSavings);

      return {
        ...product,
        qty,
        autoReplenish,
        baseLineTotal,
        lineSavings,
        lineTotal
      };
    })
    .filter(Boolean);
}

function getPromoEvaluation(items, overrideCode = state.checkout.appliedPromoCode) {
  const code = normalizeCode(overrideCode);
  if (!code) {
    return {
      code: "",
      valid: false,
      message: "Usa una promo para aplicar descuento o envio gratis.",
      merchandiseSavings: 0,
      shippingSavings: 0,
      appliedLabel: ""
    };
  }

  const promo = promoCatalog[code];
  const subtotal = roundCurrency(items.reduce((sum, item) => sum + item.lineTotal, 0));
  if (!promo) {
    return {
      code,
      valid: false,
      message: "Ese codigo no existe dentro de esta tienda.",
      merchandiseSavings: 0,
      shippingSavings: 0,
      appliedLabel: ""
    };
  }

  if (subtotal < promo.minSubtotal) {
    return {
      code,
      valid: false,
      message: `Necesitas al menos ${formatCurrency(promo.minSubtotal)} para usar ${code}.`,
      merchandiseSavings: 0,
      shippingSavings: 0,
      appliedLabel: promo.label
    };
  }

  let merchandiseSavings = 0;
  let shippingSavings = 0;

  if (promo.type === "percent") {
    merchandiseSavings = roundCurrency(subtotal * promo.value);
  }

  if (promo.type === "fixed") {
    merchandiseSavings = Math.min(roundCurrency(promo.value), subtotal);
  }

  if (promo.type === "percent-category") {
    const eligibleSubtotal = roundCurrency(items
      .filter((item) => promo.categories.includes(item.category))
      .reduce((sum, item) => sum + item.lineTotal, 0));

    if (!eligibleSubtotal) {
      return {
        code,
        valid: false,
        message: "Ese codigo aplica solo a skincare o suncare en esta tienda.",
        merchandiseSavings: 0,
        shippingSavings: 0,
        appliedLabel: promo.label
      };
    }

    merchandiseSavings = roundCurrency(eligibleSubtotal * promo.value);
  }

  if (promo.type === "shipping") {
    shippingSavings = 1;
  }

  return {
    code,
    valid: true,
    message: `${code} aplicado correctamente.`,
    merchandiseSavings,
    shippingSavings,
    appliedLabel: promo.label
  };
}

function getShippingBase(subtotalAfterMerchDiscounts) {
  if (!subtotalAfterMerchDiscounts) return 0;

  const countryMeta = getCountryMeta(state.checkout.customerCountry);
  const shippingMeta = getShippingMeta(state.checkout.shippingMethod);

  if (["pickup", "curbside"].includes(state.checkout.shippingMethod)) {
    return 0;
  }

  if (state.checkout.shippingMethod === "standard" && subtotalAfterMerchDiscounts >= 220) {
    return 0;
  }

  if (state.checkout.shippingMethod === "same-day") {
    return localFulfillmentCountries.has(state.checkout.customerCountry)
      ? shippingMeta.base
      : shippingMeta.base + 8 + countryMeta.surcharge;
  }

  return shippingMeta.base + countryMeta.surcharge;
}

function getPricingSummary() {
  const cacheKey = getPricingStateKey();
  if (pricingCacheKey === cacheKey && pricingCacheValue) {
    return pricingCacheValue;
  }

  const items = getCartItemsDetailed();
  const itemCount = items.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = roundCurrency(items.reduce((sum, item) => sum + item.baseLineTotal, 0));
  const itemSavings = roundCurrency(items.reduce((sum, item) => sum + item.lineSavings, 0));
  const subtotalAfterItemSavings = roundCurrency(subtotal - itemSavings);
  const promo = getPromoEvaluation(items);
  const promoSavings = promo.valid ? promo.merchandiseSavings : 0;
  const shippingBase = getShippingBase(subtotalAfterItemSavings - promoSavings);
  const shippingSavings = promo.valid && promo.shippingSavings ? shippingBase : 0;
  const shipping = roundCurrency(Math.max(0, shippingBase - shippingSavings));
  const availableReward = getRewardValueFromPoints(state.loyalty.points);
  const rewardSavings = state.checkout.applyBeautyCash
    ? Math.min(availableReward, roundCurrency(Math.max(0, subtotalAfterItemSavings - promoSavings)))
    : 0;
  const rewardPointsCost = rewardSavings ? rewardSavings * 50 : 0;
  const totalSavings = roundCurrency(itemSavings + promoSavings + shippingSavings + rewardSavings);
  const total = roundCurrency(Math.max(0, subtotalAfterItemSavings - promoSavings - rewardSavings + shipping));
  const pointsEarned = state.loyalty.points >= 0
    ? Math.max(0, Math.floor((subtotalAfterItemSavings - promoSavings - rewardSavings) * getTierMultiplier(state.loyalty.tier)))
    : 0;

  pricingCacheValue = {
    items,
    itemCount,
    subtotal,
    itemSavings,
    subtotalAfterItemSavings,
    promo,
    promoSavings,
    shippingBase,
    shippingSavings,
    shipping,
    rewardSavings: roundCurrency(rewardSavings),
    rewardPointsCost,
    availableReward,
    totalSavings,
    total,
    pointsEarned,
    sampleSummary: getSelectedSamples().length ? getSelectedSamples().map((sample) => sample.name).join(" | ") : "Sin muestras"
  };

  pricingCacheKey = cacheKey;
  return pricingCacheValue;
}

function getItemCount() {
  return getPricingSummary().itemCount;
}

function getSubtotal() {
  return getPricingSummary().subtotal;
}

function getShippingCost() {
  return getPricingSummary().shipping;
}

function getGrandTotal() {
  return getPricingSummary().total;
}

function renderProductCard(product) {
  const insights = getProductInsights(product);
  const loved = state.loves.includes(product.id);

  return `
    <article class="product-card">
      <div class="product-card__media">
        <img
          src="${product.image}"
          alt="${product.brand} ${product.name}"
          loading="lazy"
          decoding="async"
          width="480"
          height="480"
          data-fallback="${product.fallbackImage}"
        >
        <span class="product-card__badge">${insights.primaryBadge}</span>
        <div class="product-card__media-actions">
          <button
            class="icon-button ${loved ? "is-active" : ""}"
            type="button"
            data-toggle-love="${product.id}"
            aria-label="Guardar en loves"
          >
            ${loved ? "&#10084;" : "&#9825;"}
          </button>
          <button
            class="icon-button"
            type="button"
            data-open-quick-view="${product.id}"
            aria-label="Abrir vista rapida"
          >
            +
          </button>
        </div>
      </div>

      <div class="product-card__body">
        <p class="product-card__brand">${product.brand}</p>
        <h3>${product.name}</h3>
        <p class="product-card__description">${product.description}</p>

        <div class="product-card__rating">${insights.rating} ★ | ${formatNumber(insights.reviews)} resenas</div>

        <div class="product-card__meta">
          <span>${product.subcategory}</span>
          <span>${insights.secondaryBadge}</span>
          <span>${product.categoryLabel}</span>
        </div>

        <div class="product-card__footer">
          <div>
            <strong class="product-card__price">${product.priceLabel}</strong>
            <small>Precio base en carrito: ${formatCurrency(product.price)}</small>
          </div>

          <div class="product-card__button-group">
            <button class="btn btn--ghost btn--small" type="button" data-open-quick-view="${product.id}">Vista rapida</button>
            <button class="btn btn--primary btn--small" type="button" data-add-to-cart="${product.id}">Agregar</button>
          </div>
        </div>

        <a class="product-card__source" href="${product.sourceUrl}" target="_blank" rel="noreferrer">
          ${product.sourceLabel}
        </a>
      </div>
    </article>
  `;
}

function renderCatalog(force = false) {
  if (!force && state.activeScreen !== "catalogScreen") return;

  const filteredProducts = applyFiltersAndSort();
  const visibleProducts = filteredProducts.slice(0, catalogVisibleCount);
  const remainingProducts = Math.max(0, filteredProducts.length - visibleProducts.length);
  const activeBrandLabel = state.filters.brand !== "all"
    ? ` Marca activa: ${state.filters.brand}.`
    : "";

  dom.catalogSummary.textContent = `${visibleProducts.length} productos visibles de ${filteredProducts.length} resultados y ${products.length} disponibles.${activeBrandLabel}`;

  if (!filteredProducts.length) {
    dom.catalogGrid.innerHTML = `
      <article class="empty-card">
        <p class="eyebrow">Sin resultados</p>
        <h3>No encontramos productos con ese filtro.</h3>
        <p>Prueba limpiar filtros o buscar por marca, categoria o subcategoria.</p>
        <button class="btn btn--primary" type="button" id="emptyCatalogReset">Mostrar todo</button>
      </article>
    `;
    if (dom.catalogGridFooter) {
      dom.catalogGridFooter.hidden = true;
    }
    return;
  }

  dom.catalogGrid.innerHTML = visibleProducts.map((product) => renderProductCard(product)).join("");
  attachImageFallbacks(dom.catalogGrid);

  if (dom.catalogGridFooter) {
    dom.catalogGridFooter.hidden = remainingProducts === 0;
  }

  if (dom.catalogLoadMore) {
    dom.catalogLoadMore.textContent = remainingProducts > 0
      ? `Cargar ${Math.min(getCatalogBatchSize(), remainingProducts)} productos mas`
      : "Catalogo completo";
  }
}

function populateBrandOptions() {
  if (!dom.catalogBrandFilter) return;

  const fragment = document.createDocumentFragment();
  const defaultOption = document.createElement("option");
  defaultOption.value = "all";
  defaultOption.textContent = "Todas las marcas";
  fragment.appendChild(defaultOption);

  availableBrands.forEach((brand) => {
    const option = document.createElement("option");
    option.value = brand;
    option.textContent = `${brand} (${brandProductCounts[brand] || 0})`;
    fragment.appendChild(option);
  });

  dom.catalogBrandFilter.innerHTML = "";
  dom.catalogBrandFilter.appendChild(fragment);
  dom.catalogBrandFilter.value = state.filters.brand === "all" || availableBrandSet.has(state.filters.brand)
    ? state.filters.brand
    : "all";
}

function renderBrandsScreen(force = false) {
  if (!force && state.activeScreen !== "brandsScreen") return;
  if (!dom.brandsOverview || !dom.brandShowcaseGrid || !dom.brandIndex) return;

  const topBrand = brandInsights[0];
  const topCategoryMix = [...brandInsights].sort((left, right) => right.categories.length - left.categories.length)[0];
  const groupedBrands = availableBrands.reduce((groups, brand) => {
    const letter = brand.charAt(0).toUpperCase();
    if (!groups[letter]) {
      groups[letter] = [];
    }
    groups[letter].push(brand);
    return groups;
  }, {});

  dom.brandsOverview.innerHTML = `
    <article class="stat-panel">
      <span>Marcas activas</span>
      <strong>${formatNumber(availableBrands.length)}</strong>
      <small>Brands A-Z disponibles dentro del catalogo.</small>
    </article>
    <article class="stat-panel">
      <span>Productos listados</span>
      <strong>${formatNumber(products.length)}</strong>
      <small>Seleccion real cargada dentro de la tienda.</small>
    </article>
    <article class="stat-panel">
      <span>Marca con mas surtido</span>
      <strong>${topBrand?.brand || "Top brand"}</strong>
      <small>${topBrand ? `${topBrand.count} productos visibles.` : "Explora la vista de marcas."}</small>
    </article>
    <article class="stat-panel">
      <span>Mayor mix de categorias</span>
      <strong>${topCategoryMix?.brand || "Beauty mix"}</strong>
      <small>${topCategoryMix ? topCategoryMix.categories.join(" · ") : "Makeup, skincare y mas."}</small>
    </article>
  `;

  dom.brandShowcaseGrid.innerHTML = brandInsights.slice(0, 6).map((insight) => `
    <article class="brand-showcase-card">
      <p class="eyebrow">Featured brand</p>
      <h3>${insight.brand}</h3>
      <p>${insight.count} productos visibles con presencia en ${insight.categories.length} categorias.</p>
      <div class="brand-showcase-card__meta">
        <span>${insight.categories.slice(0, 3).join(" · ")}</span>
        <span>Avg. ${formatCurrency(insight.averagePrice)}</span>
      </div>
      <div class="brand-preview-list">
        ${insight.products.slice(0, 3).map((product) => `<span>${product.name}</span>`).join("")}
      </div>
      <div class="product-card__button-group">
        <button class="btn btn--primary btn--small" type="button" data-open-brand="${insight.brand}">Ver marca</button>
        <button class="btn btn--ghost btn--small" type="button" data-open-quick-view="${insight.spotlight.id}">Spotlight</button>
      </div>
    </article>
  `).join("");

  dom.brandIndex.innerHTML = Object.keys(groupedBrands)
    .sort((left, right) => left.localeCompare(right))
    .map((letter) => `
      <section class="brand-index-group">
        <div class="brand-index-group__head">
          <strong>${letter}</strong>
          <span>${groupedBrands[letter].length} marcas</span>
        </div>
        <div class="brand-chip-grid">
          ${groupedBrands[letter].map((brand) => `
            <button class="brand-chip" type="button" data-open-brand="${brand}">
              <span>${brand}</span>
              <small>${brandProductCounts[brand] || 0} productos</small>
            </button>
          `).join("")}
        </div>
      </section>
    `).join("");
}

function renderOffersScreen(force = false) {
  if (!force && state.activeScreen !== "offersScreen") return;
  if (!dom.offerBannerGrid || !dom.offerUnder25Grid || !dom.offerReplenishGrid || !dom.offerLuxuryGrid) return;

  dom.offerBannerGrid.innerHTML = offerBannerConfig.map((offer) => {
    const promo = promoCatalog[offer.code];
    return `
      <article class="offer-banner offer-banner--${offer.accent}">
        <p class="eyebrow">${offer.eyebrow}</p>
        <h3>${offer.title}</h3>
        <p>${offer.copy}</p>
        <div class="offer-banner__meta">
          <span>${offer.code}</span>
          <span>Minimo ${formatCurrency(promo.minSubtotal)}</span>
        </div>
        <div class="product-card__button-group">
          <button class="btn btn--primary btn--small" type="button" data-apply-store-promo="${offer.code}">Llevar al checkout</button>
          <button class="btn btn--ghost btn--small" type="button" data-screen-target="catalogScreen">Seguir comprando</button>
        </div>
      </article>
    `;
  }).join("");

  dom.offerUnder25Grid.innerHTML = offerCollections.under25.products.map((product) => renderProductCard(product)).join("");
  dom.offerReplenishGrid.innerHTML = offerCollections.replenish.products.map((product) => renderProductCard(product)).join("");
  dom.offerLuxuryGrid.innerHTML = offerCollections.luxury.products.map((product) => renderProductCard(product)).join("");

  attachImageFallbacks(dom.offerUnder25Grid);
  attachImageFallbacks(dom.offerReplenishGrid);
  attachImageFallbacks(dom.offerLuxuryGrid);
}

function renderFinderScreen(force = false) {
  if (!force && state.activeScreen !== "finderScreen") return;
  if (!dom.concernGrid || !dom.routineGrid) return;

  dom.concernGrid.innerHTML = concernCollections.map((concern) => {
    const leadProducts = concern.products.slice(0, 3);
    return `
      <article class="concern-card">
        <p class="eyebrow">Shop by concern</p>
        <h3>${concern.label}</h3>
        <p>${concern.description}</p>
        <div class="concern-card__meta">
          <span>${concern.count} matches</span>
          <span>${concern.category.toUpperCase()}</span>
        </div>
        <div class="brand-preview-list">
          ${concern.tags.map((tag) => `<span>${tag}</span>`).join("")}
        </div>
        <div class="concern-card__products">
          ${leadProducts.map((product) => `<span>${product.brand} | ${product.name}</span>`).join("")}
        </div>
        <div class="product-card__button-group">
          <button class="btn btn--primary btn--small" type="button" data-open-concern="${concern.id}">Ver seleccion</button>
          <button class="btn btn--ghost btn--small" type="button" data-open-quick-view="${leadProducts[0]?.id || ""}">Spotlight</button>
        </div>
      </article>
    `;
  }).join("");

  dom.routineGrid.innerHTML = concernCollections.slice(0, 4).map((concern) => `
    <article class="routine-card">
      <p class="eyebrow">Routine idea</p>
      <h3>${concern.label}</h3>
      <p>${concern.description}</p>
      <ol class="routine-list">
        ${concern.products.slice(0, 3).map((product) => `<li><strong>${product.brand}</strong><span>${product.name}</span></li>`).join("")}
      </ol>
      <button class="btn btn--secondary btn--small" type="button" data-open-concern="${concern.id}">Abrir ruta</button>
    </article>
  `).join("");
}

function renderLoves(force = false) {
  if (!force && state.activeScreen !== "lovesScreen") return;

  const lovedProducts = state.loves
    .map((id) => productMap.get(id))
    .filter(Boolean);
  const recentProducts = state.recentlyViewed
    .map((id) => productMap.get(id))
    .filter(Boolean);

  dom.lovesGrid.innerHTML = lovedProducts.length
    ? lovedProducts.map((product) => renderProductCard(product)).join("")
    : `
      <div class="empty-card empty-card--tall">
        <p class="eyebrow">Sin favoritos</p>
        <h3>Todavia no has guardado productos.</h3>
        <p>Explora el catalogo y usa el corazon para armar tu propia lista de loves.</p>
        <button class="btn btn--primary" type="button" data-screen-target="catalogScreen">Ir al catalogo</button>
      </div>
    `;

  dom.recentlyViewedGrid.innerHTML = recentProducts.length
    ? recentProducts.slice(0, 8).map((product) => renderProductCard(product)).join("")
    : `
      <div class="empty-card">
        <p class="eyebrow">Sin historial</p>
        <h3>Todavia no has abierto productos.</h3>
        <p>La vista rapida y el carrito iran llenando esta seccion automaticamente.</p>
      </div>
    `;

  attachImageFallbacks(dom.lovesGrid);
  attachImageFallbacks(dom.recentlyViewedGrid);
}

function updateHeaderMetrics() {
  const pricing = getPricingSummary();
  dom.headerCartCount.textContent = pricing.itemCount;
  dom.catalogCartCount.textContent = pricing.itemCount;
  dom.headerLovesCount.textContent = state.loves.length;
  dom.catalogLovesCount.textContent = state.loves.length;
  dom.heroProductCount.textContent = `${products.length}+`;
  dom.cartItemsCount.textContent = pricing.itemCount;
  dom.invoiceItemCount.textContent = pricing.itemCount;
}

function renderLoyaltyPanels() {
  const rewardValue = getRewardValueFromPoints(state.loyalty.points);

  dom.catalogTierBadge.textContent = state.loyalty.tier;
  dom.catalogPointsBalance.textContent = formatNumber(state.loyalty.points);
  dom.catalogAvailableReward.textContent = formatCurrency(rewardValue);
  dom.catalogViewedCount.textContent = String(state.recentlyViewed.length);
  dom.lovesCount.textContent = String(state.loves.length);
  dom.recentlyViewedCount.textContent = String(state.recentlyViewed.length);
  dom.lovesTierBadge.textContent = state.loyalty.tier;
  dom.loyaltyTierLabel.textContent = `${state.loyalty.tier} member`;
  dom.loyaltyPointsLabel.textContent = `${formatNumber(state.loyalty.points)} puntos disponibles en la cuenta.`;
  dom.loyaltyRewardLabel.textContent = `Beauty Cash disponible: ${formatCurrency(rewardValue)}`;
  checkoutFields.applyBeautyCash.checked = Boolean(state.checkout.applyBeautyCash);
}

function markOrderChanged() {
  invalidatePricingCache();

  if (state.invoice.status === "Paid" || state.invoice.snapshot) {
    state.checkout.invoiceNumber = generateInvoiceNumber();
    state.invoice.createdAt = "";
    checkoutFields.invoiceNumber.value = state.checkout.invoiceNumber;
  }

  if (state.invoice.status !== "Draft") {
    state.invoice.status = "Draft";
  }

  if (state.invoice.paidAt) {
    state.invoice.paidAt = "";
  }

  state.invoice.lastPointsEarned = 0;
  state.invoice.snapshot = null;

  if (!state.checkout.invoiceNumber) {
    state.checkout.invoiceNumber = generateInvoiceNumber();
  }
}

function addToCart(productId, triggerElement, options = {}) {
  const product = productMap.get(productId);
  if (!product) return;

  const existing = state.cart.find((item) => item.id === productId);
  const requestedQty = Math.max(1, Number(options.quantity) || 1);
  const desiredAutoReplenish = Boolean(options.autoReplenish && isAutoReplenishEligible(product));

  if (existing) {
    existing.qty += requestedQty;
    if (desiredAutoReplenish) {
      existing.autoReplenish = true;
    }
  } else {
    state.cart.push({
      id: productId,
      qty: requestedQty,
      autoReplenish: desiredAutoReplenish
    });
  }

  recordProductView(productId, false);
  markOrderChanged();
  saveState();
  renderStoreChrome();
  renderVisibleScreenContent();
  renderQuickView();
  createSparkles(triggerElement);
  showToast(`${product.brand} agregado al carrito.`);
}

function changeQuantity(productId, delta) {
  const item = state.cart.find((entry) => entry.id === productId);
  if (!item) return;

  item.qty += delta;
  if (item.qty <= 0) {
    state.cart = state.cart.filter((entry) => entry.id !== productId);
  }

  markOrderChanged();
  saveState();
  renderStoreChrome();
  renderVisibleScreenContent();
  renderQuickView();
}

function setAutoReplenish(productId, enabled) {
  const item = state.cart.find((entry) => entry.id === productId);
  const product = productMap.get(productId);
  if (!item || !product || !isAutoReplenishEligible(product)) return;

  item.autoReplenish = Boolean(enabled);
  markOrderChanged();
  saveState();
  renderStoreChrome();
  renderVisibleScreenContent();
  renderQuickView();
}

function removeItem(productId) {
  state.cart = state.cart.filter((entry) => entry.id !== productId);
  markOrderChanged();
  saveState();
  renderStoreChrome();
  renderVisibleScreenContent();
  renderQuickView();
}

function clearCartContents() {
  state.cart = [];
  markOrderChanged();
  saveState();
  renderStoreChrome();
  renderVisibleScreenContent();
  renderQuickView();
}

function renderCart(force = false) {
  if (!force && state.activeScreen !== "cartScreen") return;

  const pricing = getPricingSummary();
  const items = pricing.items;

  if (!items.length) {
    dom.cartItems.innerHTML = `
      <div class="empty-card empty-card--tall">
        <p class="eyebrow">Carrito vacio</p>
        <h3>Tu carrito aun no tiene productos.</h3>
        <p>Ve al catalogo, agrega productos y luego vuelve aqui para revisar cantidades, envio y factura.</p>
        <button class="btn btn--primary" type="button" data-screen-target="catalogScreen">Ir al catalogo</button>
      </div>
    `;
  } else {
    dom.cartItems.innerHTML = items.map((item) => `
      <article class="cart-item">
        <div class="cart-item__media">
          <img src="${item.image}" alt="${item.brand} ${item.name}" loading="lazy" data-fallback="${item.fallbackImage}">
        </div>

        <div class="cart-item__info">
          <p class="product-card__brand">${item.brand}</p>
          <h3>${item.name}</h3>
          <p>${item.subcategory} | ${item.priceLabel}</p>
          <a href="${item.sourceUrl}" target="_blank" rel="noreferrer">Ver fuente Sephora</a>
          ${isAutoReplenishEligible(item) ? `
            <label class="toggle-row toggle-row--inline">
              <input type="checkbox" data-auto-replenish="${item.id}" ${item.autoReplenish ? "checked" : ""}>
              <span>Auto-Replenish 5% de ahorro</span>
            </label>
          ` : `<p class="cart-item__perk">Auto-Replenish no disponible para esta categoria.</p>`}
        </div>

        <div class="cart-item__controls">
          <div class="qty-control">
            <button type="button" data-qty-action="decrease" data-item-id="${item.id}">-</button>
            <span>${item.qty}</span>
            <button type="button" data-qty-action="increase" data-item-id="${item.id}">+</button>
          </div>

          <div class="cart-item__totals">
            <small>Base: ${formatCurrency(item.baseLineTotal)}</small>
            <small>Ahorro: ${formatCurrency(item.lineSavings)}</small>
            <strong>${formatCurrency(item.lineTotal)}</strong>
          </div>
        </div>

        <button class="cart-item__remove" type="button" data-remove-item="${item.id}">Eliminar</button>
      </article>
    `).join("");

    attachImageFallbacks(dom.cartItems);
  }

  dom.cartSubtotal.textContent = formatCurrency(pricing.subtotal);
  dom.cartSavings.textContent = formatCurrency(pricing.itemSavings + pricing.promoSavings + pricing.shippingSavings + pricing.rewardSavings);
  dom.cartShipping.textContent = formatCurrency(pricing.shipping);
  dom.cartTotal.textContent = formatCurrency(pricing.total);
}
function renderSamples() {
  dom.samplesGrid.innerHTML = sampleCatalog.map((sample) => {
    const selected = state.checkout.sampleIds.includes(sample.id);
    return `
      <button class="sample-option ${selected ? "is-selected" : ""}" type="button" data-sample-id="${sample.id}">
        <img src="${sample.image}" alt="${sample.brand} ${sample.name}" data-fallback="assets/images/hero-skincare.jpg">
        <div>
          <strong>${sample.brand}</strong>
          <span>${sample.name}</span>
          <small>${sample.description}</small>
        </div>
      </button>
    `;
  }).join("");

  attachImageFallbacks(dom.samplesGrid);
}

function renderCheckoutPerks(force = false) {
  if (!force && state.activeScreen !== "checkoutScreen") return;

  const pricing = getPricingSummary();
  const enteredCode = normalizeCode(state.checkout.promoCode);
  const previewPromo = getPromoEvaluation(pricing.items, enteredCode);

  if (!enteredCode) {
    dom.promoFeedback.textContent = "Usa una promo para aplicar descuento o envio gratis.";
    dom.promoFeedback.dataset.state = "idle";
  } else if (state.checkout.appliedPromoCode === enteredCode && pricing.promo.valid) {
    dom.promoFeedback.textContent = `${pricing.promo.code} aplicado: ${pricing.promo.appliedLabel}.`;
    dom.promoFeedback.dataset.state = "success";
  } else {
    dom.promoFeedback.textContent = previewPromo.message;
    dom.promoFeedback.dataset.state = previewPromo.valid ? "ready" : "error";
  }

  renderSamples();
}

function renderCheckoutSummary(force = false) {
  if (!force && state.activeScreen !== "checkoutScreen") return;

  const pricing = getPricingSummary();
  const items = pricing.items;
  const shippingMeta = getShippingMeta(state.checkout.shippingMethod);

  if (!items.length) {
    dom.checkoutSummary.innerHTML = `
      <p class="eyebrow">Resumen</p>
      <h3>Checkout vacio</h3>
      <p>No hay productos en el carrito todavia. Agrega productos desde el catalogo para completar esta seccion.</p>
      <button class="btn btn--primary" type="button" data-screen-target="catalogScreen">Agregar productos</button>
    `;
    return;
  }

  const previewItems = items.slice(0, 5);
  const hiddenItems = items.length - previewItems.length;
  const promoText = pricing.promo.valid ? pricing.promo.appliedLabel : "Sin promo aplicada";
  const rewardText = pricing.rewardSavings ? `-${formatCurrency(pricing.rewardSavings)}` : "No aplicada";

  dom.checkoutSummary.innerHTML = `
    <p class="eyebrow">Resumen de compra</p>
    <h3>Checkout overview</h3>

    <div class="summary-list">
      ${previewItems.map((item) => `
        <div class="summary-list__item">
          <div>
            <span>${item.brand}</span>
            <strong>${item.qty} x ${item.name}</strong>
          </div>
          <strong>${formatCurrency(item.lineTotal)}</strong>
        </div>
      `).join("")}
      ${hiddenItems > 0 ? `<p class="summary-note">Y ${hiddenItems} productos mas en el carrito.</p>` : ""}
    </div>

    <div class="summary-row">
      <span>Metodo de envio</span>
      <strong>${shippingMeta.label}</strong>
    </div>
    <div class="summary-row">
      <span>Pago</span>
      <strong>${paymentLabels[state.checkout.paymentMethod]}</strong>
    </div>
    <div class="summary-row">
      <span>Promo</span>
      <strong>${promoText}</strong>
    </div>
    <div class="summary-row">
      <span>Muestras</span>
      <strong>${pricing.sampleSummary}</strong>
    </div>
    <div class="summary-row">
      <span>Subtotal</span>
      <strong>${formatCurrency(pricing.subtotal)}</strong>
    </div>
    <div class="summary-row">
      <span>Ahorros</span>
      <strong>${formatCurrency(pricing.itemSavings + pricing.promoSavings + pricing.shippingSavings)}</strong>
    </div>
    <div class="summary-row">
      <span>Beauty Cash</span>
      <strong>${rewardText}</strong>
    </div>
    <div class="summary-row">
      <span>Envio</span>
      <strong>${formatCurrency(pricing.shipping)}</strong>
    </div>
    <div class="summary-row summary-row--grand">
      <span>Total</span>
      <strong>${formatCurrency(pricing.total)}</strong>
    </div>

    <div class="summary-actions">
      <button class="btn btn--primary" type="button" id="checkoutCreateInvoice">Crear factura</button>
      <button class="btn btn--ghost" type="button" data-screen-target="cartScreen">Volver al carrito</button>
    </div>
  `;
}

function renderShippingCountries() {
  dom.shippingCountriesGrid.innerHTML = shippingCountries.map((country) => `
    <article class="country-card">
      <p class="eyebrow">${country.name}</p>
      <h3>${country.eta}</h3>
      <div class="country-card__meta">
        <span>Recargo: ${country.surcharge ? formatCurrency(country.surcharge) : "Base local"}</span>
        <span>${localFulfillmentCountries.has(country.name) ? "Same-day disponible" : "Standard y premium"}</span>
      </div>
      <p>${country.note}</p>
    </article>
  `).join("");
}

function populateCountryOptions() {
  dom.customerCountry.innerHTML = shippingCountries.map((country) => `
    <option value="${country.name}">${country.name}</option>
  `).join("");
}

function syncCheckoutForm() {
  Object.entries(checkoutFields).forEach(([key, field]) => {
    if (!field) return;

    if (field.type === "checkbox") {
      field.checked = Boolean(state.checkout[key]);
      return;
    }

    field.value = state.checkout[key] || "";
  });
}

function syncStateFromForm() {
  state.checkout.customerName = checkoutFields.customerName.value;
  state.checkout.customerPhone = checkoutFields.customerPhone.value;
  state.checkout.customerEmail = checkoutFields.customerEmail.value;
  state.checkout.customerAddress = checkoutFields.customerAddress.value;
  state.checkout.customerCity = checkoutFields.customerCity.value;
  state.checkout.customerCountry = checkoutFields.customerCountry.value;
  state.checkout.orderDate = checkoutFields.orderDate.value;
  state.checkout.shippingMethod = checkoutFields.shippingMethod.value;
  state.checkout.paymentMethod = checkoutFields.paymentMethod.value;
  state.checkout.orderNotes = checkoutFields.orderNotes.value;
  state.checkout.invoiceNumber = checkoutFields.invoiceNumber.value || state.checkout.invoiceNumber;
  state.checkout.giftMessage = checkoutFields.giftMessage.value;
  state.checkout.promoCode = normalizeCode(checkoutFields.promoCode.value);
  state.checkout.applyBeautyCash = checkoutFields.applyBeautyCash.checked;
  invalidatePricingCache();
}

function buildInvoiceSnapshot() {
  const pricing = getPricingSummary();
  const shippingMeta = getShippingMeta(state.checkout.shippingMethod);
  const countryMeta = getCountryMeta(state.checkout.customerCountry);

  return {
    items: pricing.items,
    subtotal: pricing.subtotal,
    itemSavings: pricing.itemSavings + pricing.promoSavings + pricing.shippingSavings,
    rewardSavings: pricing.rewardSavings,
    rewardPointsCost: pricing.rewardPointsCost,
    totalSavings: pricing.totalSavings,
    shipping: pricing.shipping,
    total: pricing.total,
    itemCount: pricing.itemCount,
    invoiceNumber: state.checkout.invoiceNumber,
    orderDate: state.checkout.orderDate,
    createdAt: state.invoice.createdAt,
    customerName: state.checkout.customerName.trim(),
    customerPhone: state.checkout.customerPhone.trim(),
    customerEmail: state.checkout.customerEmail.trim(),
    customerAddress: state.checkout.customerAddress.trim(),
    customerCity: state.checkout.customerCity.trim(),
    customerCountry: state.checkout.customerCountry,
    shippingMethod: shippingMeta.label,
    shippingEta: countryMeta.eta,
    paymentMethod: paymentLabels[state.checkout.paymentMethod],
    notes: state.checkout.orderNotes.trim() || "Gracias por confiar en Makeup by Lala.",
    giftMessage: state.checkout.giftMessage.trim() || "Sin mensaje de regalo",
    promoLabel: pricing.promo.valid ? `${pricing.promo.code} | ${pricing.promo.appliedLabel}` : "Sin promo aplicada",
    rewardLabel: pricing.rewardSavings ? `Beauty Cash aplicado: -${formatCurrency(pricing.rewardSavings)}` : "Sin Beauty Cash",
    loyaltyTier: state.loyalty.tier,
    pointsEarned: pricing.pointsEarned,
    samples: getSelectedSamples().map((sample) => sample.name),
    sampleSummary: pricing.sampleSummary,
    status: state.invoice.status,
    paidAt: state.invoice.paidAt,
    cartEntries: state.cart.map((entry) => ({ ...entry }))
  };
}

function syncInvoiceSnapshotMeta() {
  if (!state.invoice.snapshot) return;

  state.invoice.snapshot.status = state.invoice.status;
  state.invoice.snapshot.createdAt = state.invoice.createdAt;
  state.invoice.snapshot.paidAt = state.invoice.paidAt;
  state.invoice.snapshot.invoiceNumber = state.checkout.invoiceNumber;
}

function captureInvoiceSnapshot({ clearCart = false } = {}) {
  state.invoice.snapshot = structuredClone(buildInvoiceSnapshot());
  syncInvoiceSnapshotMeta();

  if (clearCart) {
    state.cart = [];
  }

  return state.invoice.snapshot;
}

function getInvoiceDocumentData() {
  if (!state.invoice.snapshot) {
    return buildInvoiceSnapshot();
  }

  syncInvoiceSnapshotMeta();
  return structuredClone(state.invoice.snapshot);
}

function restoreCartFromInvoiceSnapshot() {
  const archivedCart = state.invoice.snapshot?.cartEntries;
  if (!Array.isArray(archivedCart) || !archivedCart.length) return false;

  state.cart = archivedCart
    .map(normalizeCartEntry)
    .filter(Boolean);

  invalidatePricingCache();
  return state.cart.length > 0;
}

function renderInvoice(force = false) {
  if (!force && state.activeScreen !== "invoiceScreen") return;

  const invoice = getInvoiceDocumentData();

  dom.invoicePreviewNumber.textContent = invoice.invoiceNumber || "MBL-0000";
  dom.invoicePreviewDate.textContent = formatDate(invoice.orderDate);
  dom.invoicePreviewPayment.textContent = invoice.paymentMethod || "Metodo pendiente";
  dom.invoicePreviewName.textContent = invoice.customerName || "Nombre pendiente";
  dom.invoicePreviewPhone.textContent = invoice.customerPhone || "Telefono pendiente";
  dom.invoicePreviewEmail.textContent = invoice.customerEmail || "Correo pendiente";
  dom.invoicePreviewShipping.textContent = invoice.shippingMethod || "Envio pendiente";
  dom.invoicePreviewCountry.textContent = invoice.customerCountry
    ? `${invoice.customerCountry} | ${invoice.shippingEta}`
    : "Pais pendiente";
  dom.invoicePreviewAddress.textContent = invoice.customerAddress
    ? `${invoice.customerAddress}, ${invoice.customerCity}`
    : "Direccion pendiente";
  dom.invoicePreviewNotes.textContent = invoice.notes;
  dom.invoicePreviewGiftMessage.textContent = invoice.giftMessage;
  dom.invoicePreviewPromo.textContent = invoice.promoLabel;
  dom.invoicePreviewReward.textContent = invoice.rewardLabel;
  dom.invoicePreviewTier.textContent = invoice.loyaltyTier;
  dom.invoicePreviewPoints.textContent = `${formatNumber(invoice.pointsEarned)} puntos estimados`;
  dom.invoicePreviewSamples.textContent = invoice.samples.length ? invoice.samples.join(" | ") : "Sin muestras seleccionadas";
  dom.invoicePreviewSubtotal.textContent = formatCurrency(invoice.subtotal);
  dom.invoicePreviewSavings.textContent = formatCurrency(invoice.itemSavings);
  dom.invoicePreviewRewardSavings.textContent = formatCurrency(invoice.rewardSavings);
  dom.invoicePreviewShippingCost.textContent = formatCurrency(invoice.shipping);
  dom.invoicePreviewTotal.textContent = formatCurrency(invoice.total);

  dom.invoiceStatusBadge.textContent = invoice.status;
  dom.invoiceStatusBadge.dataset.status = normalizeText(invoice.status).replace(/\s+/g, "-");
  dom.invoiceStatusText.textContent = `Estado: ${invoice.status}`;
  dom.invoiceItemCount.textContent = String(invoice.itemCount);
  dom.invoicePaidDate.textContent = invoice.paidAt ? `Pagado: ${formatDateTime(invoice.paidAt)}` : "Pagado: Pendiente";
  dom.invoiceEarnedPoints.textContent = `Puntos: ${formatNumber(invoice.pointsEarned)}`;
  dom.invoiceTierStatus.textContent = `Nivel: ${invoice.loyaltyTier}`;

  if (!invoice.items.length) {
    dom.invoiceItems.innerHTML = `<div class="invoice-empty">No hay productos en la factura todavia. Agrega articulos desde el catalogo.</div>`;
  } else {
    dom.invoiceItems.innerHTML = invoice.items.map((item) => `
      <div class="invoice-table__row">
        <div class="invoice-row__product">
          <strong>${item.name}</strong>
          <small>${item.brand}${item.autoReplenish ? " | Auto-Replenish" : ""}</small>
        </div>
        <span class="invoice-cell" data-label="Precio">${formatCurrency(item.price)}</span>
        <span class="invoice-cell" data-label="Cantidad">${item.qty}</span>
        <span class="invoice-cell" data-label="Ahorro">${formatCurrency(item.lineSavings)}</span>
        <strong class="invoice-cell invoice-cell--total" data-label="Total">${formatCurrency(item.lineTotal)}</strong>
      </div>
    `).join("");
  }
}

function renderHistorySummary() {
  const paidOrders = state.orderHistory.filter((order) => order.status === "Paid").length;
  const modeLabel = state.database.ready
    ? `${state.database.mode} activa`
    : state.database.mode || "Inicializando";

  dom.dbModeLabel.textContent = modeLabel;
  dom.dbLastSync.textContent = state.database.lastSyncedAt
    ? `Ultima sincronizacion: ${formatDateTime(state.database.lastSyncedAt)}`
    : "Todavia no hay sincronizacion guardada.";
  dom.dbOrdersCount.textContent = String(state.orderHistory.length);
  dom.dbPaidCount.textContent = String(paidOrders);
}

function renderHistory(force = false) {
  renderHistorySummary();
  if (!force && state.activeScreen !== "historyScreen") return;

  if (!state.orderHistory.length) {
    dom.historyList.innerHTML = `
      <div class="empty-card">
        <p class="eyebrow">Sin registros</p>
        <h3>Todavia no hay facturas guardadas en la base de datos.</h3>
        <p>Cuando prepares o pagues una factura, se guardara aqui para que puedas recuperarla despues.</p>
      </div>
    `;
    return;
  }

  dom.historyList.innerHTML = state.orderHistory.map((order) => `
    <article class="history-card">
      <div class="history-card__top">
        <div>
          <p class="history-card__eyebrow">${order.invoiceNumber}</p>
          <h3>${order.customerName || "Cliente sin nombre"}</h3>
        </div>
        <span class="history-card__status history-card__status--${normalizeText(order.status).replace(/\s+/g, "-")}">
          ${order.status}
        </span>
      </div>

      <div class="history-card__grid">
        <div>
          <span>Total</span>
          <strong>${formatCurrency(order.total || 0)}</strong>
        </div>
        <div>
          <span>Items</span>
          <strong>${order.itemCount || 0}</strong>
        </div>
        <div>
          <span>Ahorros</span>
          <strong>${formatCurrency(order.savings || 0)}</strong>
        </div>
        <div>
          <span>Puntos</span>
          <strong>${formatNumber(order.pointsEarned || 0)}</strong>
        </div>
      </div>

      <div class="history-card__meta">
        <span>${order.checkout?.paymentMethod ? paymentLabels[order.checkout.paymentMethod] : "Pago pendiente"}</span>
        <span>${order.checkout?.shippingMethod ? getShippingMeta(order.checkout.shippingMethod).label : "Envio pendiente"}</span>
        <span>${order.loyaltyTier || state.loyalty.tier}</span>
      </div>

      <div class="history-card__actions">
        <button class="btn btn--primary btn--small" type="button" data-history-action="restore" data-order-id="${order.id}">
          Recuperar venta
        </button>
        <button class="btn btn--ghost btn--small" type="button" data-history-action="invoice" data-order-id="${order.id}">
          Abrir factura
        </button>
      </div>
    </article>
  `).join("");
}

function renderQuickView() {
  const product = productMap.get(state.quickViewProductId);
  if (!product) {
    dom.quickViewModal.hidden = true;
    dom.quickViewModal.classList.remove("is-open");
    document.body.classList.remove("has-modal");
    return;
  }

  const insights = getProductInsights(product);
  const cartItem = state.cart.find((item) => item.id === product.id);
  const loved = state.loves.includes(product.id);

  dom.quickViewBrand.textContent = product.brand;
  dom.quickViewTitle.textContent = product.name;
  dom.quickViewDescription.textContent = product.description;
  dom.quickViewPrice.textContent = product.priceLabel;
  dom.quickViewRating.textContent = `${insights.rating} ★ | ${formatNumber(insights.reviews)} resenas`;
  dom.quickViewCategory.textContent = product.categoryLabel;
  dom.quickViewBadge.textContent = insights.primaryBadge;
  dom.quickViewSource.href = product.sourceUrl;
  dom.quickViewImage.src = product.image;
  dom.quickViewImage.alt = `${product.brand} ${product.name}`;
  dom.quickViewImage.dataset.fallback = product.fallbackImage;
  dom.quickViewAutoReplenish.checked = Boolean(cartItem?.autoReplenish);
  dom.quickViewAutoReplenish.disabled = !isAutoReplenishEligible(product);
  dom.quickViewLoveButton.textContent = loved ? "Quitar de loves" : "Guardar en loves";
  dom.quickViewLoveButton.dataset.productId = product.id;
  dom.quickViewAddButton.dataset.productId = product.id;

  dom.quickViewModal.hidden = false;
  requestAnimationFrame(() => dom.quickViewModal.classList.add("is-open"));
  document.body.classList.add("has-modal");
  attachImageFallbacks(dom.quickViewModal);
}

function openQuickView(productId) {
  if (!productMap.has(productId)) return;
  state.quickViewProductId = productId;
  recordProductView(productId, true);
  renderLoyaltyPanels();
  renderQuickView();
}

function closeQuickView() {
  state.quickViewProductId = "";
  dom.quickViewModal.classList.remove("is-open");
  dom.quickViewModal.hidden = true;
  document.body.classList.remove("has-modal");
}

function renderAll() {
  renderStoreChrome();
  renderVisibleScreenContent(true);
  renderQuickView();
}
function applyLoadedState(loadedState, options = {}) {
  if (!loadedState) return;
  const { restoreActiveScreen = true } = options;

  if (restoreActiveScreen) {
    state.activeScreen = screenIds.includes(loadedState.activeScreen)
      ? loadedState.activeScreen
      : state.activeScreen;
  }
  state.filters = {
    ...state.filters,
    ...(loadedState.filters || {})
  };
  state.cart = (Array.isArray(loadedState.cart) ? loadedState.cart : state.cart)
    .map(normalizeCartEntry)
    .filter(Boolean);
  state.loves = [...new Set(Array.isArray(loadedState.loves) ? loadedState.loves : state.loves)]
    .filter((id) => productMap.has(id));
  state.recentlyViewed = [...new Set(Array.isArray(loadedState.recentlyViewed) ? loadedState.recentlyViewed : state.recentlyViewed)]
    .filter((id) => productMap.has(id))
    .slice(0, 12);
  state.checkout = {
    ...state.checkout,
    ...(loadedState.checkout || {})
  };
  state.invoice = {
    ...state.invoice,
    ...(loadedState.invoice || {})
  };
  state.loyalty = {
    ...state.loyalty,
    ...(loadedState.loyalty || {})
  };

  state.loyalty.points = Math.max(0, Number(state.loyalty.points) || 0);
  state.loyalty.lifetimeSpend = Math.max(0, Number(state.loyalty.lifetimeSpend) || 0);
  state.loyalty.tier = getTierFromSpend(state.loyalty.lifetimeSpend);
  state.filters.brand = state.filters.brand === "all" || availableBrandSet.has(state.filters.brand)
    ? state.filters.brand
    : "all";
  state.checkout.promoCode = normalizeCode(state.checkout.promoCode);
  state.checkout.appliedPromoCode = normalizeCode(state.checkout.appliedPromoCode);
  state.checkout.sampleIds = Array.isArray(state.checkout.sampleIds)
    ? state.checkout.sampleIds.filter((id) => sampleCatalog.some((sample) => sample.id === id)).slice(0, 2)
    : sampleCatalog.slice(0, 2).map((sample) => sample.id);
  state.checkout.applyBeautyCash = Boolean(state.checkout.applyBeautyCash);
  state.quickViewProductId = "";
  invalidatePricingCache();
}

async function refreshHistory() {
  if (!window.makeupDb?.listOrders) return;

  state.orderHistory = await window.makeupDb.listOrders();
  state.database.mode = window.makeupDb.getMode();
  state.database.ready = window.makeupDb.isReady();
  state.database.lastSyncedAt = new Date().toISOString();
  renderHistory();
}

async function persistCurrentOrderRecord() {
  if (!window.makeupDb?.upsertOrder || !state.checkout.invoiceNumber) return;

  const invoice = getInvoiceDocumentData();
  const timestamp = new Date().toISOString();
  const recordCart = Array.isArray(invoice.cartEntries) && invoice.cartEntries.length
    ? structuredClone(invoice.cartEntries)
    : structuredClone(state.cart);

  await window.makeupDb.upsertOrder({
    id: state.checkout.invoiceNumber,
    invoiceNumber: state.checkout.invoiceNumber,
    customerName: state.checkout.customerName,
    itemCount: invoice.itemCount,
    subtotal: invoice.subtotal,
    shipping: invoice.shipping,
    total: invoice.total,
    savings: invoice.totalSavings,
    rewardSavings: invoice.rewardSavings,
    pointsEarned: invoice.pointsEarned,
    loyaltyTier: invoice.loyaltyTier,
    status: state.invoice.status,
    paidAt: state.invoice.paidAt,
    createdAt: state.invoice.createdAt || timestamp,
    updatedAt: timestamp,
    cart: recordCart,
    checkout: structuredClone(state.checkout),
    invoice: structuredClone(state.invoice),
    loyalty: structuredClone(state.loyalty)
  });

  await refreshHistory();
}

async function restoreOrderRecord(orderId, targetScreen = "historyScreen") {
  if (!window.makeupDb?.getOrder) return;

  const record = await window.makeupDb.getOrder(orderId);
  if (!record) {
    showToast("No se encontro ese registro en la base de datos.");
    return;
  }

  applyLoadedState({
    activeScreen: targetScreen,
    filters: state.filters,
    cart: record.cart,
    checkout: record.checkout,
    invoice: record.invoice,
    loyalty: record.loyalty || state.loyalty,
    loves: state.loves,
    recentlyViewed: state.recentlyViewed
  });

  syncCheckoutForm();
  saveState();
  setActiveScreen(targetScreen);
  renderQuickView();
  showToast(`Venta ${record.invoiceNumber} recuperada.`);
}

async function exportDatabaseBackup(triggerElement) {
  if (!window.makeupDb?.exportBackup) return;

  const backup = await window.makeupDb.exportBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  downloadBlob(blob, `makeup-by-lala-backup-${Date.now()}.json`);
  createSparkles(triggerElement);
  showToast("Respaldo exportado correctamente.");
}

async function syncStateFromDatabase() {
  if (!window.makeupDb?.init) {
    renderHistorySummary();
    return;
  }

  await window.makeupDb.init();
  const savedState = await window.makeupDb.loadAppState();

  if (savedState) {
    applyLoadedState(savedState, { restoreActiveScreen: false });
    syncCheckoutForm();
  }

  state.activeScreen = "homeScreen";

  await refreshHistory();
  renderStoreChrome();
  setActiveScreen("homeScreen");
}

function validateOrder(showErrors = true) {
  if (!state.cart.length) {
    showToast("Agrega al menos un producto antes de continuar.");
    setActiveScreen("catalogScreen");
    return false;
  }

  syncStateFromForm();

  if (["same-day", "pickup", "curbside"].includes(state.checkout.shippingMethod)
    && !localFulfillmentCountries.has(state.checkout.customerCountry)) {
    showToast("Ese metodo de entrega solo esta disponible para Republica Dominicana o Puerto Rico.");
    setActiveScreen("checkoutScreen");
    return false;
  }

  if (showErrors && !dom.checkoutForm.reportValidity()) {
    setActiveScreen("checkoutScreen");
    return false;
  }

  if (!state.checkout.invoiceNumber) {
    state.checkout.invoiceNumber = generateInvoiceNumber();
    checkoutFields.invoiceNumber.value = state.checkout.invoiceNumber;
  }

  saveState();
  return true;
}

async function createInvoice(options = {}) {
  const { clearCart = false, silent = false } = options;
  const hasSnapshot = Boolean(state.invoice.snapshot?.items?.length);

  if (!hasSnapshot && !validateOrder(true)) return false;

  if (!state.invoice.createdAt) {
    state.invoice.createdAt = new Date().toISOString();
  }

  if (state.invoice.status === "Draft") {
    state.invoice.status = "Pending payment";
  }

  if (!hasSnapshot) {
    captureInvoiceSnapshot({ clearCart });
  } else {
    syncInvoiceSnapshotMeta();
  }

  saveState();
  await persistCurrentOrderRecord();
  setActiveScreen("invoiceScreen");

  if (!silent) {
    showToast(clearCart ? "Factura creada y carrito transferido." : "Factura preparada correctamente.");
  }

  return true;
}

function applyPromoFromInput(triggerElement) {
  syncStateFromForm();
  const code = normalizeCode(checkoutFields.promoCode.value);
  state.checkout.promoCode = code;

  if (!code) {
    state.checkout.appliedPromoCode = "";
    markOrderChanged();
    saveState();
    renderStoreChrome();
    renderVisibleScreenContent();
    showToast("Ingresa un codigo promocional antes de aplicarlo.");
    return;
  }

  const preview = getPromoEvaluation(getCartItemsDetailed(), code);
  if (!preview.valid) {
    state.checkout.appliedPromoCode = "";
    saveState();
    renderStoreChrome();
    renderVisibleScreenContent();
    showToast(preview.message);
    return;
  }

  state.checkout.appliedPromoCode = code;
  markOrderChanged();
  saveState();
  renderStoreChrome();
  renderVisibleScreenContent();
  createSparkles(triggerElement);
  showToast(`${code} aplicado correctamente.`);
}

function clearPromoCode(triggerElement) {
  state.checkout.promoCode = "";
  state.checkout.appliedPromoCode = "";
  checkoutFields.promoCode.value = "";
  markOrderChanged();
  saveState();
  renderStoreChrome();
  renderVisibleScreenContent();
  if (triggerElement) createSparkles(triggerElement);
  showToast("Codigo promocional limpiado.");
}

async function simulatePayment(triggerElement) {
  if (!await createInvoice({ clearCart: true, silent: true })) return;

  const invoice = getInvoiceDocumentData();
  state.loyalty.points = Math.max(0, state.loyalty.points - invoice.rewardPointsCost + invoice.pointsEarned);
  state.loyalty.lifetimeSpend = roundCurrency(state.loyalty.lifetimeSpend + invoice.total);
  state.loyalty.tier = getTierFromSpend(state.loyalty.lifetimeSpend);
  state.invoice.status = "Paid";
  state.invoice.paidAt = new Date().toISOString();
  state.invoice.lastPointsEarned = invoice.pointsEarned;
  syncInvoiceSnapshotMeta();
  if (state.invoice.snapshot) {
    state.invoice.snapshot.pointsEarned = invoice.pointsEarned;
    state.invoice.snapshot.loyaltyTier = state.loyalty.tier;
  }
  saveState();
  renderStoreChrome();
  renderVisibleScreenContent(true);
  await persistCurrentOrderRecord();
  createSparkles(triggerElement);
  showToast("Pago marcado como completado.");
}

function escapePdfText(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, "");
}

function wrapText(text, maxLength) {
  const words = escapePdfText(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxLength) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  });

  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function createPdfBlob(invoice) {
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 34;
  const textColor = "0.16 0.14 0.16";
  const mutedColor = "0.43 0.39 0.42";
  const softColor = "0.98 0.95 0.97";
  const lineColor = "0.88 0.81 0.85";
  const accent = "0.78 0.49 0.60";
  const accentDark = "0.41 0.22 0.29";
  const accentDeep = "0.33 0.17 0.24";
  const accentSoft = "0.96 0.90 0.93";
  const tableHeaderColor = "0.41 0.22 0.29";
  const stripeColor = "0.93 0.80 0.87";
  const zebraColor = "0.99 0.97 0.98";
  const white = "1 1 1";
  const commands = [];

  const y = (top) => (pageHeight - top).toFixed(2);
  const addRect = (x, top, width, height, fillColor) => {
    commands.push(`${fillColor} rg`);
    commands.push(`${x.toFixed(2)} ${(pageHeight - top - height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f`);
  };
  const addBorderRect = (x, top, width, height, strokeColor, lineWidth = 1) => {
    commands.push(`${strokeColor} RG`);
    commands.push(`${lineWidth} w`);
    commands.push(`${x.toFixed(2)} ${(pageHeight - top - height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re S`);
  };
  const addLine = (x1, top1, x2, top2, color, lineWidth = 1) => {
    commands.push(`${color} RG`);
    commands.push(`${lineWidth} w`);
    commands.push(`${x1.toFixed(2)} ${y(top1)} m ${x2.toFixed(2)} ${y(top2)} l S`);
  };
  const addPolygon = (points, fillColor) => {
    if (!points.length) return;
    commands.push(`${fillColor} rg`);
    commands.push(`${points[0][0].toFixed(2)} ${y(points[0][1])} m`);
    points.slice(1).forEach(([x, top]) => {
      commands.push(`${x.toFixed(2)} ${y(top)} l`);
    });
    commands.push("h f");
  };
  const addText = (text, x, top, size, color, font = "F1") => {
    commands.push("BT");
    commands.push(`/${font} ${size} Tf`);
    commands.push(`${color} rg`);
    commands.push(`${x.toFixed(2)} ${y(top)} Td`);
    commands.push(`(${escapePdfText(text)}) Tj`);
    commands.push("ET");
  };
  const estimateTextWidth = (text, size, font = "F1") => {
    const safeText = escapePdfText(text);
    return safeText.length * size * (font === "F2" ? 0.54 : 0.5);
  };
  const addRightText = (text, rightX, top, size, color, font = "F1") => {
    const width = estimateTextWidth(text, size, font);
    addText(text, rightX - width, top, size, color, font);
  };
  const addTextLines = (lines, x, top, size, color, leading = 14, font = "F1") => {
    lines.forEach((line, index) => {
      addText(line, x, top + (index * leading), size, color, font);
    });
  };

  const issuedLabel = invoice.createdAt
    ? formatDateTime(invoice.createdAt)
    : formatDate(invoice.orderDate);
  const paidLabel = invoice.paidAt
    ? formatDateTime(invoice.paidAt)
    : "Pendiente";
  const addressText = [invoice.customerAddress, invoice.customerCity].filter(Boolean).join(", ") || "Direccion pendiente";
  const tableTop = 296;
  const tableWidth = pageWidth - (margin * 2);
  const headerHeight = 142;
  const descX = margin + 14;
  const priceRight = margin + 316;
  const qtyRight = margin + 388;
  const savingsRight = margin + 470;
  const totalRight = pageWidth - margin - 14;
  const contentRight = pageWidth - margin;
  const paymentMethodLabel = paymentLabels[invoice.paymentMethod] || invoice.paymentMethod || "Metodo pendiente";

  addRect(0, 0, pageWidth, pageHeight, white);
  addRect(0, 0, pageWidth, headerHeight, accentDark);
  for (let stripeX = -140; stripeX < pageWidth + 140; stripeX += 10) {
    addLine(stripeX, 0, stripeX + 130, headerHeight, stripeColor, 0.6);
  }
  addRect(margin, 32, 58, 58, white);
  addBorderRect(margin, 32, 58, 58, stripeColor, 1.2);
  addText("ML", margin + 15, 69, 26, accentDark, "F2");
  addText("MAKEUP BY LALA", margin + 76, 62, 11, white, "F2");
  addText("Beauty boutique invoice", margin + 76, 82, 10, stripeColor);

  addRightText("FACTURA", contentRight, 58, 28, white, "F2");
  addRightText(`Factura: ${invoice.invoiceNumber || "MBL-0000"}`, contentRight, 86, 10.5, white, "F2");
  addRightText(`Fecha: ${issuedLabel}`, contentRight, 102, 9.6, stripeColor, "F2");
  addRightText(`Estado: ${invoice.status}`, contentRight, 117, 9.6, stripeColor, "F2");

  addText("INFORMACION DEL CLIENTE", margin + 8, 176, 13, textColor, "F2");
  addText("NOMBRE:", margin + 8, 204, 10, accentDark, "F2");
  addText(invoice.customerName || "Nombre pendiente", margin + 98, 204, 10, textColor);
  addText("NUMERO:", margin + 8, 224, 10, accentDark, "F2");
  addText(invoice.customerPhone || "Telefono pendiente", margin + 98, 224, 10, textColor);
  addText("CORREO:", margin + 8, 244, 10, accentDark, "F2");
  addText(invoice.customerEmail || "Correo pendiente", margin + 98, 244, 10, textColor);
  addText("DIRECCION:", margin + 8, 264, 10, accentDark, "F2");
  addTextLines(wrapText(addressText, 56).slice(0, 2), margin + 98, 264, 10, textColor, 12);

  addRightText(paymentMethodLabel, contentRight, 204, 10, textColor, "F2");
  addRightText(invoice.customerCountry || "Pais pendiente", contentRight, 224, 10, mutedColor);
  addRightText(invoice.shippingMethod || "Envio pendiente", contentRight, 244, 10, mutedColor);
  addRightText(`Entrega: ${invoice.shippingEta}`, contentRight, 264, 10, mutedColor);
  addLine(margin, 280, contentRight, 280, lineColor, 1);

  addRect(margin, tableTop, tableWidth, 28, tableHeaderColor);
  addText("DESCRIPCION", descX, tableTop + 18, 9.8, white, "F2");
  addRightText("PRECIO", priceRight, tableTop + 18, 9.6, white, "F2");
  addRightText("CANTIDAD", qtyRight, tableTop + 18, 9.6, white, "F2");
  addRightText("AHORRO", savingsRight, tableTop + 18, 9.6, white, "F2");
  addRightText("TOTAL", totalRight, tableTop + 18, 9.6, white, "F2");

  let currentTop = tableTop + 28;
  const visibleItems = invoice.items.slice(0, 5);
  const hiddenCount = Math.max(0, invoice.items.length - visibleItems.length);

  if (!visibleItems.length) {
    addRect(margin, currentTop, tableWidth, 36, softColor);
    addBorderRect(margin, currentTop, tableWidth, 36, lineColor);
    addText("No hay productos registrados en esta factura.", descX, currentTop + 22, 10, mutedColor);
    currentTop += 34;
  } else {
    visibleItems.forEach((item, index) => {
      const productLines = wrapText(item.name, 34).slice(0, 2);
      const detailLine = wrapText(`${item.brand}${item.autoReplenish ? " | Auto-Replenish" : ""}`, 44)[0];
      const rowHeight = 34 + ((productLines.length - 1) * 10);
      const contentTop = currentTop + 16;
      const valueTop = currentTop + Math.max(21, (rowHeight / 2) + 4);

      addRect(margin, currentTop, tableWidth, rowHeight, index % 2 === 0 ? white : zebraColor);
      addTextLines(productLines, descX, contentTop, 10, textColor, 11, "F2");
      addText(detailLine, descX, contentTop + (productLines.length * 11) + 2, 8.5, mutedColor);
      addRightText(formatCurrency(item.price), priceRight, valueTop, 10, textColor);
      addRightText(String(item.qty), qtyRight, valueTop, 10, textColor, "F2");
      addRightText(formatCurrency(item.lineSavings), savingsRight, valueTop, 10, textColor);
      addRightText(formatCurrency(item.lineTotal), totalRight, valueTop, 10, accentDark, "F2");
      addLine(margin, currentTop + rowHeight, contentRight, currentTop + rowHeight, lineColor, 0.8);
      currentTop += rowHeight;
    });

    if (hiddenCount > 0) {
      addRect(margin, currentTop, tableWidth, 26, softColor);
      addText(`${hiddenCount} producto(s) adicional(es) incluidos en la venta.`, descX, currentTop + 17, 9.5, mutedColor);
      currentTop += 28;
    }
  }

  const summaryTop = currentTop + 18;
  const noteText = [
    invoice.notes || "Gracias por confiar en Makeup by Lala.",
    invoice.giftMessage || "Sin mensaje de regalo",
    invoice.sampleSummary || "Sin muestras seleccionadas"
  ].join(" | ");
  const noteLines = wrapText(noteText, 66).slice(0, 3);
  const totalsX = pageWidth - margin - 174;
  const totalsRight = pageWidth - margin;
  const summaryRows = [
    ["Sub-total", formatCurrency(invoice.subtotal)],
    ["Descuento", formatCurrency(roundCurrency(invoice.itemSavings + invoice.rewardSavings))],
    ["Envio", formatCurrency(invoice.shipping)]
  ];

  addText("OBSERVACIONES", margin + 8, summaryTop + 6, 11, accentDark, "F2");
  addTextLines(noteLines, margin + 8, summaryTop + 28, 9.8, mutedColor, 14);

  let summaryRowTop = summaryTop + 6;
  summaryRows.forEach(([label, value]) => {
    addText(label, totalsX, summaryRowTop, 10.2, mutedColor);
    addRightText(value, totalsRight, summaryRowTop, 10.2, textColor, "F2");
    summaryRowTop += 20;
  });

  addRect(totalsX - 6, summaryTop + 70, totalsRight - totalsX + 12, 24, tableHeaderColor);
  addText("TOTAL", totalsX + 8, summaryTop + 86, 11.2, white, "F2");
  addRightText(formatCurrency(invoice.total), totalsRight - 8, summaryTop + 86, 13.2, white, "F2");

  const footerTop = 636;
  const footerWidth = pageWidth - (margin * 2);
  const footerGap = 22;
  const footerColWidth = (footerWidth - (footerGap * 2)) / 3;
  const footerCol2X = margin + footerColWidth + footerGap;
  const footerCol3X = footerCol2X + footerColWidth + footerGap;

  addText("CONTACTO", margin + 8, footerTop, 12, textColor, "F2");
  addText("@makeupbylala", margin + 8, footerTop + 26, 9.5, mutedColor);
  addText("support@makeupbylala.com", margin + 8, footerTop + 42, 9.5, mutedColor);
  addText("www.makeupbylala.com", margin + 8, footerTop + 58, 9.5, mutedColor);

  addText("INFORMACION DE PAGO", footerCol2X + 8, footerTop, 12, textColor, "F2");
  addText("Estado de factura", footerCol2X + 8, footerTop + 26, 9, mutedColor);
  addText(invoice.status, footerCol2X + 8, footerTop + 40, 10, textColor, "F2");
  addText("Metodo de pago", footerCol2X + 8, footerTop + 56, 9, mutedColor);
  addText(paymentMethodLabel, footerCol2X + 8, footerTop + 70, 10, textColor, "F2");
  addText(`Pagado: ${paidLabel}`, footerCol2X + 8, footerTop + 86, 9.4, mutedColor);

  addText("FIRMA", footerCol3X + 8, footerTop, 12, textColor, "F2");
  addLine(footerCol3X + 8, footerTop + 56, footerCol3X + footerColWidth - 12, footerTop + 56, accent, 1.2);
  addText("Makeup by Lala", footerCol3X + 8, footerTop + 76, 13.5, accentDark, "F2");
  addText("Beauty boutique studio", footerCol3X + 8, footerTop + 92, 9.5, mutedColor);

  addPolygon([
    [0, 774],
    [164, 742],
    [428, 760],
    [pageWidth, 732],
    [pageWidth, pageHeight],
    [0, pageHeight]
  ], accentDeep);

  for (let stripeX = -50; stripeX < pageWidth + 90; stripeX += 14) {
    addLine(stripeX, 770, stripeX + 85, pageHeight, stripeColor, 0.45);
  }

  const stream = commands.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";

  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

function downloadBlob(blob, filename) {
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadPdf(triggerElement) {
  if (!await createInvoice({ clearCart: true, silent: true })) return;

  const invoice = getInvoiceDocumentData();
  const pdfBlob = createPdfBlob(invoice);
  downloadBlob(pdfBlob, `${invoice.invoiceNumber}.pdf`);
  createSparkles(triggerElement);
  showToast("PDF descargado correctamente.");
}
async function handleDocumentClick(event) {
  if (event.target === dom.quickViewModal) {
    closeQuickView();
    return;
  }

  const closeModalButton = event.target.closest("[data-close-modal]");
  if (closeModalButton) {
    closeQuickView();
    return;
  }

  const brandButton = event.target.closest("[data-open-brand]");
  if (brandButton) {
    openBrandExperience(brandButton.dataset.openBrand);
    return;
  }

  const concernButton = event.target.closest("[data-open-concern]");
  if (concernButton) {
    openConcernExperience(concernButton.dataset.openConcern);
    return;
  }

  const offerButton = event.target.closest("[data-open-offer-category]");
  if (offerButton) {
    openOfferCollection(offerButton.dataset.openOfferCategory);
    return;
  }

  const promoButton = event.target.closest("[data-apply-store-promo]");
  if (promoButton) {
    const promoCode = normalizeCode(promoButton.dataset.applyStorePromo);
    state.checkout.promoCode = promoCode;
    checkoutFields.promoCode.value = promoCode;
    state.checkout.appliedPromoCode = "";
    saveState();
    renderStoreChrome();
    setActiveScreen("checkoutScreen");
    showToast(`Promo ${promoCode} preparada en checkout.`);
    return;
  }

  const screenButton = event.target.closest("[data-screen-target]");
  if (screenButton) {
    setActiveScreen(screenButton.dataset.screenTarget);
    return;
  }

  const openCategoryButton = event.target.closest("[data-open-category]");
  if (openCategoryButton) {
    setActiveScreen("catalogScreen");
    setCategoryFilter(openCategoryButton.dataset.openCategory);
    return;
  }

  const categoryButton = event.target.closest("[data-category-filter]");
  if (categoryButton) {
    setCategoryFilter(categoryButton.dataset.categoryFilter);
    return;
  }

  const loveButton = event.target.closest("[data-toggle-love]");
  if (loveButton) {
    toggleLove(loveButton.dataset.toggleLove, loveButton);
    return;
  }

  const quickViewButton = event.target.closest("[data-open-quick-view]");
  if (quickViewButton) {
    openQuickView(quickViewButton.dataset.openQuickView);
    return;
  }

  const addButton = event.target.closest("[data-add-to-cart]");
  if (addButton) {
    addToCart(addButton.dataset.addToCart, addButton);
    return;
  }

  const sampleButton = event.target.closest("[data-sample-id]");
  if (sampleButton) {
    toggleSample(sampleButton.dataset.sampleId);
    return;
  }

  const qtyButton = event.target.closest("[data-qty-action]");
  if (qtyButton) {
    const delta = qtyButton.dataset.qtyAction === "increase" ? 1 : -1;
    changeQuantity(qtyButton.dataset.itemId, delta);
    return;
  }

  const removeButton = event.target.closest("[data-remove-item]");
  if (removeButton) {
    removeItem(removeButton.dataset.removeItem);
    return;
  }

  if (event.target.id === "emptyCatalogReset") {
    clearFilters();
    return;
  }

  if (event.target.id === "checkoutCreateInvoice") {
    await createInvoice({ clearCart: true });
    return;
  }

  const historyActionButton = event.target.closest("[data-history-action]");
  if (historyActionButton) {
    const orderId = historyActionButton.dataset.orderId;
    if (historyActionButton.dataset.historyAction === "restore") {
      await restoreOrderRecord(orderId, "checkoutScreen");
    } else if (historyActionButton.dataset.historyAction === "invoice") {
      await restoreOrderRecord(orderId, "invoiceScreen");
    }
  }
}

function handleDocumentChange(event) {
  const autoToggle = event.target.closest("[data-auto-replenish]");
  if (autoToggle) {
    setAutoReplenish(autoToggle.dataset.autoReplenish, autoToggle.checked);
  }
}

function bindEvents() {
  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("change", handleDocumentChange);

  dom.catalogSearch.addEventListener("input", (event) => {
    clearTimeout(catalogSearchDebounceId);
    state.filters.search = event.target.value;
    resetCatalogVisibleCount();
    catalogSearchDebounceId = window.setTimeout(() => {
      saveState();
      renderCatalog(true);
    }, performanceMode.lite ? 220 : 140);
  });

  dom.catalogSort.addEventListener("change", (event) => {
    state.filters.sort = event.target.value;
    resetCatalogVisibleCount();
    saveState();
    renderCatalog(true);
  });

  dom.catalogBrandFilter?.addEventListener("change", (event) => {
    setBrandFilter(event.target.value);
  });

  dom.clearCatalogFilters.addEventListener("click", clearFilters);
  dom.catalogLoadMore?.addEventListener("click", showMoreCatalogProducts);

  dom.goToCheckout.addEventListener("click", () => {
    if (!state.cart.length) {
      showToast("Agrega productos antes de pasar al checkout.");
      setActiveScreen("catalogScreen");
      return;
    }

    setActiveScreen("checkoutScreen");
  });

  dom.createInvoiceFromCart.addEventListener("click", async () => {
    await createInvoice({ clearCart: true });
  });

  dom.clearCart.addEventListener("click", () => {
    clearCartContents();
    showToast("Carrito vaciado.");
  });

  dom.checkoutForm.addEventListener("input", () => {
    syncStateFromForm();
    markOrderChanged();
    scheduleCheckoutRefresh(false);
  });

  dom.checkoutForm.addEventListener("change", () => {
    syncStateFromForm();
    markOrderChanged();
    scheduleCheckoutRefresh(true);
  });

  dom.applyPromoCode.addEventListener("click", (event) => {
    applyPromoFromInput(event.currentTarget);
  });

  dom.clearPromoCode.addEventListener("click", (event) => {
    clearPromoCode(event.currentTarget);
  });

  dom.payNowButton.addEventListener("click", (event) => {
    simulatePayment(event.currentTarget);
  });

  dom.downloadPdf.addEventListener("click", (event) => {
    downloadPdf(event.currentTarget);
  });

  dom.refreshHistory.addEventListener("click", () => {
    refreshHistory();
    showToast("Historial actualizado.");
  });

  dom.exportBackup.addEventListener("click", (event) => {
    exportDatabaseBackup(event.currentTarget);
  });

  dom.invoiceCheckoutButton.addEventListener("click", () => {
    if (!state.cart.length) {
      restoreCartFromInvoiceSnapshot();
      saveState();
      renderStoreChrome();
      renderVisibleScreenContent();
    }
    setActiveScreen("checkoutScreen");
  });

  dom.invoiceCatalogButton.addEventListener("click", () => {
    setActiveScreen("catalogScreen");
  });

  dom.quickViewLoveButton.addEventListener("click", (event) => {
    const productId = event.currentTarget.dataset.productId;
    if (!productId) return;
    toggleLove(productId, event.currentTarget);
    renderQuickView();
  });

  dom.quickViewAddButton.addEventListener("click", (event) => {
    const productId = event.currentTarget.dataset.productId;
    if (!productId) return;
    addToCart(productId, event.currentTarget, {
      autoReplenish: dom.quickViewAutoReplenish.checked
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeQuickView();
    }
  });

  window.addEventListener("resize", () => {
    clearTimeout(window.resizeCatalogTimeoutId);
    window.resizeCatalogTimeoutId = window.setTimeout(() => {
      if (state.activeScreen === "catalogScreen") {
        catalogVisibleCount = Math.max(catalogVisibleCount, getCatalogBatchSize());
        renderCatalog(true);
      }
    }, performanceMode.lite ? 240 : 150);
  });
}

function hydrateUIFromState() {
  state.activeScreen = "homeScreen";
  document.body.classList.toggle("performance-lite", performanceMode.lite);
  resetCatalogVisibleCount();
  populateCountryOptions();
  populateBrandOptions();
  syncCheckoutForm();
  dom.catalogSearch.value = state.filters.search;
  if (dom.catalogBrandFilter) {
    dom.catalogBrandFilter.value = state.filters.brand;
  }
  dom.catalogSort.value = state.filters.sort;
  setCategoryFilter(state.filters.category);
  renderShippingCountries();
  renderAll();
  setActiveScreen("homeScreen");
}

function initializeRevealObserver() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.12
  });

  document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
}

bindEvents();
hydrateUIFromState();
initializeRevealObserver();
syncStateFromDatabase();
