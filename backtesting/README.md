# Backtesting ML Pipeline

XGBoost-based analysis of SignalScope's historical ticker data to discover optimal scoring/filtering thresholds.

## Setup

```bash
cd backtesting
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # then fill in DATABASE_URL
```

## Usage

Run scripts in order:

```bash
# 1. Extract data from production DB → local parquet
python extract.py

# 2. Train XGBoost models + generate SHAP analysis
python train.py

# 3. Sweep scoring/filtering thresholds
python sweep.py
```

## Output

All artifacts are saved to `output/` (gitignored):

| File | Description |
|------|-------------|
| `dataset.parquet` | Raw extracted data |
| `model.json` | Trained XGBoost model |
| `feature_importance.png` | Top 20 features by gain |
| `shap_summary.png` | SHAP feature impact summary |
| `shap_dep_*.png` | SHAP dependence plots for top features |
| `sweep_results.csv` | All parameter sweep results |

## What It Answers

- Which features most predict gains vs losses?
- What P&D flag count threshold maximizes returns? (currently 3)
- What AI score cutoff best separates winners from losers?
- Which signal stages produce the best returns?
- Which individual P&D flags are most predictive of actual dumps?
- What combined AI score + P&D threshold is optimal?
