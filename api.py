# api.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import joblib
import requests
import anthropic
import base64
from datetime import datetime
import os
import traceback

FT3_TO_M3 = 0.0283168

MODEL_PATH = os.getenv("MOVCO_MODEL_PATH", "movco_model.joblib")

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
if not ANTHROPIC_API_KEY:
    print("[MOVCO] WARNING: ANTHROPIC_API_KEY not set - furniture detection will fail")
else:
    print("[MOVCO] ✓ ANTHROPIC_API_KEY is configured")

print("[MOVCO] Loading price model from:", MODEL_PATH)
try:
    model = joblib.load(MODEL_PATH)
    print("[MOVCO] ✓ Price model loaded successfully")
except Exception as e:
    print(f"[MOVCO] ERROR loading model at '{MODEL_PATH}': {e}")
    raise

app = FastAPI()

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY else None

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
        "model_loaded": model is not None
    }


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


FURNITURE_VOLUMES = {
    "sofa": 50.0,
    "3-seater sofa": 60.0,
    "2-seater sofa": 45.0,
    "loveseat": 40.0,
    "sectional sofa": 80.0,
    "armchair": 30.0,
    "recliner": 35.0,
    "bed": 70.0,
    "queen bed": 70.0,
    "king bed": 85.0,
    "double bed": 65.0,
    "single bed": 50.0,
    "bunk bed": 80.0,
    "dining table": 45.0,
    "coffee table": 15.0,
    "side table": 8.0,
    "end table": 8.0,
    "console table": 20.0,
    "desk": 35.0,
    "office desk": 40.0,
    "dresser": 45.0,
    "chest of drawers": 40.0,
    "wardrobe": 65.0,
    "armoire": 70.0,
    "bookshelf": 35.0,
    "bookcase": 40.0,
    "tv stand": 25.0,
    "entertainment center": 50.0,
    "nightstand": 10.0,
    "bedside table": 10.0,
    "dining chair": 8.0,
    "office chair": 12.0,
    "bar stool": 6.0,
    "ottoman": 12.0,
    "cabinet": 30.0,
    "filing cabinet": 15.0,
    "china cabinet": 45.0,
    "sideboard": 40.0,
    "credenza": 35.0,
    "bench": 15.0,
    "footstool": 5.0,
    "mirror": 5.0,
    "large mirror": 8.0,
    "lamp": 3.0,
    "floor lamp": 4.0,
    "mattress": 30.0,
    "box spring": 30.0,
    "rug": 5.0,
    "large rug": 10.0,
    "tv": 8.0,
    "large tv": 12.0,
    "refrigerator": 55.0,
    "washing machine": 30.0,
    "dryer": 30.0,
    "dishwasher": 25.0,
    "microwave": 4.0,
    "boxes": 3.0,
    "storage box": 3.0,
    "bin": 2.0,
    "plant": 5.0,
    "large plant": 10.0,
    "bicycle": 15.0,
    "treadmill": 40.0,
    "exercise equipment": 20.0,
}


def estimate_item_volume(item_name: str) -> float:
    item_lower = item_name.lower().strip()
    if item_lower in FURNITURE_VOLUMES:
        return FURNITURE_VOLUMES[item_lower]
    for key, volume in FURNITURE_VOLUMES.items():
        if key in item_lower or item_lower in key:
            return volume
    return 15.0


def normalise_supabase_url(url: str) -> str:
    if "/storage/v1/object/sign/" in url:
        base, _, _ = url.partition("?")
        public_base = base.replace(
            "/storage/v1/object/sign/",
            "/storage/v1/object/public/"
        )
        print(f"[MOVCO] ✓ Converted signed Supabase URL to public URL")
        return public_base
    return url


def download_image_as_base64(url: str) -> tuple[str, str]:
    fixed_url = normalise_supabase_url(url)
    print(f"[MOVCO] 📥 Downloading image from: {fixed_url[:80]}...")
    resp = requests.get(fixed_url, timeout=15)
    resp.raise_for_status()
    content_type = resp.headers.get('content-type', 'image/jpeg')
    if 'png' in content_type:
        media_type = 'image/png'
    elif 'webp' in content_type:
        media_type = 'image/webp'
    elif 'gif' in content_type:
        media_type = 'image/gif'
    else:
        media_type = 'image/jpeg'
    base64_image = base64.b64encode(resp.content).decode('utf-8')
    print(f"[MOVCO] ✓ Image downloaded and encoded ({len(base64_image)} chars, {media_type})")
    return base64_image, media_type


def analyze_room_with_claude(image_url: str) -> Dict[str, Any]:
    if not client:
        print("[MOVCO] ❌ Anthropic client not initialized - returning empty results")
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

