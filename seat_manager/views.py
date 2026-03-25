import json
import math
import re
import pandas as pd
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

SEATS_PER_ROOM = 63 # Default fallback

def index(request):
    """Render the main front-end page."""
    return render(request, 'seat_manager/index.html')

def get_active_pattern(year_dict, cols, base_pattern=None, include_empty=False):
    """Generate the repeating pattern of years for columns."""
    if not base_pattern:
        base_pattern = ["IV Yr", "III Yr", "II Yr", "I Yr"]
    # Only include the year if it was requested (in year_dict) and actually has students left
    if include_empty:
        active_years = [y for y in base_pattern if y in year_dict]
    else:
        active_years = [y for y in base_pattern if y in year_dict and len(year_dict[y]) > 0]
    pattern = []
    
    if not active_years:
        return []
        
    # If only one year is active overall, interleave with empty columns to prevent cheating
    if len(active_years) == 1:
        while len(pattern) < cols:
            pattern.append(active_years[0])
            if len(pattern) < cols:
                pattern.append("") # Insert empty column
        return pattern
        
    while len(pattern) < cols:
        for y in active_years:
            if len(pattern) >= cols:
                break
                
            # If the year we are about to add is identical to the last column added,
            # we MUST insert an empty column first to prevent side-by-side cheating.
            if len(pattern) > 0 and pattern[-1] == y:
                pattern.append("")
                if len(pattern) >= cols:
                    break
                    
            pattern.append(y)
            
    return pattern

