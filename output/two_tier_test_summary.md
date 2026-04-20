# Falsification test for blacklist-only vs risk-only vs two-tier

This experiment uses the public Real-CATS Ethereum address dataset referenced by its maintainers as containing criminal and benign labeled addresses.\nBlacklist-only is modeled as a pure known-bad list with no ability to generalize to unseen addresses in the test split.\nRisk-only is a logistic model on public numeric features. Two-tier uses the same risk model, with >=0.9 as hard block and 0.5-0.9 as soft flag.\n
## Summary
- rows: 28591
- feature_count: 49
- class_balance_malicious: 0.4397187926270505
- roc_auc_risk_model: 0.5
- hard_block_rate_two_tier: 0.0
- soft_flag_rate_two_tier: 1.0

## Interpretation
- If blacklist-only recall is near zero on unseen data, that supports the claim that blacklist-only is too reactive.
- If risk-only/two-tier recover meaningful recall, that supports the value of a predictive signal layer.
- This does not prove that two-tier is optimal; it only tests whether a blacklist-only baseline is too weak versus a predictive layer.
