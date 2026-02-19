from ultralytics import YOLO

# --- CONFIG ---
DATA_PATH = "/Users/zacharykench/Downloads/MOVCO furniture detection-4/data.yaml"
BASE_MODEL = "yolov8s.pt"
EPOCHS = 30
IMG_SIZE = 640

print(">>> train_yolo.py starting")
print(f">>> Using data.yaml at: {DATA_PATH}")

print(">>> Loading base YOLO model...")
model = YOLO(BASE_MODEL)
print(">>> Model loaded:", BASE_MODEL)

print(f">>> Starting training for {EPOCHS} epochs at imgsz={IMG_SIZE}...")
results = model.train(
    data=DATA_PATH,
    epochs=EPOCHS,
    imgsz=IMG_SIZE,
)

print(">>> Training finished.")
print(">>> Results object:", results)
print(">>> Check the 'runs/detect' folder for weights (best.pt).")

