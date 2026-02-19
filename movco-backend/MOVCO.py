import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error
import joblib

# Load your job history data
df = pd.read_csv("jobs.csv")

# Define features and target
FEATURES = ["distance_km", "rooms", "stairs", "packing", "day_of_week", "month"]
TARGET = "price"

X = df[FEATURES]
y = df[TARGET]

# Train/test split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)

# Train model
model = GradientBoostingRegressor()
model.fit(X_train, y_train)

# Evaluate
preds = model.predict(X_test)
mae = mean_absolute_error(y_test, preds)
print(f"Mean Absolute Error: £{mae:.2f}")

# Save model
joblib.dump(model, "movco_model.joblib")
print("Model saved!")
