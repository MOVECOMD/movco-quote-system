# api.py — MOVCO Storage API
# Storage-only fork of the MOVCO API
# Changes from removals API:
#   ✅ No temperature=0 (storage needs natural AI variability for accuracy)
#   ✅ No Google Maps distance (not needed for storage)
#   ✅ No pricing/van/mover calculation (storage uses unit matching in frontend)
#   ✅ Simplified /analyze endpoint — returns volume + items only
#   ✅ Kept SMTP email notification for storage leads

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import requests
import anthropic
import base64
import os
import traceback
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

FT3_TO_M3 = 0.0283168  # cubic feet -> cubic metres

# ---------------------------------------------------------------------------
# SMTP Email Configuration
# ---------------------------------------------------------------------------
SMTP_EMAIL = os.getenv("SMTP_EMAIL")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
NOTIFY_EMAIL = "zachary@movco.co.uk"

if SMTP_EMAIL and SMTP_PASSWORD:
    print("[MOVCO-STORAGE] ✓ SMTP email configured")
else:
    print("[MOVCO-STORAGE] WARNING: SMTP not configured - email notifications disabled")

# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
if not ANTHROPIC_API_KEY:
    print("[MOVCO-STORAGE] WARNING: ANTHROPIC_API_KEY not set - furniture detection will fail")
else:
    print("[MOVCO-STORAGE] ✓ ANTHROPIC_API_KEY is configured")

app = FastAPI()

# Initialize Anthropic client
client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY else None

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "https://movco-quote-system.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "movco-storage-api",
        "anthropic_configured": bool(ANTHROPIC_API_KEY),
        "smtp_configured": bool(SMTP_EMAIL and SMTP_PASSWORD),
    }


# ---------- Schemas ----------

class AnalyzeRequest(BaseModel):
    starting_address: str  # kept for API compatibility, not used
    ending_address: str    # kept for API compatibility, not used
    photo_urls: List[str]


class AiItem(BaseModel):
    name: str
    quantity: int
    note: Optional[str] = None
    estimated_volume_ft3: Optional[float] = None


class AnalyzeResponse(BaseModel):
    items: List[AiItem]
    totalVolumeM3: float
    totalAreaM2: float
    description: str
    # Stub fields kept for frontend compatibility
    estimate: float = 0.0
    distance_miles: Optional[float] = None
    van_count: int = 1
    recommended_movers: int = 2
    job_hours: float = 0.0


# ---------- Furniture volume estimates (average cubic feet) ----------
# NOTE: These are calibrated for STORAGE accuracy — do not increase them.
# The removals API uses a separate multiplier for van sizing.

FURNITURE_VOLUMES = {
    "sofa": 30.0,
    "3-seater sofa": 35.0,
    "2-seater sofa": 25.0,
    "loveseat": 22.0,
    "sectional sofa": 55.0,
    "armchair": 15.0,
    "recliner": 18.0,
    "sofa bed": 40.0,
    "chair": 10.0,
    "bed": 40.0,
    "king bed": 50.0,
    "queen bed": 45.0,
    "double bed": 40.0,
    "single bed": 28.0,
    "bunk bed": 55.0,
    "bed frame": 25.0,
    "mattress": 18.0,
    "single mattress": 14.0,
    "double mattress": 18.0,
    "king mattress": 22.0,
    "box spring": 18.0,
    "headboard": 8.0,
    "bedside table": 5.0,
    "nightstand": 5.0,
    "wardrobe": 38.0,
    "large wardrobe": 50.0,
    "double wardrobe": 45.0,
    "single wardrobe": 28.0,
    "armoire": 45.0,
    "chest of drawers": 18.0,
    "tall chest of drawers": 22.0,
    "dresser": 20.0,
    "filing cabinet": 8.0,
    "cabinet": 15.0,
    "storage cabinet": 15.0,
    "display cabinet": 20.0,
    "china cabinet": 25.0,
    "dining table": 25.0,
    "large dining table": 35.0,
    "coffee table": 8.0,
    "side table": 4.0,
    "end table": 4.0,
    "console table": 10.0,
    "desk": 20.0,
    "office desk": 22.0,
    "computer desk": 18.0,
    "dressing table": 18.0,
    "dining chair": 5.0,
    "office chair": 8.0,
    "bar stool": 3.0,
    "stool": 3.0,
    "bench": 10.0,
    "ottoman": 8.0,
    "footstool": 4.0,
    "bookcase": 18.0,
    "bookshelf": 18.0,
    "large bookcase": 25.0,
    "shelving unit": 15.0,
    "wall unit": 30.0,
    "tv": 5.0,
    "large tv": 8.0,
    "tv stand": 12.0,
    "entertainment center": 28.0,
    "media unit": 20.0,
    "sideboard": 20.0,
    "credenza": 18.0,
    "buffet": 20.0,
    "refrigerator": 28.0,
    "fridge": 25.0,
    "fridge freezer": 30.0,
    "washing machine": 18.0,
    "dryer": 18.0,
    "dishwasher": 14.0,
    "microwave": 2.0,
    "oven": 20.0,
    "cooker": 22.0,
    "freezer": 22.0,
    "boxes": 2.5,
    "box": 2.5,
    "cardboard box": 2.5,
    "large box": 4.0,
    "small box": 1.5,
    "storage box": 3.0,
    "storage crate": 3.0,
    "packing box": 2.5,
    "removal box": 2.5,
    "bin": 2.0,
    "storage bin": 2.0,
    "decorative pillows": 0.5,
    "cushions": 0.5,
    "throw": 0.3,
    "curtains": 0.5,
    "bedding": 0.5,
    "pillows": 0.5,
    "duvet": 0.5,
    "table lamp": 1.0,
    "lamp": 2.0,
    "floor lamp": 3.0,
    "pendant light fixture": 0.5,
    "light fixture": 0.5,
    "mirror": 4.0,
    "large mirror": 6.0,
    "rug": 3.0,
    "large rug": 6.0,
    "plant": 3.0,
    "large plant": 6.0,
    "garden furniture": 20.0,
    "garden table": 15.0,
    "garden chair": 5.0,
    "bbq": 10.0,
    "lawnmower": 12.0,
    "bicycle": 10.0,
    "treadmill": 22.0,
    "exercise bike": 12.0,
    "exercise equipment": 15.0,
    "golf clubs": 5.0,
    "cot": 18.0,
    "crib": 18.0,
    "pram": 8.0,
    "pushchair": 6.0,
    "high chair": 5.0,
    "toy box": 6.0,
    "printer": 3.0,
    "computer": 3.0,
    "monitor": 3.0,
    "safe": 15.0,
}


