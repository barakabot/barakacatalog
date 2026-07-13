"""
Price Service — Python mini-service for competitor product scraping.
Port: 3002
Scrapes product data from Digikala, SnappShop and Torob APIs.
Reads/writes the same SQLite database used by the Next.js app.
"""

import os
import re
import json
import asyncio
from datetime import datetime, timezone
from typing import Optional

import aiosqlite
import httpx
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

# ─── Config ───────────────────────────────────────────────────────
DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "db", "custom.db"))
PORT = int(os.getenv("PORT", "3002"))
HOST = os.getenv("PRICE_SERVICE_HOST", "127.0.0.1")

app = FastAPI(title="Price Service", version="2.0.0")

# ─── Pydantic Models ──────────────────────────────────────────────
class AddCompetitorRequest(BaseModel):
    source: str  # "DIGIKALA", "SNAPPSHOP" or "TOROB"
    sourceId: str  # Product ID from the source platform
    proxy: Optional[str] = None

class ProxyRequest(BaseModel):
    proxy: Optional[str] = None
    proxies: list[str] = Field(default_factory=list)

class LinkToCatalogRequest(BaseModel):
    catalogProductId: str  # ID of the catalog product to link

class BulkAddRequest(BaseModel):
    items: list[AddCompetitorRequest]


# ─── Database helpers ─────────────────────────────────────────────
async def get_db():
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    return db


def row_to_dict(row):
    if row is None:
        return None
    d = dict(row)
    # Convert datetime strings to proper format if needed
    for key, value in d.items():
        if isinstance(value, str) and key.endswith("At"):
            try:
                dt = datetime.fromisoformat(value)
                d[key] = dt.isoformat()
            except (ValueError, TypeError):
                pass
    return d


# ─── Smart Fetch (handles CDN cookie protection like Digikala) ────
def proxy_client_options(proxy: Optional[str]) -> dict:
    """Use only the explicitly selected proxy; never inherit host proxy env vars."""
    return {"proxy": proxy, "trust_env": False}


