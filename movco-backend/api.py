# api.py — MOVCO Quote API (Improved v2)
# Changes:
#   ✅ Van count calculation (Luton van @ 35 m³)
#   ✅ Mover/labour estimation
#   ✅ Hybrid pricing: ML model + rule-based sanity bounds
#   ✅ Weekend premium detection
#   ✅ Richer QuoteResponse with van_count, movers, breakdown
#   ✅ Improved description with van info

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import joblib
import requests
import anthropic
import base64
import math
from datetime import datetime
import os
import traceback

FT3_TO_M3 = 0.0283168  # cubic feet -> cubic metres

# ---------------------------------------------------------------------------
# Van & labour constants (UK removals industry standard)
# ---------------------------------------------------------------------------
LUTON_VAN_CAPACITY_M3 = 35.0   # Large Luton van: ~30-38 m³, we use 35
SWB_VAN_CAPACITY_M3 = 11.0     # Small (short wheelbase) van
LWB_VAN_CAPACITY_M3 = 18.0     # Medium (long wheelbase) van

# ---------------------------------------------------------------------------
# Rule-based pricing constants (UK removals market rates 2025/2026)
# ---------------------------------------------------------------------------
BASE_RATE = 0.0                 # No base rate - price is purely van + staff + miles
RATE_PER_M3 = 0.0              # Not used - price driven by vans/staff/miles
RATE_PER_MILE = 0.50            # £0.50 per mile driving distance
RATE_PER_VAN = 100.0            # £100 per van needed (all vans, not just extra)
RATE_PER_MOVER_HOUR = 15.0      # £15 per mover per hour
PRICE_MULTIPLIER = 2.0          # Double total cost = customer price
MIN_HOURS_ESTIMATE = 2.0        # Minimum job time in hours
WEEKEND_PREMIUM = 1.15          # 15% surcharge Sat/Sun
STAIRS_SURCHARGE_PER_FLIGHT = 50.0  # £ per flight of stairs (future use)

# Price bounds: ML prediction must be within this range of rule-based estimate
ML_LOWER_BOUND_FACTOR = 0.70    # ML price must be >= 70% of rule-based
ML_UPPER_BOUND_FACTOR = 1.40    # ML price must be <= 140% of rule-based
MIN_QUOTE = 200.0               # Absolute minimum quote (£)

# ---------------------------------------------------------------------------
# Environment & model loading
# ---------------------------------------------------------------------------
MODEL_PATH = os.getenv("MOVCO_MODEL_PATH", "movco_model.joblib")

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
if not ANTHROPIC_API_KEY:
    print("[MOVCO] WARNING: ANTHROPIC_API_KEY not set - furniture detection will fail")
else:
    print("[MOVCO] ✓ ANTHROPIC_API_KEY is configured")

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
if not GOOGLE_MAPS_API_KEY:
    print("[MOVCO] WARNING: GOOGLE_MAPS_API_KEY not set - will use fallback distance")
else:
    print("[MOVCO] ✓ GOOGLE_MAPS_API_KEY is configured")

print("[MOVCO] Loading price model from:", MODEL_PATH)
try:
    model = joblib.load(MODEL_PATH)
    print("[MOVCO] ✓ Price model loaded successfully")
except Exception as e:
    print(f"[MOVCO] ERROR loading model at '{MODEL_PATH}': {e}")
    raise

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
        "anthropic_configured": bool(ANTHROPIC_API_KEY),
        "google_maps_configured": bool(GOOGLE_MAPS_API_KEY),
        "model_loaded": model is not None,
    }


# ---------- Schemas ----------

class QuoteRequest(BaseModel):
    starting_address: str
    ending_address: str
    photo_urls: List[str]


class AiItem(BaseModel):
    name: str
    quantity: int
    note: Optional[str] = None
    estimated_volume_ft3: Optional[float] = None


class QuoteResponse(BaseModel):
    estimate: float
    description: str
    items: List[AiItem]
    totalVolumeM3: float
    totalAreaM2: float
    distance_miles: Optional[float] = None
    duration_text: Optional[str] = None
    # ---- NEW fields ----
    van_count: int = 1
    van_description: str = "1 × Large Van (Luton)"
    recommended_movers: int = 2
    is_weekend: bool = False
    pricing_method: str = "hybrid"  # "model", "rule_based", or "hybrid"


