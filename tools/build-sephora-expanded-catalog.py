from __future__ import annotations

import json
import re
import time
import urllib.parse
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path


WORKSPACE = Path(__file__).resolve().parents[1]
CATALOG_DATA_PATH = WORKSPACE / "scripts" / "catalog-data.js"
CATALOG_EXTRA_PATH = WORKSPACE / "scripts" / "catalog-extra-data.js"
REAL_EXTRA_PATH = WORKSPACE / "scripts" / "sephora-real-extra-data.js"
IMAGE_DIR = WORKSPACE / "assets" / "images" / "products" / "real-extra"
IMAGE_DIR.mkdir(parents=True, exist_ok=True)

API_HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "application/json, text/plain, */*",
    "X-Requested-With": "XMLHttpRequest",
    "Accept-Language": "en-US,en;q=0.9",
}

TARGET_EXTRA_COUNT = 900
PAGE_SIZE = 60
MAX_PAGES_PER_QUERY = 2
REQUEST_DELAY_SECONDS = 0.18
DOWNLOAD_WORKERS = 10

CATEGORY_QUOTAS = {
    "makeup": 250,
    "lips": 160,
    "eyes": 155,
    "skincare": 250,
    "suncare": 45,
    "tools": 40,
}

QUERY_PLAN = [
    {"query": "foundation", "category": "makeup", "subcategory": "Foundation", "limit": 22},
    {"query": "lipstick", "category": "lips", "subcategory": "Lipstick", "limit": 18},
    {"query": "mascara", "category": "eyes", "subcategory": "Mascara", "limit": 18},
    {"query": "serum", "category": "skincare", "subcategory": "Serum", "limit": 20},
    {"query": "sunscreen", "category": "suncare", "subcategory": "Sunscreen", "limit": 12},
    {"query": "makeup sponge", "category": "tools", "subcategory": "Sponge", "limit": 8},
    {"query": "concealer", "category": "makeup", "subcategory": "Concealer", "limit": 18},
    {"query": "lip gloss", "category": "lips", "subcategory": "Lip Gloss", "limit": 14},
    {"query": "eyeliner", "category": "eyes", "subcategory": "Eyeliner", "limit": 14},
    {"query": "moisturizer", "category": "skincare", "subcategory": "Moisturizer", "limit": 18},
    {"query": "foundation brush", "category": "tools", "subcategory": "Brush", "limit": 6},
    {"query": "blush", "category": "makeup", "subcategory": "Blush", "limit": 18},
    {"query": "lip oil", "category": "lips", "subcategory": "Lip Oil", "limit": 14},
    {"query": "eyeshadow", "category": "eyes", "subcategory": "Eyeshadow", "limit": 14},
    {"query": "cleanser", "category": "skincare", "subcategory": "Cleanser", "limit": 18},
    {"query": "bronzer", "category": "makeup", "subcategory": "Bronzer", "limit": 14},
    {"query": "lip balm", "category": "lips", "subcategory": "Lip Balm", "limit": 14},
    {"query": "brow gel", "category": "eyes", "subcategory": "Brow", "limit": 10},
    {"query": "toner", "category": "skincare", "subcategory": "Toner", "limit": 12},
    {"query": "powder brush", "category": "tools", "subcategory": "Brush", "limit": 4},
    {"query": "primer", "category": "makeup", "subcategory": "Primer", "limit": 14},
    {"query": "lip liner", "category": "lips", "subcategory": "Lip Liner", "limit": 12},
    {"query": "brow pencil", "category": "eyes", "subcategory": "Brow", "limit": 10},
    {"query": "face mask", "category": "skincare", "subcategory": "Mask", "limit": 14},
    {"query": "eyelash curler", "category": "tools", "subcategory": "Curler", "limit": 4},
    {"query": "setting powder", "category": "makeup", "subcategory": "Setting Powder", "limit": 12},
    {"query": "lip mask", "category": "lips", "subcategory": "Lip Mask", "limit": 10},
    {"query": "eye cream", "category": "skincare", "subcategory": "Eye Care", "limit": 14},
    {"query": "tweezers", "category": "tools", "subcategory": "Tweezers", "limit": 4},
    {"query": "setting spray", "category": "makeup", "subcategory": "Setting Spray", "limit": 10},
    {"query": "lip treatment", "category": "lips", "subcategory": "Lip Treatment", "limit": 10},
    {"query": "retinol serum", "category": "skincare", "subcategory": "Serum", "limit": 10},
    {"query": "makeup brush set", "category": "tools", "subcategory": "Brush", "limit": 4},
    {"query": "highlighter", "category": "makeup", "subcategory": "Highlighter", "limit": 14},
    {"query": "lip stain", "category": "lips", "subcategory": "Lip Tint", "limit": 10},
    {"query": "eye primer", "category": "eyes", "subcategory": "Eyeshadow", "limit": 8},
    {"query": "exfoliator", "category": "skincare", "subcategory": "Exfoliator", "limit": 10},
    {"query": "concealer brush", "category": "tools", "subcategory": "Brush", "limit": 3},
    {"query": "skin tint", "category": "makeup", "subcategory": "Skin Tint", "limit": 10},
    {"query": "lip plumper", "category": "lips", "subcategory": "Lip Gloss", "limit": 8},
    {"query": "brow wax", "category": "eyes", "subcategory": "Brow", "limit": 8},
    {"query": "face oil", "category": "skincare", "subcategory": "Face Oil", "limit": 8},
    {"query": "brush cleaner", "category": "tools", "subcategory": "Brush Cleaner", "limit": 3},
    {"query": "cc cream", "category": "makeup", "subcategory": "CC Cream", "limit": 10},
    {"query": "lip scrub", "category": "lips", "subcategory": "Lip Scrub", "limit": 6},
    {"query": "essence", "category": "skincare", "subcategory": "Essence", "limit": 8},
    {"query": "sharpener", "category": "tools", "subcategory": "Sharpener", "limit": 2},
    {"query": "illuminator", "category": "makeup", "subcategory": "Illuminator", "limit": 8},
    {"query": "tinted moisturizer", "category": "makeup", "subcategory": "Skin Tint", "limit": 8},
    {"query": "acne treatment", "category": "skincare", "subcategory": "Acne Care", "limit": 8},
    {"query": "mineral sunscreen", "category": "suncare", "subcategory": "Sunscreen", "limit": 4},
    {"query": "tinted sunscreen", "category": "suncare", "subcategory": "Sunscreen", "limit": 4},
    {"query": "contour", "category": "makeup", "subcategory": "Bronzer", "limit": 12},
    {"query": "contour stick", "category": "makeup", "subcategory": "Bronzer", "limit": 10},
    {"query": "powder foundation", "category": "makeup", "subcategory": "Foundation", "limit": 10},
    {"query": "face palette", "category": "makeup", "subcategory": "Blush", "limit": 10},
    {"query": "pressed powder", "category": "makeup", "subcategory": "Setting Powder", "limit": 8},
    {"query": "loose powder", "category": "makeup", "subcategory": "Setting Powder", "limit": 8},
    {"query": "blush stick", "category": "makeup", "subcategory": "Blush", "limit": 10},
    {"query": "liquid blush", "category": "makeup", "subcategory": "Blush", "limit": 10},
    {"query": "cream blush", "category": "makeup", "subcategory": "Blush", "limit": 10},
    {"query": "foundation stick", "category": "makeup", "subcategory": "Foundation", "limit": 10},
    {"query": "bb cream", "category": "makeup", "subcategory": "CC Cream", "limit": 8},
    {"query": "tinted serum foundation", "category": "makeup", "subcategory": "Skin Tint", "limit": 8},
    {"query": "illuminating primer", "category": "makeup", "subcategory": "Primer", "limit": 8},
    {"query": "mattifying primer", "category": "makeup", "subcategory": "Primer", "limit": 8},
    {"query": "color corrector", "category": "makeup", "subcategory": "Concealer", "limit": 8},
    {"query": "complexion palette", "category": "makeup", "subcategory": "Blush", "limit": 6},
    {"query": "sculpt stick", "category": "makeup", "subcategory": "Bronzer", "limit": 8},
    {"query": "face mist", "category": "makeup", "subcategory": "Setting Spray", "limit": 6},
    {"query": "highlighting drops", "category": "makeup", "subcategory": "Highlighter", "limit": 6},
    {"query": "liquid lipstick", "category": "lips", "subcategory": "Lipstick", "limit": 12},
    {"query": "plumping gloss", "category": "lips", "subcategory": "Lip Gloss", "limit": 10},
    {"query": "tinted balm", "category": "lips", "subcategory": "Lip Balm", "limit": 10},
    {"query": "lip cream", "category": "lips", "subcategory": "Lipstick", "limit": 8},
    {"query": "lip set", "category": "lips", "subcategory": "Lipstick", "limit": 8},
    {"query": "lip duo", "category": "lips", "subcategory": "Lip Gloss", "limit": 8},
    {"query": "matte lipstick", "category": "lips", "subcategory": "Lipstick", "limit": 10},
    {"query": "satin lipstick", "category": "lips", "subcategory": "Lipstick", "limit": 10},
    {"query": "lipstick set", "category": "lips", "subcategory": "Lipstick", "limit": 8},
    {"query": "lip pencil", "category": "lips", "subcategory": "Lip Liner", "limit": 8},
    {"query": "peptide lip treatment", "category": "lips", "subcategory": "Lip Treatment", "limit": 8},
    {"query": "gloss set", "category": "lips", "subcategory": "Lip Gloss", "limit": 6},
    {"query": "lip butter", "category": "lips", "subcategory": "Lip Balm", "limit": 8},
    {"query": "overnight lip mask", "category": "lips", "subcategory": "Lip Mask", "limit": 6},
    {"query": "eye palette", "category": "eyes", "subcategory": "Eyeshadow", "limit": 12},
    {"query": "eyeshadow palette", "category": "eyes", "subcategory": "Eyeshadow", "limit": 12},
    {"query": "shadow stick", "category": "eyes", "subcategory": "Eyeshadow", "limit": 8},
    {"query": "pencil eyeliner", "category": "eyes", "subcategory": "Eyeliner", "limit": 8},
    {"query": "liquid eyeliner", "category": "eyes", "subcategory": "Eyeliner", "limit": 8},
    {"query": "brow pen", "category": "eyes", "subcategory": "Brow", "limit": 8},
    {"query": "brow powder", "category": "eyes", "subcategory": "Brow", "limit": 6},
    {"query": "false lashes", "category": "eyes", "subcategory": "Mascara", "limit": 8},
    {"query": "lash serum", "category": "eyes", "subcategory": "Mascara", "limit": 8},
    {"query": "under eye corrector", "category": "eyes", "subcategory": "Brow", "limit": 8},
    {"query": "brow pomade", "category": "eyes", "subcategory": "Brow", "limit": 8},
    {"query": "eye brightener", "category": "eyes", "subcategory": "Eyeshadow", "limit": 6},
    {"query": "cleansing balm", "category": "skincare", "subcategory": "Cleanser", "limit": 10},
    {"query": "cleansing oil", "category": "skincare", "subcategory": "Cleanser", "limit": 10},
    {"query": "face wash", "category": "skincare", "subcategory": "Cleanser", "limit": 10},
    {"query": "gel moisturizer", "category": "skincare", "subcategory": "Moisturizer", "limit": 10},
    {"query": "night cream", "category": "skincare", "subcategory": "Moisturizer", "limit": 10},
    {"query": "sleeping mask", "category": "skincare", "subcategory": "Mask", "limit": 8},
    {"query": "eye patches", "category": "skincare", "subcategory": "Eye Care", "limit": 8},
    {"query": "facial mist", "category": "skincare", "subcategory": "Toner", "limit": 8},
    {"query": "vitamin c serum", "category": "skincare", "subcategory": "Serum", "limit": 10},
    {"query": "peptide serum", "category": "skincare", "subcategory": "Serum", "limit": 8},
    {"query": "barrier cream", "category": "skincare", "subcategory": "Moisturizer", "limit": 8},
    {"query": "acne patch", "category": "skincare", "subcategory": "Acne Care", "limit": 8},
    {"query": "dark spot serum", "category": "skincare", "subcategory": "Serum", "limit": 10},
    {"query": "makeup remover", "category": "skincare", "subcategory": "Cleanser", "limit": 8},
    {"query": "exfoliating toner", "category": "skincare", "subcategory": "Exfoliator", "limit": 8},
    {"query": "micellar water", "category": "skincare", "subcategory": "Cleanser", "limit": 6},
    {"query": "sheet mask", "category": "skincare", "subcategory": "Mask", "limit": 8},
    {"query": "pore serum", "category": "skincare", "subcategory": "Serum", "limit": 8},
    {"query": "serum set", "category": "skincare", "subcategory": "Serum", "limit": 6},
    {"query": "hydrating toner", "category": "skincare", "subcategory": "Toner", "limit": 8},
    {"query": "essence toner", "category": "skincare", "subcategory": "Essence", "limit": 8},
    {"query": "face peel", "category": "skincare", "subcategory": "Exfoliator", "limit": 6},
    {"query": "repair cream", "category": "skincare", "subcategory": "Moisturizer", "limit": 8},
    {"query": "sunscreen stick", "category": "suncare", "subcategory": "Sunscreen", "limit": 8},
    {"query": "body sunscreen", "category": "suncare", "subcategory": "Sunscreen", "limit": 8},
    {"query": "face sunscreen", "category": "suncare", "subcategory": "Sunscreen", "limit": 8},
    {"query": "sunscreen spray", "category": "suncare", "subcategory": "Sunscreen", "limit": 6},
    {"query": "lip sunscreen", "category": "suncare", "subcategory": "Sunscreen", "limit": 4},
    {"query": "powder puff", "category": "tools", "subcategory": "Sponge", "limit": 6},
    {"query": "blending brush", "category": "tools", "subcategory": "Brush", "limit": 6},
    {"query": "bronzer brush", "category": "tools", "subcategory": "Brush", "limit": 6},
    {"query": "blush brush", "category": "tools", "subcategory": "Brush", "limit": 6},
    {"query": "eyeliner brush", "category": "tools", "subcategory": "Brush", "limit": 4},
    {"query": "brow brush", "category": "tools", "subcategory": "Brush", "limit": 4},
    {"query": "makeup mirror", "category": "tools", "subcategory": "Tool", "limit": 4},
    {"query": "face roller", "category": "tools", "subcategory": "Tool", "limit": 4},
    {"query": "gua sha", "category": "tools", "subcategory": "Tool", "limit": 4},
]


