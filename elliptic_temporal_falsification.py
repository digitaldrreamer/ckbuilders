"""
Temporal falsification experiment: Elliptic Bitcoin (Hugging Face).

Train on early time steps, evaluate on later time steps. Compare:
- blacklist_only: positive iff txId was illicit-labeled in the training window (exact id match).
- risk_only: logistic regression on features fit on training window, threshold 0.5.
- two_tier_detect: same scores; binary detection treats score >= 0.5 as positive; reports hard/soft rates.
"""
import json
import os

import numpy as np
import pandas as pd
from huggingface_hub import hf_hub_download
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score, precision_score, recall_score, roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

os.makedirs("output", exist_ok=True)

REPO_ID = "yhoma/elliptic-bitcoin-dataset"
FEATURE_FILE = "elliptic_txs_features.csv"
CLASSES_FILE = "elliptic_txs_classes.csv"
# * Illicit txs in Elliptic are labeled "1", licit "2"; remaining rows are "unknown".
TRAIN_TIMESTEP_MAX = 34


def load_elliptic_frames():
    """Downloads CSVs from Hugging Face Hub (cached locally after first run)."""
    feat_path = hf_hub_download(
        repo_id=REPO_ID, filename=FEATURE_FILE, repo_type="dataset"
    )
    cls_path = hf_hub_download(
        repo_id=REPO_ID, filename=CLASSES_FILE, repo_type="dataset"
    )
    feat = pd.read_csv(feat_path, header=None)
    feat.columns = ["txId", "timestep"] + [
        f"f{i}" for i in range(feat.shape[1] - 2)
    ]
    classes = pd.read_csv(cls_path)
    return feat, classes


def main():
    feat, classes = load_elliptic_frames()
    df = feat.merge(classes, on="txId", how="inner")
    df = df[df["class"].isin(["1", "2"])].copy()
    df["y"] = (df["class"] == "1").astype(int)

    train_mask = df["timestep"] <= TRAIN_TIMESTEP_MAX
    test_mask = df["timestep"] > TRAIN_TIMESTEP_MAX
    train_df = df.loc[train_mask].copy()
    test_df = df.loc[test_mask].copy()

    feature_cols = [c for c in df.columns if c.startswith("f")]
    X_train = train_df[feature_cols].to_numpy(dtype=float)
    y_train = train_df["y"].to_numpy()
    X_test = test_df[feature_cols].to_numpy(dtype=float)
    y_test = test_df["y"].to_numpy()

    training_illicit_ids = set(train_df.loc[train_df["y"] == 1, "txId"].astype(int))
    bl_pred = test_df["txId"].astype(int).isin(training_illicit_ids).astype(int).to_numpy()

    risk_model = Pipeline(
        [
            ("imp", SimpleImputer(strategy="median")),
            ("scale", StandardScaler()),
            (
                "clf",
                LogisticRegression(
                    max_iter=8000,
                    class_weight="balanced",
                    solver="saga",
                    random_state=42,
                ),
            ),
        ]
    )
    risk_model.fit(X_train, y_train)
    risk_scores = risk_model.predict_proba(X_test)[:, 1]
    risk_pred = (risk_scores >= 0.5).astype(int)
    two_tier_pred = (risk_scores >= 0.5).astype(int)
    hard_block_rate = float((risk_scores >= 0.9).mean())
    soft_flag_rate = float(((risk_scores >= 0.5) & (risk_scores < 0.9)).mean())

    roc_auc = float(roc_auc_score(y_test, risk_scores))

    rows = []
    for name, pred in [
        ("blacklist_only", bl_pred),
        ("risk_only", risk_pred),
        ("two_tier_detect", two_tier_pred),
    ]:
        rows.append(
            {
                "model": name,
                "precision": float(precision_score(y_test, pred, zero_division=0)),
                "recall": float(recall_score(y_test, pred, zero_division=0)),
                "f1": float(f1_score(y_test, pred, zero_division=0)),
                "positive_rate": float(pred.mean()),
            }
        )
    results = pd.DataFrame(rows)
    results["roc_auc_risk_model"] = roc_auc
    results["hard_block_rate_two_tier"] = hard_block_rate
    results["soft_flag_rate_two_tier"] = soft_flag_rate
    results.to_csv("output/elliptic_temporal_results.csv", index=False)

    n_test_illicit = int((y_test == 1).sum())
    bl_hits_on_test_illicit = int(((y_test == 1) & (bl_pred == 1)).sum())
    summary = {
        "dataset": REPO_ID,
        "train_timestep_max_inclusive": TRAIN_TIMESTEP_MAX,
        "test_timestep_min_exclusive": TRAIN_TIMESTEP_MAX,
        "n_labeled_total": int(len(df)),
        "n_train_labeled": int(len(train_df)),
        "n_test_labeled": int(len(test_df)),
        "test_base_rate_illicit": float(y_test.mean()) if len(y_test) else None,
        "n_training_illicit_txids": len(training_illicit_ids),
        "test_illicit_count": n_test_illicit,
        "blacklist_hits_on_test_illicit": bl_hits_on_test_illicit,
        "blacklist_recall_on_test_illicit": float(bl_hits_on_test_illicit / n_test_illicit)
        if n_test_illicit
        else None,
        "feature_count": len(feature_cols),
        "roc_auc_risk_model": roc_auc,
        "hard_block_rate_two_tier": hard_block_rate,
        "soft_flag_rate_two_tier": soft_flag_rate,
    }
    with open("output/elliptic_temporal_summary.json", "w") as f:
        json.dump(summary, f, indent=2)

    with open("output/elliptic_temporal_summary.md", "w") as f:
        f.write("# Elliptic temporal falsification (Hugging Face)\n\n")
        f.write(
            "Train on labeled transactions with `timestep <= 34`; "
            "test on labeled transactions with `timestep > 34`. "
            "Blacklist-only flags a test transaction only if its `txId` "
            "was illicit-labeled in the training window.\n\n"
        )
        f.write("## Summary\n\n")
        for k, v in summary.items():
            f.write(f"- {k}: {v}\n")


if __name__ == "__main__":
    main()