FURNITURE_VOLUMES = {
    # ===== SOFAS & SEATING =====
    "sofa": 30.0,                    # ~0.85m³
    "3-seater sofa": 35.0,           # ~0.99m³
    "2-seater sofa": 25.0,           # ~0.71m³
    "loveseat": 22.0,                # ~0.62m³
    "sectional sofa": 55.0,          # ~1.56m³
    "armchair": 15.0,                # ~0.42m³
    "recliner": 18.0,                # ~0.51m³
    "sofa bed": 40.0,                # ~1.13m³
    "chair": 10.0,                   # ~0.28m³

    # ===== BEDS & BEDROOM =====
    "bed": 40.0,                     # ~1.13m³ (double, no mattress)
    "king bed": 50.0,                # ~1.42m³
    "queen bed": 45.0,               # ~1.27m³
    "double bed": 40.0,              # ~1.13m³
    "single bed": 28.0,              # ~0.79m³
    "bunk bed": 55.0,                # ~1.56m³
    "bed frame": 25.0,               # ~0.71m³
    "mattress": 18.0,                # ~0.51m³ (compressible)
    "single mattress": 14.0,         # ~0.40m³
    "double mattress": 18.0,         # ~0.51m³
    "king mattress": 22.0,           # ~0.62m³
    "box spring": 18.0,              # ~0.51m³
    "headboard": 8.0,                # ~0.23m³
    "bedside table": 5.0,            # ~0.14m³
    "nightstand": 5.0,               # ~0.14m³

    # ===== STORAGE & WARDROBES =====
    "wardrobe": 38.0,                # ~1.08m³
    "large wardrobe": 50.0,          # ~1.42m³
    "double wardrobe": 45.0,         # ~1.27m³
    "single wardrobe": 28.0,         # ~0.79m³
    "armoire": 45.0,                 # ~1.27m³
    "chest of drawers": 18.0,        # ~0.51m³
    "tall chest of drawers": 22.0,   # ~0.62m³
    "dresser": 20.0,                 # ~0.57m³
    "filing cabinet": 8.0,           # ~0.23m³
    "cabinet": 15.0,                 # ~0.42m³
    "storage cabinet": 15.0,         # ~0.42m³
    "display cabinet": 20.0,         # ~0.57m³
    "china cabinet": 25.0,           # ~0.71m³

    # ===== TABLES =====
    "dining table": 25.0,            # ~0.71m³
    "large dining table": 35.0,      # ~0.99m³
    "coffee table": 8.0,             # ~0.23m³
    "side table": 4.0,               # ~0.11m³
    "end table": 4.0,                # ~0.11m³
    "console table": 10.0,           # ~0.28m³
    "desk": 20.0,                    # ~0.57m³
    "office desk": 22.0,             # ~0.62m³
    "computer desk": 18.0,           # ~0.51m³
    "dressing table": 18.0,          # ~0.51m³

    # ===== CHAIRS =====
    "dining chair": 5.0,             # ~0.14m³
    "office chair": 8.0,             # ~0.23m³
    "bar stool": 3.0,                # ~0.08m³
    "stool": 3.0,                    # ~0.08m³
    "bench": 10.0,                   # ~0.28m³
    "ottoman": 8.0,                  # ~0.23m³
    "footstool": 4.0,                # ~0.11m³

    # ===== SHELVING & BOOKCASES =====
    "bookcase": 18.0,                # ~0.51m³
    "bookshelf": 18.0,               # ~0.51m³
    "large bookcase": 25.0,          # ~0.71m³
    "shelving unit": 15.0,           # ~0.42m³
    "wall unit": 30.0,               # ~0.85m³

    # ===== TV & MEDIA =====
    "tv": 5.0,                       # ~0.14m³ (flat screen)
    "large tv": 8.0,                 # ~0.23m³ (65"+)
    "tv stand": 12.0,                # ~0.34m³
    "entertainment center": 28.0,    # ~0.79m³
    "media unit": 20.0,              # ~0.57m³

    # ===== SIDEBOARDS & LIVING ROOM =====
    "sideboard": 20.0,               # ~0.57m³
    "credenza": 18.0,                # ~0.51m³
    "buffet": 20.0,                  # ~0.57m³

    # ===== APPLIANCES =====
    "refrigerator": 28.0,            # ~0.79m³
    "fridge": 25.0,                  # ~0.71m³
    "fridge freezer": 30.0,          # ~0.85m³
    "washing machine": 18.0,         # ~0.51m³
    "dryer": 18.0,                   # ~0.51m³
    "dishwasher": 14.0,              # ~0.40m³
    "microwave": 2.0,                # ~0.06m³
    "oven": 20.0,                    # ~0.57m³
    "cooker": 22.0,                  # ~0.62m³
    "freezer": 22.0,                 # ~0.62m³

    # ===== BOXES & PACKING =====
    "boxes": 2.5,                    # ~0.07m³ per box
    "box": 2.5,                      # ~0.07m³
    "cardboard box": 2.5,            # ~0.07m³
    "large box": 4.0,                # ~0.11m³
    "small box": 1.5,                # ~0.04m³
    "storage box": 3.0,              # ~0.08m³
    "storage crate": 3.0,            # ~0.08m³
    "packing box": 2.5,              # ~0.07m³
    "removal box": 2.5,              # ~0.07m³
    "bin": 2.0,                      # ~0.06m³
    "storage bin": 2.0,              # ~0.06m³

    # ===== DÉCOR & MISC =====
    "mirror": 3.0,                   # ~0.08m³
    "large mirror": 5.0,             # ~0.14m³
    "lamp": 2.0,                     # ~0.06m³
    "floor lamp": 3.0,               # ~0.08m³
    "rug": 3.0,                      # ~0.08m³ (rolled)
    "large rug": 6.0,                # ~0.17m³ (rolled)
    "plant": 3.0,                    # ~0.08m³
    "large plant": 6.0,              # ~0.17m³
    "picture": 1.0,                  # ~0.03m³
    "artwork": 2.0,                  # ~0.06m³

    # ===== GARDEN & OUTDOOR =====
    "garden furniture": 20.0,        # ~0.57m³
    "garden table": 15.0,            # ~0.42m³
    "garden chair": 5.0,             # ~0.14m³
    "bbq": 10.0,                     # ~0.28m³
    "lawnmower": 12.0,               # ~0.34m³

    # ===== SPORTS & LEISURE =====
    "bicycle": 10.0,                 # ~0.28m³
    "treadmill": 22.0,               # ~0.62m³
    "exercise bike": 12.0,           # ~0.34m³
    "exercise equipment": 15.0,      # ~0.42m³
    "golf clubs": 5.0,               # ~0.14m³

    # ===== CHILDREN =====
    "cot": 18.0,                     # ~0.51m³
    "crib": 18.0,                    # ~0.51m³
    "pram": 8.0,                     # ~0.23m³
    "pushchair": 6.0,                # ~0.17m³
    "high chair": 5.0,               # ~0.14m³
    "toy box": 6.0,                  # ~0.17m³

    # ===== OFFICE =====
    "printer": 3.0,                  # ~0.08m³
    "computer": 3.0,                 # ~0.08m³
    "monitor": 3.0,                  # ~0.08m³
    "safe": 15.0,                    # ~0.42m³
}


