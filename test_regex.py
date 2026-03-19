import re

YEAR_PATTERNS = [
    ("IV Yr",  [r'IV',   r'\bFOURTH\b',  r'\b4TH\b']),
    ("III Yr", [r'III',  r'\bTHIRD\b',   r'\b3RD\b']),
    ("II Yr",  [r'II[^A-Z]',   r'\bSECOND\b',  r'\b2ND\b']),
    ("I Yr",   [r'[^A-Z]I[^A-Z]',    r'\bFIRST\b',   r'\b1ST\b']),
]

def year_of_col(col_str_upper):
    print(f"Testing: '{col_str_upper}'")
    for y_key, patterns in YEAR_PATTERNS:
        for pat in patterns:
            if re.search(pat, col_str_upper):
                print(f"  Matched {y_key} using {pat}")
                return y_key
    print(f"  NO MATCH")
    return None

y1 = year_of_col("ENROLLMENT NO. (I YEAR)")
y2 = year_of_col("ENROLLMENT NO. (II YEAR)")
y3 = year_of_col("ENROLLMENT NO. (III YEAR)")
y4 = year_of_col("ENROLLMENT NO. (IV YEAR)")
print(y1, y2, y3, y4)
