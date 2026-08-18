import re
import numpy as np
import pandas as pd

def normalize_column_name(raw_name: str) -> str:
    name = str(raw_name).strip().lower()
    name = re.sub(r"[^a-z0-9]+", "_", name)
    return name.strip("_")

COLUMN_ALIASES = {
    "time": "timestamp",
    "date": "timestamp",
    "amount": "amount",
    "amount_usd": "amount",
    "device": "device_type",
    "device_type": "device_type",
    "merchant_category": "merchant_category",
    "merchant": "merchant_category",
    "merchant_type": "merchant_category",
    "vendor_category": "merchant_category",
    "foreign_transaction": "is_foreign_transaction",
    "foreign_txn": "is_foreign_transaction",
    "is_foreign": "is_foreign_transaction",
    "hour_of_day": "hour_of_day",
    "transactions_last_24h": "transaction_count_24h",
    "txn_count_24h": "transaction_count_24h",
    "transactions_24h": "transaction_count_24h",
}

def engineer_features_from_transcript(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [normalize_column_name(c) for c in df.columns]
    df = df.rename(columns={k: v for k, v in COLUMN_ALIASES.items() if k in df.columns})

    for col in ["amount", "transaction_count_24h", "transaction_count_7d", "transaction_count_30d",
                "avg_transaction_amount", "amount_zscore", "amount_percentile",
                "amount_rolling_mean_7d", "amount_rolling_std_7d",
                "amount_x_transaction_count", "amount_x_is_foreign",
                "transaction_count_x_is_foreign", "avg_amount_ratio", "transaction_velocity",
                "time_since_last_transaction", "is_foreign_transaction", "hour_of_day", "day_of_week",
                "month", "is_weekend", "is_month_end", "is_month_start", "is_rush_hour", "is_off_hours"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    if "timestamp" not in df.columns and "time" not in df.columns:
        raise ValueError("File must contain a timestamp-like column")

    if "amount" not in df.columns:
        df["amount"] = 0.0

    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values("timestamp").reset_index(drop=True)

    if "is_foreign_transaction" in df.columns:
        df["is_foreign_transaction"] = (
            df["is_foreign_transaction"].astype(str).str.strip().str.lower()
            .map({"yes": 1, "no": 0, "1": 1, "0": 0, "true": 1, "false": 0})
            .fillna(0)
            .astype(int)
        )
    else:
        df["is_foreign_transaction"] = 0

    df["hour_of_day"] = df["timestamp"].dt.hour
    df["day_of_week"] = df["timestamp"].dt.dayofweek
    df["month"] = df["timestamp"].dt.month
    df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)
    df["is_month_end"] = df["timestamp"].dt.is_month_end.astype(int)
    df["is_month_start"] = df["timestamp"].dt.is_month_start.astype(int)
    df["is_rush_hour"] = df["hour_of_day"].isin([7, 8, 9, 17, 18, 19]).astype(int)
    df["is_off_hours"] = df["hour_of_day"].isin([0, 1, 2, 3, 4, 5]).astype(int)

    df["time_since_last_transaction"] = (
        df["timestamp"].diff().dt.total_seconds().div(3600).fillna(0)
    )

    df = df.set_index("timestamp")
    df["transaction_count_7d"] = df["amount"].rolling("7D", closed="left").count().fillna(0)
    df["transaction_count_30d"] = df["amount"].rolling("30D", closed="left").count().fillna(0)
    df["amount_rolling_mean_7d"] = df["amount"].rolling("7D", closed="left").mean()
    df["amount_rolling_std_7d"] = df["amount"].rolling("7D", closed="left").std()
    df = df.reset_index()

    df["avg_transaction_amount"] = df["amount"].expanding().mean().shift(1)
    df["amount_rolling_mean_7d"] = df["amount_rolling_mean_7d"].fillna(df["amount"])
    df["amount_rolling_std_7d"] = df["amount_rolling_std_7d"].fillna(0)
    df["avg_transaction_amount"] = df["avg_transaction_amount"].fillna(df["amount"])

    df["amount_zscore"] = (
        (df["amount"] - df["amount_rolling_mean_7d"])
        / df["amount_rolling_std_7d"].replace(0, np.nan)
    ).fillna(0)

    df["amount_percentile"] = df["amount"].rank(pct=True)
    df["transaction_count_24h"] = df.get("transaction_count_24h", pd.Series(1, index=df.index)).fillna(1)
    df["amount_x_transaction_count"] = df["amount"] * df["transaction_count_24h"]
    df["amount_x_is_foreign"] = df["amount"] * df["is_foreign_transaction"]
    df["transaction_count_x_is_foreign"] = df["transaction_count_24h"] * df["is_foreign_transaction"]
    df["avg_amount_ratio"] = (df["amount"] / df["avg_transaction_amount"].replace(0, np.nan)).fillna(1)
    df["transaction_velocity"] = (
        df["transaction_count_24h"] / df["time_since_last_transaction"].replace(0, np.nan)
    ).fillna(0)

    required_numeric = [
            "amount",
            "transaction_count_24h",
            "avg_transaction_amount",
            "is_foreign_transaction",
            "is_weekend",
            "hour_of_day",
            "day_of_week",
            "month",
            "is_month_end",
            "is_month_start",
            "time_since_last_transaction",
            "transaction_count_7d",
            "transaction_count_30d",
            "amount_zscore",
            "amount_percentile",
            "amount_rolling_mean_7d",
            "amount_rolling_std_7d",
            "amount_x_transaction_count",
            "amount_x_is_foreign",
            "transaction_count_x_is_foreign",
            "is_rush_hour",
            "is_off_hours",
            "avg_amount_ratio",
            "transaction_velocity",
        ]

    for col in required_numeric:
        if col not in df.columns:
            df[col] = 0.0
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)

    if "merchant_category" not in df.columns:
        df["merchant_category"] = "Other"
    else:
        df["merchant_category"] = df["merchant_category"].fillna("Other").astype(str)

    if "device_type" not in df.columns:
        df["device_type"] = "Mobile"
    else:
        df["device_type"] = df["device_type"].fillna("Mobile").astype(str)

    return df