def estimate_item_volume(item_name: str) -> float:
    item_lower = item_name.lower().strip()
    if item_lower in FURNITURE_VOLUMES:
        return FURNITURE_VOLUMES[item_lower]
    for key, volume in FURNITURE_VOLUMES.items():
        if key in item_lower or item_lower in key:
            return volume
    return 15.0


# ---------- Van & Labour Estimation (NEW) ----------

def calculate_van_count(total_volume_m3: float) -> dict:
    """
    Calculate the number and type of vans needed based on total volume.
    Uses Luton vans (35 m³) as the standard, with smaller vans for small moves.

    Returns dict with van_count, van_description, and van_type.
    """
    if total_volume_m3 <= 0:
        return {
            "van_count": 1,
            "van_type": "small",
            "van_description": "1 × Small Van (SWB)",
            "capacity_used_pct": 0,
        }

    # Small move: fits in a small or medium van
    if total_volume_m3 <= SWB_VAN_CAPACITY_M3:
        return {
            "van_count": 1,
            "van_type": "small",
            "van_description": "1 × Small Van (SWB, ~11 m³)",
            "capacity_used_pct": round((total_volume_m3 / SWB_VAN_CAPACITY_M3) * 100),
        }

    if total_volume_m3 <= LWB_VAN_CAPACITY_M3:
        return {
            "van_count": 1,
            "van_type": "medium",
            "van_description": "1 × Medium Van (LWB, ~18 m³)",
            "capacity_used_pct": round((total_volume_m3 / LWB_VAN_CAPACITY_M3) * 100),
        }

    # Standard / large move: use Luton vans
    if total_volume_m3 <= LUTON_VAN_CAPACITY_M3:
        return {
            "van_count": 1,
            "van_type": "large",
            "van_description": "1 × Large Van (Luton, ~35 m³)",
            "capacity_used_pct": round((total_volume_m3 / LUTON_VAN_CAPACITY_M3) * 100),
        }

    # Multiple Luton vans needed
    van_count = math.ceil(total_volume_m3 / LUTON_VAN_CAPACITY_M3)
    total_capacity = van_count * LUTON_VAN_CAPACITY_M3
    pct = round((total_volume_m3 / total_capacity) * 100)

    return {
        "van_count": van_count,
        "van_type": "large",
        "van_description": f"{van_count} × Large Van{'s' if van_count > 1 else ''} (Luton, ~35 m³ each)",
        "capacity_used_pct": pct,
    }


