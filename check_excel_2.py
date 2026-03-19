import pandas as pd
import json

df = pd.read_excel('student_data.xlsx', header=None)
d = df.head(5).to_dict(orient='records')

# convert nan to None for valid json
import math
for row in d:
    for k, v in row.items():
        if isinstance(v, float) and math.isnan(v):
            row[k] = None

with open('excel_dbg.json', 'w') as f:
    json.dump(d, f, indent=2)