async def smart_fetch(url: str, timeout: int = 20, proxy: Optional[str] = None) -> httpx.Response:
    """Fetch URL with manual redirect handling for CDN cookie protection."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "application/json, text/html, */*",
        "Accept-Language": "fa-IR,fa;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept-Encoding": "gzip, deflate, br",
        "Referer": "https://www.digikala.com/",
        "Origin": "https://www.digikala.com",
        "Sec-Ch-Ua": '"Chromium";v="131", "Google Chrome";v="131"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-site",
    }
    
    async with httpx.AsyncClient(
        follow_redirects=True,
        timeout=timeout,
        headers=headers,
        http2=True,
        **proxy_client_options(proxy),
    ) as client:
        response = await client.get(url)
        return response


async def smart_fetch_manual(url: str, timeout: int = 20, proxy: Optional[str] = None) -> httpx.Response:
    """Fetch URL with manual redirect + cookie handling (fallback for CDN protection)."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "application/json, text/html, */*",
        "Accept-Language": "fa-IR,fa;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept-Encoding": "gzip, deflate, br",
        "Referer": "https://www.digikala.com/",
    }
    async with httpx.AsyncClient(
        follow_redirects=False,
        timeout=timeout,
        headers=headers,
        http2=True,
        **proxy_client_options(proxy),
    ) as client:
        response = await client.get(url)
        
        # Handle redirect with Set-Cookie (CDN protection)
        max_redirects = 5
        redirect_count = 0
        while response.status_code in (301, 302, 303, 307, 308) and redirect_count < max_redirects:
            location = response.headers.get("location", "")
            if not location:
                break
            
            # Build cookies from Set-Cookie headers
            cookies = {}
            for cookie_header in response.headers.get_list("set-cookie"):
                parts = cookie_header.split(";")[0]
                if "=" in parts:
                    key, value = parts.split("=", 1)
                    cookies[key.strip()] = value.strip()
            
            # Follow redirect with cookies
            response = await client.get(location, cookies=cookies)
            redirect_count += 1
        
        return response


# ─── Digikala Scraper ─────────────────────────────────────────────
async def scrape_digikala(product_id: str, proxy: Optional[str] = None) -> dict:
    """Scrape product data from Digikala API."""
    url = f"https://api.digikala.com/v2/product/{product_id}/"
    
    try:
        # Try with auto-redirect first
        response = await smart_fetch(url, proxy=proxy)
        
        # If that fails, try manual cookie-based redirect
        if response.status_code in (403, 404, 503):
            print(f"[Digikala] Auto-redirect got {response.status_code}, trying manual cookie approach...")
            response = await smart_fetch_manual(url, proxy=proxy)
        
        if response.status_code != 200:
            # Try one more time with a different approach - simple request
            try:
                async with httpx.AsyncClient(
                    timeout=20,
                    follow_redirects=True,
                    **proxy_client_options(proxy),
                ) as client:
                    simple_resp = await client.get(url, headers={
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                        "Accept": "*/*",
                    })
                    if simple_resp.status_code == 200:
                        response = simple_resp
            except Exception:
                pass
        
        if response.status_code != 200:
            # Get response body for debugging
            body_preview = ""
            try:
                body_preview = response.text[:500]
            except Exception:
                pass
            return {
                "success": False,
                "error": f"خطای HTTP: {response.status_code} — آیدی محصول درست است؟ (پاسخ: {body_preview[:200]})",
                "data": None
            }
        
        try:
            result = response.json()
        except Exception:
            return {"success": False, "error": "پاسخ API معتبر نیست", "data": None}
        
        product = result.get("data", {}).get("product", {})
        if not product:
            return {"success": False, "error": "محصولی یافت نشد", "data": None}
        
        # Extract product info — Digikala API uses title_fa (title is no longer present)
        name = product.get("title") or product.get("title_fa") or product.get("title_en") or ""

        def _first_url(val):
            """Normalize a url field that may be str, list[str], or list[dict]."""
            if not val:
                return None
            if isinstance(val, str):
                return val
            if isinstance(val, list):
                for item in val:
                    if isinstance(item, str) and item:
                        return item
                    if isinstance(item, dict):
                        u = item.get("url") or item.get("src")
                        if isinstance(u, str) and u:
                            return u
                        if isinstance(u, list) and u and isinstance(u[0], str):
                            return u[0]
            return None

        # Extract image
        images = product.get("images", {})
        main_image = images.get("main", {})
        image_url = None
        if isinstance(main_image, dict):
            image_url = _first_url(main_image.get("url"))
            if not image_url:
                image_url = _first_url(main_image.get("webp_url"))
            if not image_url:
                image_url = _first_url(main_image.get("thumbnail_url"))
        if not image_url:
            image_list = images.get("list", [])
            if image_list and isinstance(image_list, list):
                first = image_list[0]
                if isinstance(first, dict):
                    image_url = _first_url(first.get("url"))
                elif isinstance(first, str):
                    image_url = first
        if not image_url and isinstance(images, list) and images:
            first = images[0]
            if isinstance(first, dict):
                image_url = _first_url(first.get("url"))
            elif isinstance(first, str):
                image_url = first
        # Fix URL
        if image_url and not isinstance(image_url, str):
            image_url = str(image_url)
        if image_url and isinstance(image_url, str) and not image_url.startswith("http"):
            image_url = f"https://{image_url}" if image_url.startswith("//") else f"https://digikala.com{image_url}"
        
        # Extract price info
        # default_variant can be: dict (old API), list (new API), or empty
        selling_price = 0
        rrp_price = 0
        discount_percent = 0
        product_status = product.get("status", "")  # e.g. "out_of_stock", "active"

        default_variant = product.get("default_variant")
        if isinstance(default_variant, dict) and default_variant:
            # Old API format: {"price": {"selling_price": ...}}
            price_info = default_variant.get("price", {})
            selling_price = price_info.get("selling_price", 0) or 0
            rrp_price = price_info.get("rrp_price", 0) or 0
            discount_percent = price_info.get("discount_percent", 0) or 0
        elif isinstance(default_variant, list) and default_variant:
            # New API format: [{"price": {"selling_price": ...}}]
            for v in default_variant:
                if isinstance(v, dict):
                    vp = v.get("price", {})
                    sp = vp.get("selling_price", 0)
                    if sp:
                        selling_price = sp
                        rrp_price = vp.get("rrp_price", 0) or 0
                        discount_percent = vp.get("discount_percent", 0) or 0
                        break

        # If still no price, try variants list
        if not selling_price:
            variants = product.get("variants", [])
            if variants:
                for v in variants:
                    if isinstance(v, dict):
                        vp = v.get("price", {})
                        sp = vp.get("selling_price", 0)
                        if sp:
                            selling_price = sp
                            rrp_price = vp.get("rrp_price", 0) or 0
                            discount_percent = vp.get("discount_percent", 0) or 0
                            break

        # Extract weight/volume/count from specifications
        weight = None
        volume = None
        specs = product.get("specifications", [])
        for spec_group in specs:
            if isinstance(spec_group, dict):
                attributes = spec_group.get("attributes", [])
                for attr in attributes:
                    if isinstance(attr, dict):
                        attr_title = attr.get("title", "").strip()
                        values = attr.get("values", [])
                        value_str = ", ".join(str(v).strip() for v in values) if values else ""
                        if "وزن" in attr_title:
                            weight = value_str
                        elif "حجم" in attr_title or "ظرفیت" in attr_title:
                            volume = value_str

        # Extract brand
        brand_data = product.get("brand", {})
        brand = None
        if isinstance(brand_data, dict):
            brand = brand_data.get("title_fa") or brand_data.get("title_en")

        # Extract category
        category_data = product.get("category", {})
        category = None
        if isinstance(category_data, dict):
            category = category_data.get("title_fa")

        # Build coefficient hint from weight (e.g. "660 گرم" → price per kg)
        coefficient = None
        if selling_price > 0 and weight:
            import re as _re
            m = _re.search(r"([\d.]+)\s*(g|گرم|kg|کیلو)", weight, _re.IGNORECASE)
            if m:
                amount = float(m.group(1))
                unit = m.group(2).lower()
                if unit in ("g", "گرم"):
                    coefficient = round(selling_price / (amount / 1000)) if amount > 0 else None
                elif unit in ("kg", "کیلو"):
                    coefficient = round(selling_price / amount) if amount > 0 else None

        return {
            "success": True,
            "error": None,
            "data": {
                "source": "DIGIKALA",
                "sourceId": product_id,
                "name": name,
                "imageUrl": image_url,
                "weight": weight,
                "volume": volume,
                "price": selling_price,  # in Rial
                "originalPrice": rrp_price if rrp_price > selling_price else None,
                "discountPercent": discount_percent,
                "brand": brand,
                "coefficient": coefficient,
            }
        }
    
    except httpx.TimeoutException:
        return {"success": False, "error": "زمان اتصال به دیجیکالا به پایان رسید", "data": None}
    except Exception as e:
        return {"success": False, "error": f"خطا: {str(e)}", "data": None}