def calculate_movers(van_count: int, total_volume_m3: float) -> int:
    """
    Estimate the recommended number of movers based on van count and volume.
    Industry standard:
      - 1 small/medium van: 2 movers
      - 1 Luton van: 2 movers
      - 2 Luton vans: 3 movers
      - 3+ Luton vans: 4 movers
    Heavy items (high volume per item) may warrant extra.
    """
    if van_count <= 1:
        return 2
    elif van_count == 2:
        return 3
    else:
        return 4


def estimate_job_hours(total_volume_m3: float, distance_miles: float) -> float:
    """
    Estimate total job time (loading + driving + unloading).
    Rule of thumb:
      - Loading:   ~1 hour per 15 m³
      - Driving:   from Google Maps duration
      - Unloading: ~80% of loading time
    """
    loading_hours = max(total_volume_m3 / 15.0, 1.0)
    driving_hours = max(distance_miles / 30.0, 0.5)  # assume ~30 mph avg
    unloading_hours = loading_hours * 0.8
    total = loading_hours + driving_hours + unloading_hours
    return max(total, MIN_HOURS_ESTIMATE)


# ---------- Rule-Based Pricing (NEW) ----------

def calculate_rule_based_price(
    total_volume_m3: float,
    distance_miles: float,
    van_count: int,
    movers: int,
    is_weekend: bool = False,
    stairs_flights: int = 0,
) -> dict:
    """
    Simple pricing model:
      - £100 per van needed
      - £15 per staff member per hour
      - £0.50 per mile
      - Total cost × 2 = customer price
    """
    # Van cost: ALL vans, not just extras
    van_cost = van_count * RATE_PER_VAN

    # Labour cost: movers × hours × rate
    job_hours = estimate_job_hours(total_volume_m3, distance_miles)
    labour_cost = movers * job_hours * RATE_PER_MOVER_HOUR

    # Distance cost
    distance_cost = distance_miles * RATE_PER_MILE

    # Stairs surcharge
    stairs_cost = stairs_flights * STAIRS_SURCHARGE_PER_FLIGHT

    # Total cost
    total_cost = van_cost + labour_cost + distance_cost + stairs_cost

    # Weekend premium (applied before doubling)
    if is_weekend:
        weekend_extra = total_cost * (WEEKEND_PREMIUM - 1.0)
        total_cost = total_cost + weekend_extra
    else:
        weekend_extra = 0.0

    # Customer price = cost × 2
    customer_price = total_cost * PRICE_MULTIPLIER

    # Enforce minimum
    customer_price = max(customer_price, MIN_QUOTE)

    return {
        "total": round(customer_price, 2),
        "cost": round(total_cost, 2),
        "breakdown": {
            "van_cost": round(van_cost, 2),
            "labour_cost": round(labour_cost, 2),
            "distance_cost": round(distance_cost, 2),
            "stairs_cost": round(stairs_cost, 2),
            "weekend_premium": round(weekend_extra, 2),
            "total_cost": round(total_cost, 2),
            "multiplier": PRICE_MULTIPLIER,
        },
        "job_hours": round(job_hours, 1),
    }


