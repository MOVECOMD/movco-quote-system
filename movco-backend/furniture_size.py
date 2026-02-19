# furniture_size.py
from typing import Optional, Dict, Any


def cm_to_ft3(width_cm: float, depth_cm: float, height_cm: float) -> float:
    """
    Convert cm dimensions to cubic feet, rounded to 2 decimal places.
    """
    m3 = (width_cm / 100.0) * (depth_cm / 100.0) * (height_cm / 100.0)
    ft3 = m3 * 35.3147
    return round(ft3, 2)


def impute_dimensions_and_volume(
    label: str,
    bbox_width_px: float,
    image_width_px: float,
) -> Optional[Dict[str, Any]]:
    """
    Given a normalised furniture label + how wide the box is compared to the image,
    return approximate dimensions and volume in ft³.

    label: normalised internal label from analyze_furniture.py
           (e.g. "sofa", "coffee table", "bedside table", "chair", ...)
    """
    if image_width_px <= 0:
        rel_w = 0.0
    else:
        rel_w = bbox_width_px / image_width_px

    label = label.strip().lower()

    # -------------------------
    # Sofas
    # -------------------------
    if label == "sofa":
        # Use relative width to decide 2-seater vs 3-seater
        if rel_w > 0.45:
            size_class = "3-seater"
            width_cm, depth_cm, height_cm = 200, 95, 90
        elif rel_w > 0.3:
            size_class = "2-seater"
            width_cm, depth_cm, height_cm = 170, 90, 90
        else:
            size_class = "small"
            width_cm, depth_cm, height_cm = 140, 80, 85

    # -------------------------
    # Armchair
    # -------------------------
    elif label == "armchair":
        size_class = "standard"
        width_cm, depth_cm, height_cm = 90, 90, 90

    # -------------------------
    # Beds (generic)
    # -------------------------
    elif label == "bed":
        # Very rough – you can refine later (single / double / king)
        if rel_w > 0.5:
            size_class = "king"
            width_cm, depth_cm, height_cm = 150, 200, 60
        elif rel_w > 0.4:
            size_class = "double"
            width_cm, depth_cm, height_cm = 135, 190, 60
        else:
            size_class = "single"
            width_cm, depth_cm, height_cm = 90, 190, 60

    # -------------------------
    # Coffee table
    # -------------------------
    elif label == "coffee table":
        size_class = "standard"
        # Typical UK living room coffee table dimensions
        width_cm, depth_cm, height_cm = 120, 60, 45

    # -------------------------
    # Dining table
    # -------------------------
    elif label == "dining table":
        # Use width to decide 4-seat vs 6-seat
        if rel_w > 0.45:
            size_class = "6-seat"
            width_cm, depth_cm, height_cm = 160, 90, 75
        else:
            size_class = "4-seat"
            width_cm, depth_cm, height_cm = 120, 80, 75

    # -------------------------
    # Bedside table
    # -------------------------
    elif label == "bedside table":
        size_class = "standard"
        width_cm, depth_cm, height_cm = 45, 45, 60

    # -------------------------
    # Foot stool
    # -------------------------
    elif label == "foot stool":
        size_class = "standard"
        width_cm, depth_cm, height_cm = 45, 45, 45

    # -------------------------
    # Chair (dining / side chair)
    # -------------------------
    elif label == "chair":
        size_class = "standard"
        width_cm, depth_cm, height_cm = 45, 45, 90

    # -------------------------
    # Cabinet
    # -------------------------
    elif label == "cabinet":
        size_class = "medium"
        width_cm, depth_cm, height_cm = 80, 40, 180

    # -------------------------
    # Wardrobe
    # -------------------------
    elif label == "wardrobe":
        size_class = "2-door"
        width_cm, depth_cm, height_cm = 100, 60, 200

    # -------------------------
    # Desk
    # -------------------------
    elif label == "desk":
        size_class = "standard"
        width_cm, depth_cm, height_cm = 140, 70, 75

    # -------------------------
    # Anything else – we don't know yet
    # -------------------------
    else:
        return None

    volume_ft3 = cm_to_ft3(width_cm, depth_cm, height_cm)

    return {
        "size_class": size_class,
        "width_cm": width_cm,
        "depth_cm": depth_cm,
        "height_cm": height_cm,
        "volume_ft3": volume_ft3,
    }