# ─── SnappShop Scraper ────────────────────────────────────────────
async def scrape_snappshop(product_id: str, proxy: Optional[str] = None) -> dict:
    """Scrape product data from SnappShop API."""
    url = f"https://apix.snappshop.ir/products/v2/{product_id}"
    
    try:
        # SnappShop needs specific headers
        snapp_headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Accept": "application/json",
            "Accept-Language": "fa-IR,fa;q=0.9",
            "Referer": "https://snappshop.com/",
            "Origin": "https://snappshop.com",
        }
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=20,
            headers=snapp_headers,
            http2=True,
            **proxy_client_options(proxy),
        ) as client:
            response = await client.get(url)
        
        if response.status_code != 200:
            body_preview = ""
            try:
                body_preview = response.text[:500]
            except Exception:
                pass
            return {
                "success": False,
                "error": f"خطای HTTP اسنپ‌شاپ: {response.status_code} — آیدی محصول درست است؟ (پاسخ: {body_preview[:200]})",
                "data": None
            }
        
        try:
            result = response.json()
        except Exception:
            return {"success": False, "error": "پاسخ API معتبر نیست", "data": None}
        
        data = result.get("data", {})
        if not data:
            return {"success": False, "error": "محصولی یافت نشد", "data": None}
        
        # Extract product info
        content = data.get("content", {})
        name = content.get("title_fa", "")
        
        # Extract image
        images = data.get("images", [])
        image_url = None
        if images and isinstance(images, list):
            raw_src = images[0].get("src", None) if isinstance(images[0], dict) else None
            image_url = str(raw_src) if raw_src else None
        
        # Extract price info from variants
        variants = data.get("variants", [])
        price = 0
        original_price = None
        discount_percent = 0
        
        if variants and isinstance(variants, list):
            variant = variants[0] if variants else {}
            vendors = variant.get("vendor", [])
            if vendors and isinstance(vendors, list):
                vendor = vendors[0] if vendors else {}
                price = vendor.get("price", 0) or 0
                special_price = vendor.get("special_price", 0) or 0
                discount_percent = vendor.get("special_price_percent_discount", 0) or 0
                
                if special_price > 0 and special_price < price:
                    original_price = price
                    price = special_price
                    if discount_percent == 0:
                        discount_percent = round((1 - special_price / price) * 100) if price > 0 else 0
                elif discount_percent > 0:
                    original_price = price
                    price = round(price * (1 - discount_percent / 100))
        
        # Extract weight/volume from attributes
        weight = None
        volume = None
        attributes = data.get("attributes", [])
        if isinstance(attributes, list):
            for attr in attributes:
                if isinstance(attr, dict):
                    title = attr.get("title", "")
                    value = attr.get("value", "")
                    if "وزن" in title:
                        weight = str(value)
                    elif "حجم" in title or "ظرفیت" in title:
                        volume = str(value)
        
        # Extract brand
        brand_data = data.get("brand", {})
        brand = brand_data.get("title_fa", None) if isinstance(brand_data, dict) else None
        
        return {
            "success": True,
            "error": None,
            "data": {
                "source": "SNAPPSHOP",
                "sourceId": product_id,
                "name": name,
                "imageUrl": image_url,
                "weight": weight,
                "volume": volume,
                "price": price,  # in Rial
                "originalPrice": original_price,
                "discountPercent": discount_percent,
                "brand": brand,
            }
        }
    
    except httpx.TimeoutException:
        return {"success": False, "error": "زمان اتصال به اسنپ‌شاپ به پایان رسید", "data": None}
    except Exception as e:
        return {"success": False, "error": f"خطا: {str(e)}", "data": None}