# ---------- Hybrid Pricing (NEW) ----------

def calculate_hybrid_price(
    ml_prediction: float,
    rule_based_price: float,
) -> tuple[float, str]:
    """
    Combine ML model prediction with rule-based sanity bounds.

    - If ML prediction is within bounds of rule-based → use ML (it's learned from real data)
    - If ML prediction is outside bounds → clamp it and flag as 'hybrid'
    - If ML fails entirely → use rule-based

    Returns (final_price, method_used)
    """
    lower = rule_based_price * ML_LOWER_BOUND_FACTOR
    upper = rule_based_price * ML_UPPER_BOUND_FACTOR

    if ml_prediction <= 0:
        return max(rule_based_price, MIN_QUOTE), "rule_based"

    if lower <= ml_prediction <= upper:
        # ML prediction is reasonable — trust it
        return max(round(ml_prediction, 2), MIN_QUOTE), "model"

    # ML is out of range — clamp it
    clamped = max(lower, min(ml_prediction, upper))
    print(f"[MOVCO] ⚠️  ML price £{ml_prediction:.2f} outside bounds "
          f"[£{lower:.2f} – £{upper:.2f}], clamped to £{clamped:.2f}")
    return max(round(clamped, 2), MIN_QUOTE), "hybrid"


# ---------- Google Maps Distance ----------