@csrf_exempt
def generate_seating(request):
    """API endpoint to parse excel and generate seating arrangements."""
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST requests are allowed'}, status=405)

    try:
        # 1. Extract data from request
        student_file = request.FILES.get('student_file')
        student_data_str = request.POST.get('student_data')
        branch_name = request.POST.get('branch_name', 'Unknown Branch')
        schedule_config_str = request.POST.get('schedule_config', '[]')
        room_config_str = request.POST.get('room_config', '[]')
        is_append_room = request.POST.get('is_append_room') == 'true'

        if not student_file and not student_data_str:
            return JsonResponse({'error': 'No student file or data provided.'}, status=400)
            
        try:
            rooms = json.loads(room_config_str)
            sessions = json.loads(schedule_config_str)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON configuration format.'}, status=400)
            
        if not rooms or not sessions:
            return JsonResponse({'error': 'Missing rooms or exam sessions.'}, status=400)

        year_master = {"I Yr": [], "II Yr": [], "III Yr": [], "IV Yr": []}

        if student_data_str:
            try:
                parsed_data = json.loads(student_data_str)
                for year, students in parsed_data.items():
                    if year in year_master:
                        year_master[year] = students
            except Exception as e:
                return JsonResponse({'error': 'Failed to parse JSON student data.'}, status=400)
        else:
            try:
                df = pd.read_excel(student_file)

                # --- Robust column detection for Format A ---
                # Each year must match uniquely. We use regex anchored at start of
                # the column name so "I" never accidentally matches "II" or "III".
                #
                # Year patterns (roman & numeric aliases, anchored at start):
                #   I Yr  → ^I\b  or  ^1\b  (but NOT ^II or ^III or ^IV)
                #   II Yr → ^II\b or ^2\b  (but NOT ^III)
                #   III Yr→ ^III\b or ^3\b
                #   IV Yr → ^IV\b or ^4\b
                #
                # A column belongs to a year if its normalised name STARTS WITH
                # the year prefix followed by a non-alpha character.

                # Year patterns tested in longest-first order (IV before III before II before I)
                # so that 'II' is never confused with 'I' etc.
                # We use re.search (not match) because year appears anywhere in the column name,
                # e.g. "Enrollment No. (II Year)" — the year is inside parentheses.
                YEAR_PATTERNS = [
                    ("IV Yr",  [r'\bIV\b',   r'\bFOURTH\b',  r'\b4TH\b']),
                    ("III Yr", [r'\bIII\b',  r'\bTHIRD\b',   r'\b3RD\b']),
                    ("II Yr",  [r'\bII\b',   r'\bSECOND\b',  r'\b2ND\b']),
                    ("I Yr",   [r'\bI\b',    r'\bFIRST\b',   r'\b1ST\b']),
                ]

                def year_of_col(col_str_upper):
                    """Return the year key for a normalised column name, or None."""
                    for y_key, patterns in YEAR_PATTERNS:
                        for pat in patterns:
                            if re.search(pat, col_str_upper):
                                return y_key
                    return None

                # Build a map: year -> {enrollment_col, name_col}
                year_col_map = {y: {'enroll': None, 'name': None} for y, _ in YEAR_PATTERNS}

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
                        # Generic year column — treat as enrollment fallback
                        year_col_map[y_key]['enroll'] = col

                print("[Excel Parser] Column map detected:", {k: v for k, v in year_col_map.items()})

                for y_key, cols in year_col_map.items():
                    enrollment_col = cols['enroll']
                    name_col       = cols['name']

                    # If only a name column was found, use it as enrollment
                    if enrollment_col is None and name_col is not None:
                        enrollment_col = name_col
                        name_col = None

                    if enrollment_col is None:
                        continue

                    for idx, row in df.iterrows():
                        val = row[enrollment_col]
                        if pd.isna(val):
                            continue
                        enrollment = str(val).strip()
                        if not enrollment or enrollment.lower() == 'nan':
                            continue

                        student_name = ""
                        if name_col is not None:
                            nval = row[name_col]
                            if pd.notna(nval) and str(nval).lower() != 'nan':
                                student_name = str(nval).strip()

                        year_master[y_key].append({
                            'enrollment': enrollment,
                            'name': student_name
                        })

                print("[Excel Parser] Students loaded per year:", {k: len(v) for k, v in year_master.items()})

            except Exception as e:
                import traceback; traceback.print_exc()
                print(f"Error parsing excel: {e}")

        # 3. Validation per Session
        total_capacity = sum(int(r.get('rows', 0)) * int(r.get('cols', 0)) for r in rooms)
        
        seating_plans = []
        exam_dates_map = {"I Yr": [], "II Yr": [], "III Yr": [], "IV Yr": []}
        master_timetable = []
        room_attendance_data = []

        # 4. Generate Seating Chart for EACH Date and Shift
        for date_block in sessions:
            date = date_block.get('date', 'Unknown Date')
            shifts = date_block.get('shifts', [])

            for shift_block in shifts:
                shift = shift_block.get('time', 'Unknown Shift')
                participants = shift_block.get('years', [])
                
                # Record dates for attendance sheet columns
                for p in participants:
                    yr = p['year']
                    subj = p['subject']
                    label = f"{date} ({shift})<br>{subj}"
                    if yr in exam_dates_map and label not in exam_dates_map[yr]:
                        exam_dates_map[yr].append(label)

                # Record for Master Timetable
                timetable_entry = {
                    'date': date,
                    'shift': shift,
                    'I Yr': '-',
                    'II Yr': '-',
                    'III Yr': '-',
                    'IV Yr': '-'
                }
                for p in participants:
                    timetable_entry[p['year']] = p['subject']
                master_timetable.append(timetable_entry)

                active_year_names = [p['year'] for p in participants]
                
                # Clone students list for only participating years in this session
                session_year_dict = {y: list(year_master[y]) for y in active_year_names if y in year_master}
                
                session_total_students = sum(len(v) for v in session_year_dict.values())
                
                if total_capacity < session_total_students:
                    return JsonResponse({
                        'error': f'Rooms insufficient for {date} {shift}! Capacity: {total_capacity}, Students scheduled: {session_total_students}'
                    }, status=400)
                
                # Fill Rooms for this specific session
                for room_cfg in rooms:
                    room_name = room_cfg.get('name', 'Unknown Room')
                    rows = int(room_cfg.get('rows', 0))
                    cols = int(room_cfg.get('cols', 0))
                    door = room_cfg.get('door', 'right')
                    raw_pattern = room_cfg.get('seating_pattern', 'IV Yr, III Yr, II Yr, I Yr')
                    
                    # Parse pattern string like "IV Yr, II Yr" into a list
                    custom_pattern = [p.strip() for p in raw_pattern.split(',') if p.strip()]
                
                    if rows <= 0 or cols <= 0: continue
                    # Check if there are any students left to place
                    has_students_left = any(len(lst) > 0 for lst in session_year_dict.values())
                    if not has_students_left and not is_append_room:
                        break # All students placed for this session
                    
                    seating = [["" for _ in range(cols)] for _ in range(rows)]
                    year_map = [["" for _ in range(cols)] for _ in range(rows)]
                    
                    column_pattern = get_active_pattern(session_year_dict, cols, custom_pattern, include_empty=is_append_room)
                    
                    # Pre-fill year_map based on column_pattern so empty inserted rooms have strict year structure
                    for c_idx in range(cols):
                        if c_idx < len(column_pattern):
                            for r_idx in range(rows):
                                year_map[r_idx][c_idx] = column_pattern[c_idx]
                    
                    # Place students
                    for col in range(cols):
                        if col >= len(column_pattern): break
                        preferred_year = column_pattern[col]
                        
                        if preferred_year == "":
                            continue # Skip this column entirely to leave it empty

                        for row in range(rows):
                            left_year = year_map[row][col - 1] if col > 0 else None
                            placed = False
    
                            # Try preferred rule
                            if session_year_dict.get(preferred_year) and len(session_year_dict[preferred_year]) > 0:
                                if preferred_year != left_year:
                                    student = session_year_dict[preferred_year].pop(0)
                                    seating[row][col] = student
                                    year_map[row][col] = preferred_year
                                    placed = True
    
                            # Try alternative rule without side-by-side
                            if not placed:
                                for alt_year in ["IV Yr", "III Yr", "II Yr", "I Yr"]:
                                    if session_year_dict.get(alt_year) and session_year_dict[alt_year]:
                                        if alt_year != left_year:
                                            student = session_year_dict[alt_year].pop(0)
                                            seating[row][col] = student
                                            year_map[row][col] = alt_year
                                            placed = True
                                            break
                                            
                            # Fallback: try non-adjacent first, then allow side-by-side
                            # only when truly no other option exists (single year left).
                            if not placed:
                                remaining_years = [y for y, lst in session_year_dict.items() if len(lst) > 0]
                                if len(remaining_years) > 1:
                                    # Still multiple years — prefer non-adjacent
                                    for alt_year in ["IV Yr", "III Yr", "II Yr", "I Yr"]:
                                        if session_year_dict.get(alt_year) and len(session_year_dict[alt_year]) > 0:
                                            if alt_year != left_year:  # honour no-side-by-side rule
                                                student = session_year_dict[alt_year].pop(0)
                                                seating[row][col] = student
                                                year_map[row][col] = alt_year
                                                placed = True
                                                break
                                # Absolute last resort: only one year left OR completely stuck.
                                # STRICT RULE: if only 1 year remains and placing it here would
                                # create a same-year adjacency, leave this seat EMPTY.
                                # The un-placed student stays in the queue and will land in the
                                # next non-adjacent column, producing alternating empty columns.
                                if not placed:
                                    remaining_abs = [y for y, lst in session_year_dict.items() if len(lst) > 0]
                                    for alt_year in ["IV Yr", "III Yr", "II Yr", "I Yr"]:
                                        if session_year_dict.get(alt_year) and len(session_year_dict[alt_year]) > 0:
                                            if len(remaining_abs) == 1 and alt_year == left_year:
                                                break  # leave seat empty — no-adjacent rule takes priority
                                            student = session_year_dict[alt_year].pop(0)
                                            seating[row][col] = student
                                            year_map[row][col] = alt_year
                                            placed = True
                                            break
                                        
                    # Build matrices for UI
                    room_seating_matrix = []
                    column_headers = []
                    for col in range(cols):
                        years_in_column = set()
                        for row in range(rows):
                            if seating[row][col] and seating[row][col] != "" and year_map[row][col]:
                                years_in_column.add(year_map[row][col])
                        column_headers.append("/".join(sorted(years_in_column)) if years_in_column else "")
                        
                    room_seating_matrix.append(column_headers)
                    for r in range(rows):
                        row_data = []
                        for c in range(cols):
                            student_obj = seating[r][c]
                            if isinstance(student_obj, dict):
                                row_data.append({'student': student_obj['enrollment'], 'name': student_obj.get('name', ''), 'year': year_map[r][c]})
                            else:
                                row_data.append({'student': student_obj, 'name': '', 'year': year_map[r][c]})
                        room_seating_matrix.append(row_data)
                        
                    # Stats
                    counts = {"I Yr": 0, "II Yr": 0, "III Yr": 0, "IV Yr": 0}
                    for r in range(rows):
                        for c in range(cols):
                            yr = year_map[r][c]
                            student_obj = seating[r][c]
                            if yr and student_obj and student_obj != "":
                                counts[yr] += 1
                    
                    # Strip zero counts
                    counts = {k: v for k, v in counts.items() if v > 0}
                    
                    # Room Wise Attendance Sheet
                    room_students = []
                    for c in range(cols):
                        for r in range(rows):
                            student_obj = seating[r][c]
                            if student_obj and student_obj != "":
                                if isinstance(student_obj, dict):
                                    room_students.append({
                                        'enrollment': student_obj['enrollment'],
                                        'name': student_obj.get('name', ''),
                                        'year': year_map[r][c]
                                    })
                                else:
                                    room_students.append({
                                        'enrollment': student_obj,
                                        'name': '',
                                        'year': year_map[r][c]
                                    })
                            elif is_append_room:
                                # For an empty added room, provide blank rows with the designated year
                                if year_map[r][c]:
                                    room_students.append({
                                        'enrollment': '',
                                        'name': '',
                                        'year': year_map[r][c]
                                    })
                                
                    room_attendance_data.append({
                        'date': date,
                        'shift': shift,
                        'room_name': room_name,
                        'students': room_students
                    })
                    
                    seating_plans.append({
                        'date': date,
                        'shift': shift,
                        'room_name': room_name,
                        'matrix': room_seating_matrix,
                        'headers': column_headers,
                        'rows': rows,
                        'cols': cols,
                        'door': door,
                        'counts': counts,
                        'total_in_room': sum(counts.values())
                    })
                
        # 5. Return JSON payload
        return JsonResponse({
            'success': True,
            'branch_name': branch_name,
            'seating_plans': seating_plans,
            'attendance_data': year_master, # Global sheet per year
            'room_attendance_data': room_attendance_data,
            'exam_dates_map': exam_dates_map,
            'master_timetable': master_timetable
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'error': str(e)}, status=500)
