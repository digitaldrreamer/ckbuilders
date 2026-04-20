import os, json, pandas as pd, numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import precision_score, recall_score, f1_score, roc_auc_score
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer

os.makedirs('output', exist_ok=True)

# Build a small, explicit falsification experiment using public benchmark data if available.
# Try to load Real-CATS directly from GitHub raw TSV files.
base = 'https://raw.githubusercontent.com/sjdseu/Real-CATS/master/'
files = {
    'criminal': base + 'CE.tsv',
    'benign': base + 'BE.tsv',
}

frames = []
for label, url in files.items():
    try:
        df = pd.read_csv(url, sep='\t')
        df['target'] = 1 if label == 'criminal' else 0
        frames.append(df)
    except Exception as e:
        pass

if not frames:
    # Fallback: write failure marker
    with open('output/two_tier_test_results.csv','w') as f:
        f.write('status,message\nfailed,Could not load public dataset from GitHub raw\n')
    with open('output/two_tier_test_summary.md','w') as f:
        f.write('# Two-tier test\n\nDataset could not be loaded from the referenced public source.')
else:
    df = pd.concat(frames, ignore_index=True)
    # Keep numeric feature columns only
    num_cols = [c for c in df.columns if c not in ['target'] and pd.api.types.is_numeric_dtype(df[c])]
    X = df[num_cols].copy()
    y = df['target'].astype(int)

    # Train/test split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42, stratify=y)

    # Simulate blacklist-only model:
    # Assume blacklist catches only addresses explicitly previously labeled/known in training set.
    # For out-of-sample test, blacklist-only predicts all 0 (cannot generalize to unseen addresses).
    bl_pred = np.zeros(len(y_test), dtype=int)

    # Risk-only model: learned classifier scores all addresses; threshold 0.5
    risk_model = Pipeline([
        ('imp', SimpleImputer(strategy='median')),
        ('clf', LogisticRegression(max_iter=2000, class_weight='balanced'))
    ])
    risk_model.fit(X_train, y_train)
    risk_scores = risk_model.predict_proba(X_test)[:,1]
    risk_pred = (risk_scores >= 0.5).astype(int)

    # Two-tier model:
    # tier 1 hard-block if very high score >= 0.9; tier 2 flag if 0.5-0.9.
    # For direct comparison as a binary detector of maliciousness, count both block and flag as positive detection.
    two_tier_pred = (risk_scores >= 0.5).astype(int)
    hard_block_rate = float((risk_scores >= 0.9).mean())
    soft_flag_rate = float(((risk_scores >= 0.5) & (risk_scores < 0.9)).mean())

    rows = []
    for name, pred in [('blacklist_only', bl_pred), ('risk_only', risk_pred), ('two_tier_detect', two_tier_pred)]:
        rows.append({
            'model': name,
            'precision': precision_score(y_test, pred, zero_division=0),
            'recall': recall_score(y_test, pred, zero_division=0),
            'f1': f1_score(y_test, pred, zero_division=0),
            'positive_rate': float(pred.mean())
        })
    results = pd.DataFrame(rows)
    results['roc_auc_risk_model'] = [roc_auc_score(y_test, risk_scores)]*len(results)
    results['hard_block_rate_two_tier'] = [hard_block_rate]*len(results)
    results['soft_flag_rate_two_tier'] = [soft_flag_rate]*len(results)
    results.to_csv('output/two_tier_test_results.csv', index=False)

    summary = {
        'rows': int(len(df)),
        'feature_count': int(len(num_cols)),
        'class_balance_malicious': float(y.mean()),
        'roc_auc_risk_model': float(roc_auc_score(y_test, risk_scores)),
        'hard_block_rate_two_tier': hard_block_rate,
        'soft_flag_rate_two_tier': soft_flag_rate,
    }
    with open('output/two_tier_test_summary.json','w') as f:
        json.dump(summary, f, indent=2)

    with open('output/two_tier_test_summary.md','w') as f:
        f.write('# Falsification test for blacklist-only vs risk-only vs two-tier\n\n')
        f.write('This experiment uses the public Real-CATS Ethereum address dataset referenced by its maintainers as containing criminal and benign labeled addresses.\\n')
        f.write('Blacklist-only is modeled as a pure known-bad list with no ability to generalize to unseen addresses in the test split.\\n')
        f.write('Risk-only is a logistic model on public numeric features. Two-tier uses the same risk model, with >=0.9 as hard block and 0.5-0.9 as soft flag.\\n\n')
        f.write('## Summary\n')
        for k,v in summary.items():
            f.write(f'- {k}: {v}\n')
        f.write('\n## Interpretation\n')
        f.write('- If blacklist-only recall is near zero on unseen data, that supports the claim that blacklist-only is too reactive.\n')
        f.write('- If risk-only/two-tier recover meaningful recall, that supports the value of a predictive signal layer.\n')
        f.write('- This does not prove that two-tier is optimal; it only tests whether a blacklist-only baseline is too weak versus a predictive layer.\n')