def get_google_maps_distance(start: str, end: str) -> Dict[str, Any]:
    if not GOOGLE_MAPS_API_KEY:
        print("[MOVCO] ⚠️  No Google Maps API key - using fallback distance")
        return fallback_distance(start, end)

    try:
        url = "https://maps.googleapis.com/maps/api/distancematrix/json"
        params = {
            "origins": start,
            "destinations": end,
            "mode": "driving",
            "units": "imperial",
            "region": "uk",
            "key": GOOGLE_MAPS_API_KEY,
        }

        print(f"[MOVCO] 🗺️  Calling Google Maps Distance Matrix API...")
        print(f"[MOVCO]    From: {start}")
        print(f"[MOVCO]    To: {end}")

        resp = requests.get(url, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()

        if data.get("status") != "OK":
            print(f"[MOVCO] ⚠️  Google Maps API error: {data.get('status')}")
            return fallback_distance(start, end)

        element = data["rows"][0]["elements"][0]

        if element.get("status") != "OK":
            print(f"[MOVCO] ⚠️  Route not found: {element.get('status')}")
            return fallback_distance(start, end)

        distance_meters = element["distance"]["value"]
        distance_km = distance_meters / 1000.0
        distance_miles = distance_km * 0.621371
        duration_seconds = element["duration"]["value"]
        duration_text = element["duration"]["text"]
        distance_text = element["distance"]["text"]

        print(f"[MOVCO] ✅ Google Maps: {distance_text} ({distance_miles:.1f} mi), {duration_text}")

        return {
            "distance_km": round(distance_km, 1),
            "distance_miles": round(distance_miles, 1),
            "duration_text": duration_text,
            "duration_seconds": duration_seconds,
            "source": "google_maps",
        }

    except Exception as e:
        print(f"[MOVCO] ❌ Google Maps API error: {e}")
        traceback.print_exc()
        return fallback_distance(start, end)


def fallback_distance(start: str, end: str) -> Dict[str, Any]:
    distance_km = 32.0
    distance_miles = 20.0
    print(f"[MOVCO] ⚠️  Using fallback distance: {distance_miles} miles")
    return {
        "distance_km": distance_km,
        "distance_miles": distance_miles,
        "duration_text": "~45 mins (estimated)",
        "duration_seconds": 2700,
        "source": "fallback",
    }


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
    print(f"[MOVCO] 📥 Downloading image from: {fixed_url[:80]}...")
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
    print(f"[MOVCO] ✓ Image downloaded ({len(base64_image)} chars, {media_type})")
    return base64_image, media_type


def analyze_room_with_claude(image_url: str) -> Dict[str, Any]:
    if not client:
        print("[MOVCO] ❌ Anthropic client not initialized")
        return {"items": [], "total_volume_ft3": 0.0}
    try:
        base64_image, media_type = download_image_as_base64(image_url)
        print(f"[MOVCO] 🤖 Sending image to Claude Vision API...")
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
                            "text": """Analyze this room photo for a moving/removals company. 

Identify ALL furniture and notable items visible in the image. For each item, provide:
1. The item name (be specific - e.g., "3-seater sofa" not just "sofa")
2. Quantity (if multiple identical items are visible)

Format your response EXACTLY as a list like this:
- 3-seater sofa (1)
- armchair (2)
- coffee table (1)
- dining table (1)
- dining chair (4)
- bookshelf (1)
- tv stand (1)
- boxes (5)

Be thorough - include tables, chairs, shelves, beds, sofas, cabinets, storage boxes, plants, TVs, appliances, etc. Count everything that would need to be moved.""",
                        },
                    ],
                }
            ],
        )
        response_text = message.content[0].text
        print(f"[MOVCO] 🤖 Claude response:\n{response_text}\n")

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

        print(f"[MOVCO] ✓ Detected {len(items)} item types, total: {total_volume_ft3:.2f} ft³")
        return {"items": items, "total_volume_ft3": round(total_volume_ft3, 2)}

    except Exception as e:
        print(f"[MOVCO] ❌ Error analyzing with Claude: {e}")
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
        print("[MOVCO] ⚠️  No items detected - using fallback")
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


def estimate_rooms_from_volume(total_volume_m3: float) -> int:
    """Map volume to approximate room count for ML model feature."""
    if total_volume_m3 <= 15:
        return 2
    elif total_volume_m3 <= 30:
        return 4
    elif total_volume_m3 <= 50:
        return 5
    else:
        return 6


def build_features_for_price_model(
    total_volume_m3: float,
    items: List[AiItem],
    distance_km: float,
) -> List[List[float]]:
    rooms = estimate_rooms_from_volume(total_volume_m3)
    stairs = 0.0
    packing = 0.0
    now = datetime.now()
    day_of_week = float(now.weekday()) + 1
    month = float(now.month)
    return [
        [
            float(distance_km),
            float(rooms),
            float(stairs),
            float(packing),
            day_of_week,
            month,
        ]
    ]


def is_weekend_today() -> bool:
    return datetime.now().weekday() >= 5  # 5=Sat, 6=Sun


# ---------- Main endpoint ----------

