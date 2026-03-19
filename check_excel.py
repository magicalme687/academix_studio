import pandas as pd
import json

df = pd.read_excel('student_data.xlsx', header=None)
out = {
    'len': len(df),
    'r0': [str(x) for x in df.iloc[0].tolist()],
    'r1': [str(x) for x in df.iloc[1].tolist()],
}
with open('excel_out.json', 'w') as f:
    json.dump(out, f, indent=2)