def normalize_text(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def repair_text(value: str) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    if any(marker in text for marker in ("Ã", "Â", "â", "¢", "€", "™")):
        try:
            return text.encode("latin-1").decode("utf-8")
        except UnicodeError:
            pass
    return text.replace("\u200b", "").replace("\ufeff", "").strip()


def make_key(brand: str, name: str) -> str:
    return f"{normalize_text(brand)}|{normalize_text(name)}"


def parse_price(label: str) -> float | None:
    match = re.search(r"(\d+(?:\.\d+)?)", str(label or ""))
    return float(match.group(1)) if match else None


def set_image_width(url: str, width: int = 420) -> str:
    parsed = urllib.parse.urlparse(url)
    query = urllib.parse.parse_qs(parsed.query)
    query["imwidth"] = [str(width)]
    new_query = urllib.parse.urlencode(query, doseq=True)
    return urllib.parse.urlunparse(parsed._replace(query=new_query))


def js_value(value) -> str:
    return json.dumps(value, ensure_ascii=False)


def load_base_entries(path: Path) -> list[list]:
    entries: list[list] = []
    inside = False
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if line.startswith("const baseCatalogSeed = [") or line.startswith("const catalogSeed = ["):
            inside = True
            continue
        if inside and line == "];":
            break
        if not inside or not line.startswith("["):
            continue
        try:
            entries.append(json.loads(line.rstrip(",")))
        except json.JSONDecodeError:
            continue
    return entries


def fetch_search_page(query: str, page: int) -> dict:
    params = urllib.parse.urlencode(
        {
            "type": "keyword",
            "q": query,
            "pageSize": PAGE_SIZE,
            "currentPage": page,
        }
    )
    url = f"https://www.sephora.com/api/v2/catalog/search/?{params}"
    request = urllib.request.Request(url, headers=API_HEADERS)
    with urllib.request.urlopen(request, timeout=45) as response:
        return json.loads(response.read().decode("utf-8"))


def pick_image_url(product: dict) -> str | None:
    candidates = [
        product.get("heroImage"),
        product.get("image450"),
        product.get("image250"),
        product.get("altImage"),
    ]
    current_sku = product.get("currentSku") or {}
    sku_images = current_sku.get("skuImages") or {}
    candidates.extend(
        [
            sku_images.get("image450"),
            sku_images.get("image250"),
            sku_images.get("image135"),
        ]
    )
    for candidate in candidates:
        if candidate:
            return set_image_width(candidate)
    return None


def build_candidate(product: dict, category: str, subcategory: str) -> dict | None:
    current_sku = product.get("currentSku") or {}
    price_label = current_sku.get("listPrice") or current_sku.get("salePrice") or ""
    price = parse_price(price_label)
    image_url = pick_image_url(product)
    target_url = product.get("targetUrl") or ""
    if not price_label or price is None or not image_url or "/product/" not in target_url:
        return None

    brand = repair_text(product.get("brandName"))
    name = repair_text(product.get("displayName") or product.get("productName"))
    sku_id = str(current_sku.get("skuId") or "").strip()
    product_id = str(product.get("productId") or "").strip()
    if not brand or not name or not sku_id or not product_id:
        return None

    return {
        "brand": brand,
        "name": name,
        "category": category,
        "subcategory": subcategory,
        "price": round(price, 2),
        "priceLabel": price_label.strip(),
        "imageUrl": image_url,
        "sourceUrl": urllib.parse.urljoin("https://www.sephora.com", target_url),
        "sourceLabel": "Ver en Sephora",
        "skuId": sku_id,
        "productId": product_id,
    }


def download_image(url: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        return
    request = urllib.request.Request(url, headers={"User-Agent": API_HEADERS["User-Agent"]})
    with urllib.request.urlopen(request, timeout=60) as response:
        destination.write_bytes(response.read())


def write_catalog_extra(entries: list[dict]) -> None:
    lines = ["window.catalogSeedExtra = ["]
    for entry in entries:
        seed_line = (
            f"  [{js_value(entry['brand'])}, {js_value(entry['name'])}, {js_value(entry['category'])}, "
            f"{js_value(entry['subcategory'])}, {entry['price']:.2f}, {js_value(entry['priceLabel'])}],"
        )
        lines.append(seed_line)
    lines.append("];")
    lines.append("")
    CATALOG_EXTRA_PATH.write_text("\n".join(lines), encoding="utf-8")


def write_real_extra(entries: list[dict]) -> None:
    real_map = {}
    for entry in entries:
        real_map[entry["id"]] = {
            "image": entry["image"],
            "imageUrl": entry["imageUrl"],
            "sourceUrl": entry["sourceUrl"],
            "sourceLabel": entry["sourceLabel"],
            "brand": entry["brand"],
            "name": entry["name"],
            "skuId": entry["skuId"],
            "productId": entry["productId"],
            "verified": True,
        }
    REAL_EXTRA_PATH.write_text(
        f"window.catalogRealDataExtra = {json.dumps(real_map, ensure_ascii=False, indent=4)};\n",
        encoding="utf-8",
    )


def main() -> None:
    base_entries = load_base_entries(CATALOG_DATA_PATH)
    base_count = len(base_entries)
    existing_keys = {make_key(entry[0], entry[1]) for entry in base_entries}
    seen_keys = set(existing_keys)
    seen_product_ids: set[str] = set()
    category_counts: Counter[str] = Counter()
    extra_entries: list[dict] = []

    print(f"Base catalog entries found: {base_count}")
    print("Fetching official Sephora products...")

    next_number = base_count + 1

    for config in QUERY_PLAN:
        category = config["category"]
        if len(extra_entries) >= TARGET_EXTRA_COUNT:
            break
        if category_counts[category] >= CATEGORY_QUOTAS[category]:
            continue

        query_added = 0
        print(f"- {config['query']} -> {category}/{config['subcategory']}")

        for page in range(1, MAX_PAGES_PER_QUERY + 1):
            if query_added >= config["limit"] or len(extra_entries) >= TARGET_EXTRA_COUNT:
                break
            if category_counts[category] >= CATEGORY_QUOTAS[category]:
                break

            payload = fetch_search_page(config["query"], page)
            products = payload.get("products") or []
            if not products:
                break

            for product in products:
                if query_added >= config["limit"] or len(extra_entries) >= TARGET_EXTRA_COUNT:
                    break
                if category_counts[category] >= CATEGORY_QUOTAS[category]:
                    break

                candidate = build_candidate(product, category, config["subcategory"])
                if not candidate:
                    continue

                key = make_key(candidate["brand"], candidate["name"])
                unique_product_key = candidate["productId"]
                if key in seen_keys or unique_product_key in seen_product_ids:
                    continue

                candidate["id"] = f"mbl-product-{next_number:03d}"
                extension = Path(urllib.parse.urlparse(candidate["imageUrl"]).path).suffix or ".jpg"
                extension = extension if extension.lower() in {".jpg", ".jpeg", ".png", ".webp"} else ".jpg"
                local_filename = f"{candidate['id']}{extension.lower()}"
                candidate["image"] = f"assets/images/products/real-extra/{local_filename}"
                candidate["localPath"] = IMAGE_DIR / local_filename

                extra_entries.append(candidate)
                seen_keys.add(key)
                seen_product_ids.add(unique_product_key)
                category_counts[category] += 1
                query_added += 1
                next_number += 1

            time.sleep(REQUEST_DELAY_SECONDS)

    if not extra_entries:
        raise RuntimeError("Could not gather any extra verified products from the official catalog queries.")

    print(f"Collected {len(extra_entries)} new products.")
    print("Downloading local product images...")

    with ThreadPoolExecutor(max_workers=DOWNLOAD_WORKERS) as executor:
        future_map = {
            executor.submit(download_image, entry["imageUrl"], entry["localPath"]): entry for entry in extra_entries
        }
        completed = 0
        for future in as_completed(future_map):
            entry = future_map[future]
            future.result()
            completed += 1
            if completed % 25 == 0 or completed == len(extra_entries):
                print(f"  downloaded {completed}/{len(extra_entries)}")

    write_catalog_extra(extra_entries)
    write_real_extra(extra_entries)

    print("")
    print(f"New extra catalog entries: {len(extra_entries)}")
    print(f"Output catalog file: {CATALOG_EXTRA_PATH}")
    print(f"Output real data file: {REAL_EXTRA_PATH}")
    print(f"Local image folder: {IMAGE_DIR}")
    print("Category totals:")
    for category in ("makeup", "lips", "eyes", "skincare", "suncare", "tools"):
        print(f"  - {category}: {category_counts[category]}")


if __name__ == "__main__":
    main()