# ─── Torob Scraper ─────────────────────────────────────────────
async def scrape_torob(prk: str, proxy: Optional[str] = None) -> dict:
    """Scrape product data from Torob API using base-product details endpoint."""
    url = f"https://api.torob.com/v4/base-product/details/?prk={prk}"
    
    try:
        torob_headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Accept": "application/json, text/html, */*",
            "Accept-Language": "fa-IR,fa;q=0.9,en-US;q=0.8,en;q=0.7",
            "Referer": "https://torob.com/",
            "Origin": "https://torob.com",
        }
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=20,
            headers=torob_headers,
            http2=True,
            **proxy_client_options(proxy),
        ) as client:
            response = await client.get(url)
        
        if response.status_code != 200:
            body_preview = ""
            try:
                body_preview = response.text[:500]
            except Exception:
                pass
            return {
                "success": False,
                "error": f"خطای HTTP ترب: {response.status_code} — prk درست است؟ (پاسخ: {body_preview[:200]})",
                "data": None
            }
        
        try:
            result = response.json()
        except Exception:
            return {"success": False, "error": "پاسخ API معتبر نیست", "data": None}
        
        # Torob details endpoint returns product data directly or nested
        product = None
        
        # Response might be the product itself or have a data/results wrapper
        if "data" in result:
            data = result["data"]
            if isinstance(data, dict) and "name1" in data:
                product = data
            elif isinstance(data, dict) and "results" in data:
                results = data["results"]
                if results and isinstance(results, list):
                    # Find the matching product by prk
                    product = next((r for r in results if isinstance(r, dict) and r.get("random_key") == prk), results[0] if results else None)
        elif isinstance(result, dict) and "name1" in result:
            product = result
        elif isinstance(result, dict) and "results" in result:
            results = result["results"]
            if results and isinstance(results, list):
                product = next((r for r in results if isinstance(r, dict) and r.get("random_key") == prk), results[0] if results else None)
        
        if not product or not isinstance(product, dict):
            return {"success": False, "error": "محصولی در ترب یافت نشد", "data": None}
        
        # Extract name
        name = product.get("name1", "") or product.get("name2", "") or ""
        
        # Extract image
        image_url = product.get("image_url")
        if not image_url:
            media_urls = product.get("media_urls", [])
            if media_urls and isinstance(media_urls, list):
                for m in media_urls:
                    if isinstance(m, dict) and m.get("type") == "image" and m.get("url"):
                        image_url = m["url"]
                        break
        
        # Extract price — Torob prices are in Toman, convert to Rial (*10)
        price_toman = product.get("price", 0) or 0
        price = price_toman * 10  # Convert Toman to Rial
        
        # Extract discount info
        original_price = None
        discount_percent = 0
        discount_info = product.get("discount_info", [])
        if discount_info and isinstance(discount_info, list) and discount_info:
            d = discount_info[0] if isinstance(discount_info[0], dict) else {}
            discount_percent = d.get("percent", 0) or 0
            if discount_percent > 0 and price > 0:
                original_price = round(price / (1 - discount_percent / 100))
        
        # Extract weight/volume from name (Torob doesn't have structured specs)
        weight = None
        volume = None
        if name:
            weight_match = re.search(r"([\d.]+)\s*(g|گرم|kg|کیلوگرم|کیلو)", name, re.IGNORECASE)
            if weight_match:
                weight = weight_match.group(0)
            vol_match = re.search(r"([\d.]+)\s*(cc|ml|میلی‌لیتر|لیتر|میل)", name, re.IGNORECASE)
            if vol_match:
                volume = vol_match.group(0)
        
        # Extract brand from name (first word(s) before product type)
        brand = None
        name_parts = name.split()
        # Common brand names are usually 1-2 words at the start
        if name_parts:
            brand = name_parts[0]
        
        # Build coefficient hint
        coefficient = None
        if price > 0 and weight:
            m = re.search(r"([\d.]+)\s*(g|گرم|kg|کیلو)", weight, re.IGNORECASE)
            if m:
                amount = float(m.group(1))
                unit = m.group(2).lower()
                if unit in ("g", "گرم"):
                    coefficient = round(price / (amount / 1000)) if amount > 0 else None
                elif unit in ("kg", "کیلو"):
                    coefficient = round(price / amount) if amount > 0 else None
        
        return {
            "success": True,
            "error": None,
            "data": {
                "source": "TOROB",
                "sourceId": prk,
                "name": name,
                "imageUrl": image_url,
                "weight": weight,
                "volume": volume,
                "price": price,  # in Rial (converted from Toman)
                "originalPrice": original_price,
                "discountPercent": discount_percent,
                "brand": brand,
                "coefficient": coefficient,
            }
        }
    
    except httpx.TimeoutException:
        return {"success": False, "error": "زمان اتصال به ترب به پایان رسید", "data": None}
    except Exception as e:
        return {"success": False, "error": f"خطا: {str(e)}", "data": None}


# ─── Save competitor product to DB ────────────────────────────────
async def save_competitor_product(product_data: dict, catalog_product_id: str = None) -> dict:
    """Save or update a competitor product in the database."""
    db = await get_db()
    try:
        now = datetime.now(timezone.utc).isoformat()
        source = product_data["source"]
        source_id = product_data["sourceId"]
        
        # Check if product already exists (same source + sourceId)
        cursor = await db.execute(
            "SELECT id, price FROM CompetitorProduct WHERE source = ? AND sourceId = ?",
            (source, source_id)
        )
        existing = await cursor.fetchone()
        
        if existing:
            # Update existing product
            existing_id = existing["id"]
            old_price = existing["price"]
            
            await db.execute(
                """UPDATE CompetitorProduct 
                   SET name = ?, imageUrl = ?, weight = ?, volume = ?, price = ?,
                       originalPrice = ?, discountPercent = ?, brand = ?, coefficient = ?, fetchedAt = ?,
                       catalogProductId = COALESCE(?, catalogProductId), updatedAt = ?
                   WHERE id = ?""",
                (
                    product_data["name"], product_data.get("imageUrl"),
                    product_data.get("weight"), product_data.get("volume"),
                    product_data["price"], product_data.get("originalPrice"),
                    product_data.get("discountPercent", 0), product_data.get("brand"),
                    product_data.get("coefficient"), now, catalog_product_id, now, existing_id
                )
            )
            
            # Save price history if price changed
            if old_price != product_data["price"]:
                history_id = f"cph_{int(datetime.now().timestamp()*1000)}"
                await db.execute(
                    """INSERT INTO CompetitorPriceHistory (id, competitorProductId, price, originalPrice, discountPercent, fetchedAt)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (
                        history_id, existing_id, product_data["price"],
                        product_data.get("originalPrice"), product_data.get("discountPercent", 0), now
                    )
                )
            
            await db.commit()
            return {"success": True, "id": existing_id, "action": "updated"}
        
        else:
            # Create new product
            import uuid
            new_id = f"cp_{uuid.uuid4().hex[:20]}"
            
            await db.execute(
                """INSERT INTO CompetitorProduct 
                   (id, source, sourceId, name, imageUrl, weight, volume, price, originalPrice,
                    discountPercent, brand, coefficient, fetchedAt, catalogProductId, createdAt, updatedAt)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    new_id, source, source_id, product_data["name"],
                    product_data.get("imageUrl"), product_data.get("weight"),
                    product_data.get("volume"), product_data["price"],
                    product_data.get("originalPrice"), product_data.get("discountPercent", 0),
                    product_data.get("brand"), product_data.get("coefficient"),
                    now, catalog_product_id, now, now
                )
            )
            
            # Save initial price history
            history_id = f"cph_{int(datetime.now().timestamp()*1000)}"
            await db.execute(
                """INSERT INTO CompetitorPriceHistory (id, competitorProductId, price, originalPrice, discountPercent, fetchedAt)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (
                    history_id, new_id, product_data["price"],
                    product_data.get("originalPrice"), product_data.get("discountPercent", 0), now
                )
            )
            
            await db.commit()
            return {"success": True, "id": new_id, "action": "created"}
    
    except Exception as e:
        await db.rollback()
        raise e
    finally:
        await db.close()


# ─── API Endpoints ────────────────────────────────────────────────

async def scrape_source(source: str, source_id: str, proxy: Optional[str] = None) -> dict:
    source_upper = source.upper()
    if source_upper == "DIGIKALA":
        return await scrape_digikala(source_id, proxy=proxy)
    if source_upper == "TOROB":
        return await scrape_torob(source_id, proxy=proxy)
    if source_upper == "SNAPPSHOP":
        return await scrape_snappshop(source_id, proxy=proxy)
    return {"success": False, "error": "منبع نامعتبر است", "data": None}

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "price-service", "version": "2.0", "port": PORT}


@app.get("/api/test-scrape")
async def test_scrape(
    source: str = Query(...),
    sourceId: str = Query(...),
    proxy: Optional[str] = Query(None),
):
    """Test scrape endpoint — returns raw API response for debugging."""
    source_upper = source.upper()
    if source_upper not in ("DIGIKALA", "SNAPPSHOP", "TOROB"):
        raise HTTPException(status_code=400, detail="منبع باید DIGIKALA، SNAPPSHOP یا TOROB باشد")
    
    if source_upper == "DIGIKALA":
        url = f"https://api.digikala.com/v2/product/{sourceId}/"
    elif source_upper == "SNAPPSHOP":
        url = f"https://apix.snappshop.ir/products/v2/{sourceId}"
    else:
        url = f"https://api.torob.com/v4/base-product/details/?prk={sourceId}"
    
    # Try 3 methods and return all results
    results = {}
    
    # Method 1: auto-redirect with full headers
    try:
        resp = await smart_fetch(url, proxy=proxy)
        results["method1_auto_redirect"] = {
            "status": resp.status_code,
            "headers": dict(resp.headers)[:20] if resp.headers else {},
            "body_preview": resp.text[:300] if resp.text else "",
        }
    except Exception as e:
        results["method1_auto_redirect"] = {"error": str(e)}
    
    # Method 2: manual cookie redirect
    try:
        resp = await smart_fetch_manual(url, proxy=proxy)
        results["method2_manual_cookie"] = {
            "status": resp.status_code,
            "body_preview": resp.text[:300] if resp.text else "",
        }
    except Exception as e:
        results["method2_manual_cookie"] = {"error": str(e)}
    
    # Method 3: simple request
    try:
        async with httpx.AsyncClient(
            timeout=20,
            follow_redirects=True,
            **proxy_client_options(proxy),
        ) as client:
            resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "*/*"})
            results["method3_simple"] = {
                "status": resp.status_code,
                "body_preview": resp.text[:300] if resp.text else "",
            }
    except Exception as e:
        results["method3_simple"] = {"error": str(e)}
    
    return {"url": url, "results": results}


