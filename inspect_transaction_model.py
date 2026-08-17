import os
from pathlib import Path
import joblib

root = Path('c:/Users/seahy/Downloads/AAP_final/ScamSense')
model_dir = root / 'services' / 'transaction' / 'model'
print('DIR', [p.name for p in model_dir.iterdir()])
for name in ['feature_config.joblib', 'onehot_encoder.joblib', 'fraud_xgb_model.joblib']:
    path = model_dir / name
    obj = joblib.load(path)
    print('---', name, type(obj))
    if isinstance(obj, dict):
        print('dict_keys', list(obj.keys())[:20])
    if hasattr(obj, 'get_params'):
        params = obj.get_params()
        print('params_keys', list(params.keys())[:20])
    for attr in ['feature_names_in_', 'classes_', 'n_features_in_']:
        if hasattr(obj, attr):
            val = getattr(obj, attr)
            print(attr, val)
    if hasattr(obj, 'get_feature_names_out'):
        try:
            print('feature_names_out', list(obj.get_feature_names_out())[:10])
        except Exception as e:
            print('feature_names_out_error', type(e).__name__, e)
