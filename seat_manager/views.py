import json
import math
import pandas as pd
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

SEATS_PER_ROOM = 63 # Default fallback

def index(request):
    """Render the main front-end page."""
    return render(request, 'seat_manager/index.html')

def get_active_pattern(year_dict, cols, base_pattern=None):
    """Generate the repeating pattern of years for columns."""
    if not base_pattern:
        base_pattern = ["IV Yr", "III Yr", "II Yr", "I Yr"]
    # Only include the year if it was requested (in year_dict) and actually has students left
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
                years_to_check = [("I ", "I Yr", "1 "), ("II ", "II Yr", "2 "), ("III ", "III Yr", "3 "), ("IV ", "IV Yr", "4 ")]
                
                for keyword, y_key, alt_key in years_to_check:
                    enrollment_col = None
                    name_col = None
                    
                    for col in df.columns:
                        col_str = str(col).strip().upper()
                        if (keyword in col_str or alt_key in col_str):
                            if "NAME" in col_str:
                                name_col = col
                            elif "ENROLLMENT" in col_str or "ENROL" in col_str or "NO" in col_str:
                                enrollment_col = col
                    
                    if enrollment_col is None and name_col is None:
                        for col in df.columns:
                            col_str = str(col).strip().upper()
                            if (keyword in col_str or alt_key in col_str):
                                enrollment_col = col
                                break
                                
                    if enrollment_col is not None:
                        for idx, row in df.iterrows():
                            enrollment = str(row[enrollment_col]).strip()
                            if pd.isna(row[enrollment_col]) or not enrollment or enrollment.lower() == 'nan':
                                continue
                                
                            student_name = ""
                            if name_col is not None:
                                val = row[name_col]
                                if pd.notna(val) and str(val).lower() != 'nan':
                                    student_name = str(val).strip()
                                    
                            year_master[y_key].append({
                                'enrollment': enrollment,
                                'name': student_name
                            })

            except Exception as e:
                print(f"Error parsing excel: {e}")
                pass

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
                    if not any(len(lst) > 0 for lst in session_year_dict.values()):
                        break # All students placed for this session
                    
                    seating = [["" for _ in range(cols)] for _ in range(rows)]
                    year_map = [["" for _ in range(cols)] for _ in range(rows)]
                    
                    column_pattern = get_active_pattern(session_year_dict, cols, custom_pattern)
                    
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
                                            
                            # Fallback: if we absolutely must place side-by-side because no other isolated option exists
                            # *But*, if we explicitly decided to keep empty columns (like when only 1 year is left), don't do this fallback.
                            if not placed and len([y for y, lst in session_year_dict.items() if len(lst) > 0]) > 1:
                                for alt_year in ["IV Yr", "III Yr", "II Yr", "I Yr"]:
                                    if session_year_dict.get(alt_year) and len(session_year_dict[alt_year]) > 0:
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
                            if year_map[row][col]: years_in_column.add(year_map[row][col])
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
                            if yr: counts[yr] += 1
                    
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