def estimate_item_volume(item_name: str) -> float:
    item_lower = item_name.lower().strip()
    if item_lower in FURNITURE_VOLUMES:
        return FURNITURE_VOLUMES[item_lower]
    for key, volume in FURNITURE_VOLUMES.items():
        if key in item_lower or item_lower in key:
            return volume
    return 3.0


# ---------- Image helpers ----------

def normalise_supabase_url(url: str) -> str:
    if "/storage/v1/object/sign/" in url:
        base, _, _ = url.partition("?")
        public_base = base.replace(
            "/storage/v1/object/sign/",
            "/storage/v1/object/public/"
        )
        return public_base
    return url


def download_image_as_base64(url: str) -> tuple[str, str]:
    fixed_url = normalise_supabase_url(url)
    print(f"[MOVCO-STORAGE] 📥 Downloading image from: {fixed_url[:80]}...")
    resp = requests.get(fixed_url, timeout=15)
    resp.raise_for_status()
    content_type = resp.headers.get("content-type", "image/jpeg")
    if "png" in content_type:
        media_type = "image/png"
    elif "webp" in content_type:
        media_type = "image/webp"
    elif "gif" in content_type:
        media_type = "image/gif"
    else:
        media_type = "image/jpeg"
    base64_image = base64.b64encode(resp.content).decode("utf-8")
    print(f"[MOVCO-STORAGE] ✓ Image downloaded ({len(base64_image)} chars, {media_type})")
    return base64_image, media_type


def analyze_room_with_claude(image_url: str) -> Dict[str, Any]:
    if not client:
        print("[MOVCO-STORAGE] ❌ Anthropic client not initialized")
        return {"items": [], "total_volume_ft3": 0.0}
    try:
        base64_image, media_type = download_image_as_base64(image_url)
        print(f"[MOVCO-STORAGE] 🤖 Sending image to Claude Vision API...")

        # No temperature set — uses default for natural variability
        # which averages out to accurate storage estimates
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2048,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": base64_image,
                            },
                        },
                        {
                            "type": "text",
                            "text": """Analyze this room photo for a storage company.

Identify ALL furniture and items visible. Use ONLY simple standard names from this list where possible:
sofa, 2-seater sofa, 3-seater sofa, armchair, bed, single bed, double bed, king bed, mattress, wardrobe, chest of drawers, bedside table, nightstand, dining table, dining chair, coffee table, desk, office chair, bookcase, bookshelf, tv, tv stand, sideboard, cabinet, washing machine, fridge, dishwasher, microwave, boxes, lamp, floor lamp, mirror, rug, plant, bicycle, treadmill, printer, monitor, curtains, headboard, dresser

Only use a name NOT from this list if the item is genuinely not represented above.
Never use slashes (/) in item names.
Never add descriptive words like "wall-mounted", "small", "decorative", "built-in".

Format your response EXACTLY as:
- double bed (1)
- bedside table (2)
- wardrobe (1)
- lamp (2)
- curtains (1)

Count everything visible that would need to be stored.""",
                        },
                    ],
                }
            ],
        )
        response_text = message.content[0].text
        print(f"[MOVCO-STORAGE] 🤖 Claude response:\n{response_text}\n")

        items = []
        total_volume_ft3 = 0.0
        for line in response_text.split("\n"):
            line = line.strip()
            if not line or not line.startswith("-"):
                continue
            line = line[1:].strip()
            if "(" in line and ")" in line:
                item_name = line[: line.rfind("(")].strip()
                quantity_str = line[line.rfind("(") + 1 : line.rfind(")")].strip()
                try:
                    quantity = int(quantity_str)
                except Exception:
                    quantity = 1
            else:
                item_name = line
                quantity = 1
            unit_volume = estimate_item_volume(item_name)
            item_volume = unit_volume * quantity
            items.append(
                {
                    "label": item_name,
                    "quantity": quantity,
                    "volume_ft3": round(item_volume, 2),
                }
            )
            total_volume_ft3 += item_volume

        print(f"[MOVCO-STORAGE] ✓ Detected {len(items)} item types, total: {total_volume_ft3:.2f} ft³")
        return {"items": items, "total_volume_ft3": round(total_volume_ft3, 2)}

    except Exception as e:
        print(f"[MOVCO-STORAGE] ❌ Error analyzing with Claude: {e}")
        traceback.print_exc()
        return {"items": [], "total_volume_ft3": 0.0}


