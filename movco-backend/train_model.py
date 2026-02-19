import os
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error
import joblib

# Absolute path so there is zero confusion
csv_path = "/Users/zacharykench/jobs.csv"
model_path = "/Users/zacharykench/movco_model.joblib"

print("=== MOVCO training script starting ===")
print("Current working directory:", os.getcwd())
print("Looking for CSV at:", csv_path)
print("Does CSV exist?", os.path.exists(csv_path))

if not os.path.exists(csv_path):
    raise FileNotFoundError(f"Could not find CSV file at {csv_path}")

# 1. Load data
df = pd.read_csv(csv_path)
print(f"Loaded {len(df)} rows from CSV")

# 2. Define features and target
FEATURES = ["distance_km", "rooms", "stairs", "packing", "day_of_week", "month"]
TARGET = "price"

print("Columns in dataframe:", list(df.columns))
print("Using features:", FEATURES)
print("Target:", TARGET)

X = df[FEATURES]
y = df[TARGET]

# 3. Train/test split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
print(f"Training on {len(X_train)} rows, testing on {len(X_test)} rows")

# 4. Train model
model = GradientBoostingRegressor(random_state=42)
model.fit(X_train, y_train)
print("Model training complete")

# 5. Evaluate
preds = model.predict(X_test)
mae = mean_absolute_error(y_test, preds)
print(f"Mean Absolute Error: £{mae:.2f}")

# 6. Save model
joblib.dump(model, model_path)
print(f"Model saved to: {model_path}")
print("=== MOVCO training script finished ===")