@app.post("/analyze", response_model=QuoteResponse)
def analyze_quote(req: QuoteRequest):
    print(f"\n[MOVCO] ========================================")
    print(f"[MOVCO] 🚀 Starting analysis of {len(req.photo_urls)} photo(s)")
    print(f"[MOVCO] 📍 From: {req.starting_address}")
    print(f"[MOVCO] 📍 To: {req.ending_address}")
    print(f"[MOVCO] ========================================\n")

    # Step 1: Get real distance from Google Maps
    distance_info = get_google_maps_distance(req.starting_address, req.ending_address)
    distance_km = distance_info["distance_km"]
    distance_miles = distance_info["distance_miles"]
    duration_text = distance_info["duration_text"]

    print(f"[MOVCO] 🗺️  Distance: {distance_miles} mi ({distance_km} km), {duration_text}")

    # Step 2: Analyze photos with Claude
    all_results: List[Dict[str, Any]] = []
    for i, url in enumerate(req.photo_urls, 1):
        print(f"[MOVCO] 📸 Processing photo {i}/{len(req.photo_urls)}")
        try:
            result = analyze_room_with_claude(url)
            all_results.append(result)
        except Exception as e:
            print(f"[MOVCO] ❌ Error analyzing photo {i}: {e}")
            traceback.print_exc()
            all_results.append({"items": [], "total_volume_ft3": 0.0})

    # Step 3: Aggregate items & calculate volume
    items, total_volume_ft3 = aggregate_items_and_volume(all_results)
    total_volume_m3 = round(total_volume_ft3 * FT3_TO_M3, 2)
    total_area_m2 = round(total_volume_m3 * 1.3, 2)

    # Step 4: Calculate van count & movers (NEW)
    van_info = calculate_van_count(total_volume_m3)
    van_count = van_info["van_count"]
    van_description = van_info["van_description"]
    movers = calculate_movers(van_count, total_volume_m3)

    print(f"\n[MOVCO] 📊 ANALYSIS RESULTS:")
    print(f"[MOVCO]    Volume: {total_volume_ft3:.1f} ft³ = {total_volume_m3} m³")
    print(f"[MOVCO]    Items: {len(items)} types detected")
    print(f"[MOVCO]    Vans: {van_description}")
    print(f"[MOVCO]    Movers: {movers}")
    print(f"[MOVCO]    Distance: {distance_miles} mi ({duration_text})")

    # Step 5: Weekend check
    weekend = is_weekend_today()
    if weekend:
        print(f"[MOVCO]    ⚠️  Weekend premium applies (+15%)")

    # Step 6: Rule-based price (NEW — always calculated as sanity check)
    rule_price_info = calculate_rule_based_price(
        total_volume_m3=total_volume_m3,
        distance_miles=distance_miles,
        van_count=van_count,
        movers=movers,
        is_weekend=weekend,
        stairs_flights=0,
    )
    rule_price = rule_price_info["total"]
    print(f"[MOVCO] 💰 Rule-based price: £{rule_price:.2f}")
    print(f"[MOVCO]    Breakdown: {rule_price_info['breakdown']}")

    # Step 7: Use rule-based price directly (simple formula: vans + staff + miles, ×2)
    estimate = rule_price
    pricing_method = "calculated"

    print(f"[MOVCO] 💰 FINAL PRICE: £{estimate:.2f} (method: {pricing_method})")

    # Step 9: Build rich description (IMPROVED)
    weekend_note = " Weekend rates apply (+15%)." if weekend else ""
    description = (
        f"Estimate based on AI analysis of {len(req.photo_urls)} room photo(s). "
        f"Detected {len(items)} item type(s) with total volume of {total_volume_m3:.1f} m³. "
        f"You would need {van_description} and {movers} movers for this move. "
        f"Driving distance: {distance_miles} miles ({duration_text}). "
        f"Estimated job time: {rule_price_info['job_hours']} hours.{weekend_note}"
    )

    print(f"[MOVCO] ✅ Analysis complete!\n")

    return QuoteResponse(
        estimate=estimate,
        description=description,
        items=items,
        totalVolumeM3=total_volume_m3,
        totalAreaM2=total_area_m2,
        distance_miles=distance_miles,
        duration_text=duration_text,
        van_count=van_count,
        van_description=van_description,
        recommended_movers=movers,
        is_weekend=weekend,
        pricing_method=pricing_method,
    )


if __name__ == "__main__":
    import uvicorn

    print("\n[MOVCO] 🚀 Starting MOVCO API server (v2 — improved pricing)...")
    print(f"[MOVCO] 🔑 Anthropic API Key: {bool(ANTHROPIC_API_KEY)}")
    print(f"[MOVCO] 🗺️  Google Maps API Key: {bool(GOOGLE_MAPS_API_KEY)}")
    print(f"[MOVCO] 📦 Model loaded: {model is not None}\n")
    uvicorn.run("api:app", host="127.0.0.1", port=8000, reload=False)
    