@app.post("/api/competitors/scrape")
async def scrape_and_add(req: AddCompetitorRequest):
    """Scrape a product from Digikala, SnappShop or Torob and save to database."""
    source = req.source.upper()
    if source not in ("DIGIKALA", "SNAPPSHOP", "TOROB"):
        raise HTTPException(status_code=400, detail="منبع باید DIGIKALA، SNAPPSHOP یا TOROB باشد")
    
    if not req.sourceId:
        raise HTTPException(status_code=400, detail="شناسه محصول الزامی است")
    
    result = await scrape_source(source, req.sourceId, proxy=req.proxy)
    
    if not result["success"]:
        raise HTTPException(status_code=422, detail=result["error"])
    
    save_result = await save_competitor_product(result["data"])
    
    return {
        "message": "محصول رقیب با موفقیت ذخیره شد" if save_result["action"] == "created" else "محصول رقیب بروزرسانی شد",
        "id": save_result["id"],
        "action": save_result["action"],
        "data": result["data"],
    }


@app.post("/api/competitors/scrape-preview")
async def scrape_preview(req: AddCompetitorRequest):
    """Preview what would be scraped without saving."""
    source = req.source.upper()
    if source not in ("DIGIKALA", "SNAPPSHOP", "TOROB"):
        raise HTTPException(status_code=400, detail="منبع باید DIGIKALA، SNAPPSHOP یا TOROB باشد")
    
    if not req.sourceId:
        raise HTTPException(status_code=400, detail="شناسه محصول الزامی است")
    
    result = await scrape_source(source, req.sourceId, proxy=req.proxy)
    
    if not result["success"]:
        raise HTTPException(status_code=422, detail=result["error"])
    
    return {"data": result["data"]}