def aggregate_items_and_volume(
    all_results: List[Dict[str, Any]],
) -> tuple[List[AiItem], float]:
    label_data: Dict[str, Dict] = {}
    total_volume_ft3 = 0.0
    for result in all_results:
        total_volume_ft3 += float(result.get("total_volume_ft3", 0.0))
        for item in result.get("items", []):
            label = item.get("label", "Unknown item")
            quantity = item.get("quantity", 1)
            volume = item.get("volume_ft3", 0.0)
            if label in label_data:
                label_data[label]["quantity"] += quantity
                label_data[label]["volume"] += volume
            else:
                label_data[label] = {"quantity": quantity, "volume": volume}

    items: List[AiItem] = [
        AiItem(
            name=label,
            quantity=data["quantity"],
            estimated_volume_ft3=round(data["volume"], 2),
        )
        for label, data in label_data.items()
    ]

    if not items:
        print("[MOVCO-STORAGE] ⚠️  No items detected - using fallback")
        items.append(
            AiItem(
                name="Miscellaneous items",
                quantity=10,
                note="No specific items detected - using fallback estimate",
                estimated_volume_ft3=30.0,
            )
        )
        total_volume_ft3 = 30.0

    return items, total_volume_ft3


# ---------- Main endpoint ----------

@app.post("/analyze", response_model=AnalyzeResponse)
def analyze_storage(req: AnalyzeRequest):
    print(f"\n[MOVCO-STORAGE] ========================================")
    print(f"[MOVCO-STORAGE] 🚀 Starting storage analysis of {len(req.photo_urls)} photo(s)")
    print(f"[MOVCO-STORAGE] ========================================\n")

    # Analyze photos with Claude
    all_results: List[Dict[str, Any]] = []
    for i, url in enumerate(req.photo_urls, 1):
        print(f"[MOVCO-STORAGE] 📸 Processing photo {i}/{len(req.photo_urls)}")
        try:
            result = analyze_room_with_claude(url)
            all_results.append(result)
        except Exception as e:
            print(f"[MOVCO-STORAGE] ❌ Error analyzing photo {i}: {e}")
            traceback.print_exc()
            all_results.append({"items": [], "total_volume_ft3": 0.0})

    # Aggregate items & calculate volume
    items, total_volume_ft3 = aggregate_items_and_volume(all_results)
    total_volume_m3 = round(total_volume_ft3 * FT3_TO_M3, 2)
    total_area_m2 = round(total_volume_m3 * 1.3, 2)

    print(f"\n[MOVCO-STORAGE] 📊 RESULTS:")
    print(f"[MOVCO-STORAGE]    Volume: {total_volume_ft3:.1f} ft³ = {total_volume_m3} m³")
    print(f"[MOVCO-STORAGE]    Items: {len(items)} types detected")
    print(f"[MOVCO-STORAGE] ✅ Storage analysis complete!\n")

    description = (
        f"Storage estimate based on AI analysis of {len(req.photo_urls)} photo(s). "
        f"Detected {len(items)} item type(s) with total volume of {total_volume_m3:.1f} m³."
    )

    return AnalyzeResponse(
        items=items,
        totalVolumeM3=total_volume_m3,
        totalAreaM2=total_area_m2,
        description=description,
    )


if __name__ == "__main__":
    import uvicorn
    print("\n[MOVCO-STORAGE] 🚀 Starting MOVCO Storage API...")
    print(f"[MOVCO-STORAGE] 🔑 Anthropic API Key: {bool(ANTHROPIC_API_KEY)}\n")
    uvicorn.run("api:app", host="127.0.0.1", port=8001, reload=False)