Be thorough - include tables, chairs, shelves, beds, sofas, cabinets, storage boxes, plants, TVs, appliances, etc. Count everything that would need to be moved."""
                        }
                    ],
                }
            ],
        )
        response_text = message.content[0].text
        print(f"[MOVCO] 🤖 Claude response:\n{response_text}\n")
        items = []
        total_volume_ft3 = 0.0
        for line in response_text.split('\n'):
            line = line.strip()
            if not line or not line.startswith('-'):
                continue
            line = line[1:].strip()
            if '(' in line and ')' in line:
                item_name = line[:line.rfind('(')].strip()
                quantity_str = line[line.rfind('(')+1:line.rfind(')')].strip()
                try:
                    quantity = int(quantity_str)
                except:
                    quantity = 1
            else:
                item_name = line
                quantity = 1
            unit_volume = estimate_item_volume(item_name)
            item_volume = unit_volume * quantity
            items.append({
                "label": item_name,
                "quantity": quantity,
                "volume_ft3": round(item_volume, 2)
            })
            total_volume_ft3 += item_volume
        print(f"[MOVCO] ✓ Detected {len(items)} item types, total volume: {total_volume_ft3:.2f} ft³")
        return {
            "items": items,
            "total_volume_ft3": round(total_volume_ft3, 2)
        }
    except Exception as e:
        print(f"[MOVCO] ❌ Error analyzing with Claude: {e}")
        traceback.print_exc()
        return {"items": [], "total_volume_ft3": 0.0}


def aggregate_items_and_volume(all_results: List[Dict[str, Any]]) -> tuple[List[AiItem], float]:
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
            estimated_volume_ft3=round(data["volume"], 2)
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
                estimated_volume_ft3=30.0
            )
        )
        total_volume_ft3 = 30.0
    return items, total_volume_ft3


def rough_distance_km(start: str, end: str) -> float:
    if not start or not end:
        return 10.0
    diff = abs(len(start) - len(end))
    return 5.0 + diff * 2.0


def estimate_rooms_from_volume(total_volume_m3: float) -> int:
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
    starting_address: str,
    ending_address: str,
) -> List[List[float]]:
    distance_km = rough_distance_km(starting_address, ending_address)
    rooms = estimate_rooms_from_volume(total_volume_m3)
    stairs = 0.0
    packing = 0.0
    now = datetime.now()
    day_of_week = float(now.weekday()) + 1
    month = float(now.month)
    return [[
        float(distance_km),
        float(rooms),
        float(stairs),
        float(packing),
        day_of_week,
        month,
    ]]


@app.post("/analyze", response_model=QuoteResponse)
def analyze_quote(req: QuoteRequest):
    print(f"\n[MOVCO] ========================================")
    print(f"[MOVCO] 🚀 Starting analysis of {len(req.photo_urls)} photo(s)")
    print(f"[MOVCO] 📍 From: {req.starting_address}")
    print(f"[MOVCO] 📍 To: {req.ending_address}")
    print(f"[MOVCO] ========================================\n")
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
    items, total_volume_ft3 = aggregate_items_and_volume(all_results)
    total_volume_m3 = round(total_volume_ft3 * FT3_TO_M3, 2)
    total_area_m2 = round(total_volume_m3 * 1.3, 2)
    print(f"\n[MOVCO] 📊 FINAL RESULTS:")
    print(f"[MOVCO]    Total volume: {total_volume_ft3:.2f} ft³ = {total_volume_m3} m³")
    print(f"[MOVCO]    Total items detected: {len(items)}")
    features = build_features_for_price_model(
        total_volume_m3=total_volume_m3,
        items=items,
        starting_address=req.starting_address,
        ending_address=req.ending_address,
    )
    try:
        raw_pred = model.predict(features)[0]
        estimate = float(raw_pred)
        print(f"[MOVCO] 💰 Price from model: £{estimate:.2f}")
    except Exception as e:
        print(f"[MOVCO] ⚠️  Error in model.predict: {e}")
        base = 800.0
        per_m3 = 60.0
        estimate = float(round(base + per_m3 * total_volume_m3, 2))
        print(f"[MOVCO] 💰 Price from fallback: £{estimate:.2f}")
    description = (
        f"Estimate based on AI analysis of {len(req.photo_urls)} room photo(s). "
        f"Detected {len(items)} item type(s) with total volume of {total_volume_m3:.1f} m³."
    )
    print(f"[MOVCO] ✅ Analysis complete!\n")
    return QuoteResponse(
        estimate=estimate,
        description=description,
        items=items,
        totalVolumeM3=total_volume_m3,
        totalAreaM2=total_area_m2,
    )


if __name__ == "__main__":
    import uvicorn
    print("\n[MOVCO] 🚀 Starting MOVCO API server...")
    print(f"[MOVCO] 🔑 API Key configured: {bool(ANTHROPIC_API_KEY)}")
    print(f"[MOVCO] 📦 Model loaded: {model is not None}\n")
    uvicorn.run("api:app", host="127.0.0.1", port=8000, reload=False)