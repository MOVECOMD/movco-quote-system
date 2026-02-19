# analyze_furniture.py

import sys
from typing import Dict, Any, List

from ultralytics import YOLO
from PIL import Image

from furniture_size import impute_dimensions_and_volume

# ----------------------------------------------------
# Load your CUSTOM MOVCO YOLO model (trained on Roboflow)
# ----------------------------------------------------
MODEL_PATH = "/Users/zacharykench/runs/detect/train11/weights/best.pt"

print(f"[MOVCO] Loading YOLO model from: {MODEL_PATH}")
model = YOLO(MODEL_PATH)
print("[MOVCO] YOLO model loaded.")


# ----------------------------------------------------
# Label normalisation:
# map what YOLO gives you → internal labels used for sizing
# ----------------------------------------------------

# Raw YOLO labels from your dataset (case-sensitive as they appear in Roboflow):
#   '2 seater sofa', '3 Seater sofa', 'Arm Chair', 'Beds', 'Cabinet',
#   'Coffee table', 'Dinning table', 'Double bed', 'Foot stool',
#   'L shape sofa', 'arm chair', 'bedside table', 'cabinet', 'chair', 'coffee table'

def normalise_raw_label(raw_label: str) -> str:
    """
    Turn Roboflow/YOLO class names into internal labels
    that furniture_size.impute_dimensions_and_volume() understands.
    """
    key = raw_label.strip().lower()

    # Map YOLO labels → internal canonical labels
    mapping = {
        "2 seater sofa": "sofa",
        "3 seater sofa": "sofa",
        "3 seater sofa": "sofa",
        "l shape sofa": "sofa",
        "arm chair": "armchair",
        "arm chair": "armchair",
        "arm chair": "armchair",  # both capitalisations
        "arm chair": "armchair",
        "beds": "bed",
        "double bed": "bed",  # treat as bed for now (you can refine later)
        "coffee table": "coffee table",
        "dinning table": "dining table",
        "bedside table": "bedside table",
        "foot stool": "foot stool",
        "chair": "chair",
        "cabinet": "cabinet",
        "wardrobe": "wardrobe",
        "cabinet": "cabinet",
    }

    return mapping.get(key, key)  # default: just return lowercased key


# Labels that have sizing rules in furniture_size.py
SUPPORTED_LABELS = {
    "sofa",
    "armchair",
    "bed",
    "coffee table",
    "dining table",
    "bedside table",
    "foot stool",
    "chair",
    "cabinet",
    "wardrobe",
    "desk",
}


def analyze_furniture(image_path: str) -> Dict[str, Any]:
    """
    Run YOLO on the image, estimate dimensions + volume in ft³, and sum total.
    """
    print(f"[MOVCO] Analyzing image: {image_path}")

    # Load image to get its dimensions
    img = Image.open(image_path)
    image_width_px, image_height_px = img.size
    print(f"[MOVCO] Image size: {image_width_px} x {image_height_px}")

    # Run YOLO inference (slightly lower conf to catch more items)
    results = model(image_path, conf=0.10)

    items: List[Dict[str, Any]] = []
    total_ft3 = 0.0

    for result in results:
        boxes = result.boxes
        names = result.names  # class id -> label string

        print(f"[MOVCO] Raw detections: {len(boxes)}")

        for i, box in enumerate(boxes, start=1):
            cls_id = int(box.cls[0].item())
            raw_label = names[cls_id]

            internal_label = normalise_raw_label(raw_label)
            confidence = float(box.conf[0].item())

            print(
                f"[MOVCO] Det {i}: raw_label='{raw_label}' "
                f"(key='{raw_label.strip().lower()}'), "
                f"internal='{internal_label}', conf={confidence:.3f}"
            )

            # bounding box in pixels (x1, y1, x2, y2)
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            width_px = x2 - x1
            height_px = y2 - y1

            # Only try to size labels we know about
            if internal_label not in SUPPORTED_LABELS:
                print(
                    f"[MOVCO]   -> Internal label '{internal_label}' "
                    f"has no sizing support yet, skipping."
                )
                continue

            # Estimate real-world dimensions & volume
            imputed = impute_dimensions_and_volume(
                label=internal_label,
                bbox_width_px=width_px,
                image_width_px=image_width_px,
            )

            if imputed is None:
                print(
                    f"[MOVCO]   -> impute_dimensions_and_volume() returned None "
                    f"for '{internal_label}', skipping."
                )
                continue

            # Ensure we keep both the raw label and the internal one
            imputed["label"] = internal_label
            imputed["raw_label"] = raw_label
            imputed["confidence"] = round(confidence, 3)
            imputed["bbox_px"] = {
                "x1": round(x1, 1),
                "y1": round(y1, 1),
                "x2": round(x2, 1),
                "y2": round(y2, 1),
                "width_px": round(width_px, 1),
                "height_px": round(height_px, 1),
            }

            items.append(imputed)
            total_ft3 += imputed["volume_ft3"]

    total_ft3 = round(total_ft3, 2)

    return {
        "image_width_px": image_width_px,
        "image_height_px": image_height_px,
        "items": items,
        "total_volume_ft3": total_ft3,
    }


def main():
    if len(sys.argv) < 2:
        print("Usage: python analyze_furniture.py path/to/photo.jpg")
        sys.exit(1)

    image_path = sys.argv[1]

    try:
        result = analyze_furniture(image_path)
    except Exception as e:
        print(f"Error while analyzing furniture: {e}")
        sys.exit(1)

    print("\nDetected furniture items (after filtering + sizing):")
    if not result["items"]:
        print("  (No furniture recognised with current settings.)")
    else:
        for i, item in enumerate(result["items"], start=1):
            print(f"Item {i}:")
            print(f"  Raw label:   {item['raw_label']}")
            print(f"  Label:       {item['label']}")
            print(f"  Size class:  {item['size_class']}")
            print(f"  Confidence:  {item['confidence']}")
            print(f"  Width (cm):  {item['width_cm']}")
            print(f"  Depth (cm):  {item['depth_cm']}")
            print(f"  Height (cm): {item['height_cm']}")
            print(f"  Volume (ft³): {item['volume_ft3']}")
            print()

    print(f"Total estimated furniture volume: {result['total_volume_ft3']} ft³")


if __name__ == "__main__":
    main()



