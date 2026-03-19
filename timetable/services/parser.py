import pandas as pd
from django.core.exceptions import ValidationError
from timetable.models import Subject, Department, Faculty

class SchemeParser:
    def __init__(self, excel_file, department):
        self.excel_file = excel_file
        self.department = department

    def parse_and_save(self):
        try:
            # Read all sheets into a dictionary of DataFrames
            sheets_dict = pd.read_excel(self.excel_file, sheet_name=None)
            
            created_count = 0
            updated_count = 0

            for sheet_name, df in sheets_dict.items():
                if df.empty:
                    continue
                    
                # Clean column names
                df.columns = df.columns.astype(str).str.strip().str.lower()
                
                # Try to extract semester from sheet name (e.g., "Sem 3", "Semester 3", "3")
                import re
                sem_match = re.search(r'\d+', str(sheet_name))
                sheet_sem_val = int(sem_match.group()) if sem_match else 1
                
                try:
                    code_col = [c for c in df.columns if 'code' in c][0]
                    name_col = [c for c in df.columns if 'name' in c][0]
                    type_col = [c for c in df.columns if 'type' in c][0]
                    
                    # More robust matching for L, T, P cols exactly, or starting with them
                    l_col = next((c for c in df.columns if c == 'l' or 'lecture' in c), None)
                    t_col = next((c for c in df.columns if c == 't' or 'tutorial' in c), None)
                    p_col = next((c for c in df.columns if c == 'p' or 'practical' in c), None)
                except IndexError:
                    # Skip sheets that don't match our strict format 
                    continue
                
                # Find optional semester column if it overrides the sheet name
                sem_col = next((c for c in df.columns if 'sem' in c), None)

                for _, row in df.iterrows():
                    code = str(row[code_col]).strip()
                    if pd.isna(code) or code == 'nan' or not code:
                        continue
                        
                    name = str(row[name_col]).strip()
                    
                    # Helper to parse L, T, P replacing '-' with 0
                    def parse_hr(val):
                        if pd.isna(val): return 0
                        s = str(val).strip()
                        if s == '-' or not s: return 0
                        try: return int(float(s))
                        except ValueError: return 0
                    
                    l_val = parse_hr(row[l_col]) if l_col else 0
                    t_val = parse_hr(row[t_col]) if t_col else 0
                    p_val = parse_hr(row[p_col]) if p_col else 0
                    
                    if sem_col and not pd.isna(row[sem_col]):
                        sem = parse_hr(row[sem_col])
                    else:
                        sem = sheet_sem_val
                    
                    # Always create the base subject even if L/T is 0
                    obj, created = Subject.objects.update_or_create(
                        code=code,
                        department=self.department,
                        defaults={
                            'name': name,
                            'semester': sem,
                            'lecture_hours_per_week': l_val,
                            'tutorial_hours_per_week': t_val,
                            'lab_hours_per_week': 0,
                            'is_lab_subject': False,
                            'is_elective': False
                        }
                    )
                    if created: created_count += 1
                    else: updated_count += 1
                        
                    # If it has practical hours, create the specific Lab subject entry
                    if p_val > 0:
                        lab_code = f"{code}(P)" if not code.endswith('(P)') else code
                        obj, created = Subject.objects.update_or_create(
                            code=lab_code,
                            department=self.department,
                            defaults={
                                'name': f"{name} Lab" if not name.endswith('Lab') else name,
                                'semester': sem,
                                'lecture_hours_per_week': 0,
                                'tutorial_hours_per_week': 0,
                                'lab_hours_per_week': p_val,
                                'is_lab_subject': True,
                                'is_elective': False
                            }
                        )
                        if created: created_count += 1
                        else: updated_count += 1
                        
            return True, f"Successfully processed Scheme. Created {created_count} subjects. Updated {updated_count} existing subjects."
            
        except Exception as e:
            return False, f"Failed parsing: {str(e)}"

class FacultyParser:
    def __init__(self, excel_file, department):
        self.excel_file = excel_file
        self.department = department

    def parse_and_save(self):
        try:
            df = pd.read_excel(self.excel_file)
            if df.empty:
                return False, "Uploaded file is empty."
                
            df.columns = df.columns.astype(str).str.strip().str.lower()
            
            try:
                name_col = next(c for c in df.columns if 'name' in c)
                code_col = next(c for c in df.columns if 'code' in c)
                desig_col = next(c for c in df.columns if 'desig' in c)
                day_col = next(c for c in df.columns if 'day' in c)
                week_col = next(c for c in df.columns if 'week' in c)
            except StopIteration:
                return False, "Missing required columns in Excel template."
                
            created_count = 0
            updated_count = 0
            
            for _, row in df.iterrows():
                name = str(row[name_col]).strip()
                code = str(row[code_col]).strip().upper()
                
                if pd.isna(code) or code == 'NAN' or not code:
                    continue
                    
                desig = str(row[desig_col]).strip()
                
                try: day_max = int(float(row[day_col]))
                except: day_max = 4
                
                try: week_max = int(float(row[week_col]))
                except: week_max = 20
                
                obj, created = Faculty.objects.update_or_create(
                    short_code=code,
                    department=self.department,
                    defaults={
                        'name': name,
                        'designation': desig,
                        'max_lectures_per_day': day_max,
                        'max_lectures_per_week': week_max,
                        'is_active': True
                    }
                )
                if created: created_count += 1
                else: updated_count += 1
                
            return True, f"Successfully processed Faculty. Added {created_count}, Updated {updated_count}."
            
        except Exception as e:
            return False, f"Failed parsing Faculty: {str(e)}"