@app.get("/api/competitors")
async def list_competitors(
    catalogProductId: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    unlinked: Optional[bool] = Query(False),
):
    """List competitor products, optionally filtered."""
    db = await get_db()
    try:
        conditions = []
        params = []
        
        if catalogProductId:
            conditions.append("catalogProductId = ?")
            params.append(catalogProductId)
        
        if source:
            conditions.append("source = ?")
            params.append(source.upper())
        
        if unlinked:
            conditions.append("catalogProductId IS NULL")
        
        where = f" WHERE {' AND '.join(conditions)}" if conditions else ""
        
        cursor = await db.execute(
            f"SELECT * FROM CompetitorProduct{where} ORDER BY fetchedAt DESC",
            params
        )
        competitors = [row_to_dict(row) for row in await cursor.fetchall()]
        
        return {"competitors": competitors, "count": len(competitors)}
    finally:
        await db.close()


@app.get("/api/competitors/{competitor_id}")
async def get_competitor(competitor_id: str):
    """Get a single competitor product with price history."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT * FROM CompetitorProduct WHERE id = ?",
            (competitor_id,)
        )
        competitor = await cursor.fetchone()
        if not competitor:
            raise HTTPException(status_code=404, detail="محصول رقیب یافت نشد")
        
        result = row_to_dict(competitor)
        
        # Get price history
        cursor = await db.execute(
            "SELECT * FROM CompetitorPriceHistory WHERE competitorProductId = ? ORDER BY fetchedAt DESC LIMIT 20",
            (competitor_id,)
        )
        result["priceHistory"] = [row_to_dict(row) for row in await cursor.fetchall()]
        
        return result
    finally:
        await db.close()


@app.put("/api/competitors/{competitor_id}/link")
async def link_to_catalog(competitor_id: str, req: LinkToCatalogRequest):
    """Link a competitor product to a catalog product."""
    db = await get_db()
    try:
        # Check competitor exists
        cursor = await db.execute("SELECT id FROM CompetitorProduct WHERE id = ?", (competitor_id,))
        if not await cursor.fetchone():
            raise HTTPException(status_code=404, detail="محصول رقیب یافت نشد")
        
        # Check catalog product exists
        cursor = await db.execute("SELECT id FROM Product WHERE id = ?", (req.catalogProductId,))
        if not await cursor.fetchone():
            raise HTTPException(status_code=404, detail="محصول کاتالوگ یافت نشد")
        
        now = datetime.now(timezone.utc).isoformat()
        await db.execute(
            "UPDATE CompetitorProduct SET catalogProductId = ?, updatedAt = ? WHERE id = ?",
            (req.catalogProductId, now, competitor_id)
        )
        await db.commit()
        
        return {"message": "محصول رقیب به محصول کاتالوگ متصل شد"}
    finally:
        await db.close()


@app.put("/api/competitors/{competitor_id}/unlink")
async def unlink_from_catalog(competitor_id: str):
    """Unlink a competitor product from its catalog product."""
    db = await get_db()
    try:
        cursor = await db.execute("SELECT id FROM CompetitorProduct WHERE id = ?", (competitor_id,))
        if not await cursor.fetchone():
            raise HTTPException(status_code=404, detail="محصول رقیب یافت نشد")
        
        now = datetime.now(timezone.utc).isoformat()
        await db.execute(
            "UPDATE CompetitorProduct SET catalogProductId = NULL, updatedAt = ? WHERE id = ?",
            (now, competitor_id)
        )
        await db.commit()
        
        return {"message": "اتصال محصول رقیب لغو شد"}
    finally:
        await db.close()


@app.post("/api/competitors/{competitor_id}/refresh")
async def refresh_competitor(competitor_id: str, req: Optional[ProxyRequest] = None):
    """Re-scrape and update a competitor product's price."""
    db = await get_db()
    try:
        cursor = await db.execute("SELECT source, sourceId FROM CompetitorProduct WHERE id = ?", (competitor_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="محصول رقیب یافت نشد")
        
        source = row["source"]
        source_id = row["sourceId"]
    finally:
        await db.close()
    
    result = await scrape_source(source, source_id, proxy=req.proxy if req else None)
    
    if not result["success"]:
        raise HTTPException(status_code=422, detail=result["error"])
    
    save_result = await save_competitor_product(result["data"])
    
    return {
        "message": "قیمت بروزرسانی شد",
        "data": result["data"],
        "action": save_result["action"],
    }


@app.post("/api/competitors/refresh-all")
async def refresh_all_competitors(req: Optional[ProxyRequest] = None):
    """Re-scrape all competitor products."""
    db = await get_db()
    try:
        cursor = await db.execute("SELECT id, source, sourceId FROM CompetitorProduct")
        competitors = [row_to_dict(row) for row in await cursor.fetchall()]
    finally:
        await db.close()
    
    results = {"success": 0, "failed": 0, "details": []}
    
    proxy_urls = []
    if req:
        proxy_urls = [url for url in req.proxies if url]
        if req.proxy:
            proxy_urls.insert(0, req.proxy)

    for index, comp in enumerate(competitors):
        try:
            proxy = proxy_urls[index % len(proxy_urls)] if proxy_urls else None
            result = await scrape_source(comp["source"], comp["sourceId"], proxy=proxy)
            
            if result["success"]:
                await save_competitor_product(result["data"])
                results["success"] += 1
                results["details"].append({"id": comp["id"], "name": result["data"]["name"], "status": "success"})
            else:
                results["failed"] += 1
                results["details"].append({"id": comp["id"], "error": result["error"], "status": "failed"})
        except Exception as e:
            results["failed"] += 1
            results["details"].append({"id": comp["id"], "error": str(e), "status": "failed"})
    
    return results


@app.delete("/api/competitors/{competitor_id}")
async def delete_competitor(competitor_id: str):
    """Delete a competitor product and its price history."""
    db = await get_db()
    try:
        cursor = await db.execute("SELECT id FROM CompetitorProduct WHERE id = ?", (competitor_id,))
        if not await cursor.fetchone():
            raise HTTPException(status_code=404, detail="محصول رقیب یافت نشد")
        
        await db.execute("DELETE FROM CompetitorPriceHistory WHERE competitorProductId = ?", (competitor_id,))
        await db.execute("DELETE FROM CompetitorProduct WHERE id = ?", (competitor_id,))
        await db.commit()
        
        return {"message": "محصول رقیب حذف شد"}
    finally:
        await db.close()


@app.get("/api/products/{product_id}/competitors")
async def get_product_competitors(product_id: str):
    """Get all competitor products linked to a catalog product."""
    db = await get_db()
    try:
        # Check product exists
        cursor = await db.execute(
            "SELECT id, name, price, imageUrl FROM Product WHERE id = ?",
            (product_id,)
        )
        product = await cursor.fetchone()
        if not product:
            raise HTTPException(status_code=404, detail="محصول کاتالوگ یافت نشد")
        
        # Get competitor products
        cursor = await db.execute(
            "SELECT * FROM CompetitorProduct WHERE catalogProductId = ? ORDER BY fetchedAt DESC",
            (product_id,)
        )
        competitors = [row_to_dict(row) for row in await cursor.fetchall()]
        
        # Get price history for each competitor
        for comp in competitors:
            cursor = await db.execute(
                "SELECT * FROM CompetitorPriceHistory WHERE competitorProductId = ? ORDER BY fetchedAt DESC LIMIT 10",
                (comp["id"],)
            )
            comp["priceHistory"] = [row_to_dict(row) for row in await cursor.fetchall()]
        
        return {
            "product": row_to_dict(product),
            "competitors": competitors,
        }
    finally:
        await db.close()


# ─── Run ───────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=HOST, port=PORT)
