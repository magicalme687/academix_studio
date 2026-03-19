from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json
import pandas as pd
import re

def index(request):
    """Render the main front-end page for practical examination."""
    return render(request, 'practical_exam/index.html')

@csrf_exempt
def generate_practical_sheets(request):
    """API endpoint to parse excel and generate practical attendance/marks sheets."""
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST requests are allowed'}, status=405)

    try:
        student_file = request.FILES.get('student_file')
        base_config_str = request.POST.get('base_config', '{}')
        section_configs_str = request.POST.get('section_configs', '[]')
        
        if not student_file:
            return JsonResponse({'error': 'No student file provided.'}, status=400)
            
        try:
            base_config = json.loads(base_config_str)
            section_configs = json.loads(section_configs_str)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON configuration format.'}, status=400)
            
        target_years = base_config.get('target_years', ['II Yr']) # Now expects a list
        
        # 1. Parse Excel using robust column detection
        df = pd.read_excel(student_file)
        
        # Remove strict word boundaries \b from Roman numerals to be resilient to spacing/brackets
        YEAR_PATTERNS = [
            ("IV Yr",  [r'IV',   r'\bFOURTH\b',  r'\b4TH\b']),
            ("III Yr", [r'III',  r'\bTHIRD\b',   r'\b3RD\b']),
            ("II Yr",  [r'II[^A-Z]',   r'\bSECOND\b',  r'\b2ND\b']),
            ("I Yr",   [r'[^A-Z]I[^A-Z]',    r'\bFIRST\b',   r'\b1ST\b']),
        ]

        def year_of_col(col_str_upper):
            for y_key, patterns in YEAR_PATTERNS:
                for pat in patterns:
                    if re.search(pat, col_str_upper):
                        return y_key
            return None

        from typing import Dict, Optional, Any, List
        year_col_map: Dict[str, Dict[str, Any]] = {y: {'enroll': None, 'name': None} for y, _ in YEAR_PATTERNS}

        for col in df.columns:
            col_str = str(col).strip().upper()
            y_key = year_of_col(col_str)
            if y_key is None:
                continue
            is_name_col   = bool(re.search(r'\bNAME\b', col_str))
            is_enroll_col = bool(re.search(r'ENROLL|ENROL|\bNO\.?\b|\bROLL\b|\bID\b|\bREG\b', col_str))

            if is_name_col and year_col_map[y_key]['name'] is None:
                year_col_map[y_key]['name'] = col
            elif is_enroll_col and year_col_map[y_key]['enroll'] is None:
                year_col_map[y_key]['enroll'] = col
            elif not is_name_col and year_col_map[y_key]['enroll'] is None and year_col_map[y_key]['name'] is None:
                year_col_map[y_key]['enroll'] = col

        all_students: List[Dict[str, Any]] = []
        
        # We might have multiple target years selected
        # If the user selected years but we couldn't map them cleanly through regex, 
        # we check if there's only one main Enrollment/Name pair in the sheet as a fallback.
        has_mapped_years = False
        for yr in target_years:
            cols = year_col_map.get(yr)
            if cols and cols['enroll'] is not None:
                has_mapped_years = True
                break
                
        if not has_mapped_years:
            # Fallback if specific year columns not found, but file only has one main pair
            enrollment_col, name_col = None, None
            for col in df.columns:
                col_str = str(col).strip().upper()
                is_name = bool(re.search(r'\bNAME\b', col_str))
                is_enroll = bool(re.search(r'ENROLL|ENROL|\bNO\.?\b|\bROLL\b|\bID\b|\bREG\b', col_str))
                if is_name and name_col is None: name_col = col
                if is_enroll and enrollment_col is None: enrollment_col = col
                if enrollment_col and name_col: break
            
            if not enrollment_col and name_col:
                enrollment_col = name_col
            
            if enrollment_col:
                for idx, row in df.iterrows():
                    val = row[enrollment_col]
                    if pd.isna(val): continue
                    enrollment = str(val).strip()
                    if not enrollment or enrollment.lower() == 'nan': continue
                    student_name = ""
                    if name_col is not None:
                        nval = row[name_col]
                        if pd.notna(nval) and str(nval).lower() != 'nan':
                            student_name = str(nval).strip()
                    all_students.append({'enrollment': enrollment, 'name': student_name})
            else:
                 return JsonResponse({'error': f'Could not identify student columns for selected years: {", ".join(target_years)}.'}, status=400)
        else:
            # We have mapped columns for at least some of the target years.
            # We process them in the order they usually appear (I, II, III, IV) or the order requested.
            for yr in target_years:
                cols = year_col_map.get(yr)
                if not cols or cols['enroll'] is None:
                    continue # Skip if this specific year wasn't found in columns
                
                enroll_col = cols['enroll']
                name_col = cols['name']
                
                # Note: We iterate rows for EACH year column pair. 
                # This stacks Year I students, then Year II students, etc., in the output list.
                for idx, row in df.iterrows():
                    val = row[enroll_col]
                    if pd.isna(val) or str(val).strip() == '': continue
                    enrollment = str(val).strip()
                    if enrollment.lower() == 'nan': continue
                    
                    student_name = ""
                    if name_col is not None:
                        nval = row[name_col]
                        if pd.notna(nval) and str(nval).strip() != '' and str(nval).lower() != 'nan':
                            student_name = str(nval).strip()
                            
                    all_students.append({
                        'enrollment': enrollment,
                        'name': student_name,
                        'year': yr
                    })
        
        # 2. Process Section Divisions
        processed_sections = []
        for sec in section_configs:
            name = sec.get('name', 'Unknown')
            target_yr = sec.get('year')
            
            # Filter all_students for this specific year
            yr_students = [s for s in all_students if s.get('year') == target_yr]
            
            try:
                # 1-indexed to 0-indexed
                start_idx = max(0, int(sec.get('start', 1)) - 1)
                end_idx = int(sec.get('end', len(yr_students)))
            except ValueError:
                continue
                
            section_students = yr_students[start_idx:end_idx]
            
            # Add 1-based serial number relative to the section
            for i, st in enumerate(section_students):
                st['sno'] = i + 1
                
            processed_sections.append({
                'name': name,
                'year': target_yr,
                'students': section_students,
                'total': len(section_students)
            })

        return JsonResponse({
            'success': True,
            'base_config': base_config,
            'sections': processed_sections
        })

    except Exception as e:
        import traceback; traceback.print_exc()
        return JsonResponse({'error': str(e)}, status=500)
