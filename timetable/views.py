from django.shortcuts import render, redirect
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from .models import Department, ClassSection, TimetableEntry, TimeSlot, Subject, Faculty, SubjectAllocation
from .services.generator import TimetableGenerator
from .services.parser import SchemeParser, FacultyParser
from .services.export import download_scheme_template, download_faculty_template_excel

@login_required(login_url='hod_login')
def dashboard(request):
    if not hasattr(request.user, 'hod_profile'):
        messages.error(request, "You need an HoD profile to access this area.")
        return redirect('home')
        
    department = request.user.hod_profile.department
    subjects_count = Subject.objects.filter(department=department).count()
    faculties_count = Faculty.objects.filter(department=department).count()
    return render(request, 'timetable/dashboard.html', {
        'department': department,
        'subjects_count': subjects_count,
        'faculties_count': faculties_count
    })

@login_required(login_url='hod_login')
def scheme_setup(request):
    if not hasattr(request.user, 'hod_profile'):
        return redirect('home')
        
    department = request.user.hod_profile.department
    
    if request.method == 'POST' and request.FILES.get('scheme_file'):
        excel_file = request.FILES['scheme_file']
        parser = SchemeParser(excel_file, department)
        success, message = parser.parse_and_save()
        
        if success:
            messages.success(request, message)
        else:
            messages.error(request, f"Scheme Upload Failed: {message}")
            
        return redirect('scheme_setup')
        
    subjects = Subject.objects.filter(department=department).order_by('semester', 'code')
    return render(request, 'timetable/setup.html', {'department': department, 'subjects': subjects})

def download_template(request):
    return download_scheme_template(request)

def generate_timetable(request):
    departments = Department.objects.all()
    
    if request.method == 'POST':
        dept_id = request.POST.get('department')
        if not dept_id:
            messages.error(request, "Please select a department.")
            return redirect('generate_timetable')
            
        try:
            generator = TimetableGenerator(department_id=dept_id)
            success = generator.generate()
            if success:
                messages.success(request, "Timetable generated successfully! View results in the matrix below.")
                return redirect(f'/timetable/matrix/{dept_id}/')
            else:
                messages.error(request, "Unable to resolve all conflicts. Timetable may be incomplete.")
        except Exception as e:
            messages.error(request, f"Generation failed: {str(e)}")
            
    return render(request, 'timetable/generate.html', {'departments': departments})

def view_matrix(request, department_id):
    department = Department.objects.get(id=department_id)
    classes = ClassSection.objects.filter(department=department)
    slots = list(TimeSlot.objects.all().order_by('start_time'))
    days = [d[0] for d in TimetableEntry.DAYS_OF_WEEK]
    
    # Build matrix: matrix_data[class][day][slot] = entry
    matrix_data = {}
    for c in classes:
        matrix_data[c] = {}
        for d in days:
            matrix_data[c][d] = {}
            for s in slots:
                matrix_data[c][d][s] = None
                
    entries = TimetableEntry.objects.filter(class_section__department=department).select_related('subject', 'faculty', 'room', 'slot')
    for e in entries:
        matrix_data[e.class_section][e.day][e.slot] = e
        
    context = {
        'department': department,
        'slots': slots,
        'days': days,
        'matrix_data': matrix_data,
    }
    return render(request, 'timetable/matrix.html', context)

@login_required(login_url='hod_login')
def faculty_setup(request):
    if not hasattr(request.user, 'hod_profile'):
        return redirect('home')
        
    department = request.user.hod_profile.department
    
    if request.method == 'POST':
        if 'add_faculty' in request.POST:
            fac_name = request.POST.get('name')
            fac_code = request.POST.get('short_code')
            fac_desig = request.POST.get('designation', 'Asst. Prof.')
            preferred_sub_ids = request.POST.getlist('preferred_subjects')
            
            if fac_name and fac_code:
                fac, created = Faculty.objects.get_or_create(
                    short_code=fac_code,
                    department=department,
                    defaults={'name': fac_name, 'designation': fac_desig}
                )
                if not created:
                    fac.name = fac_name
                    fac.designation = fac_desig
                    fac.save()
                    messages.success(request, f"Updated Faculty {fac.name}")
                else:
                    messages.success(request, f"Added manually {fac.name}")
                
                if preferred_sub_ids:
                    fac.preferred_subjects.set(preferred_sub_ids)
            return redirect('faculty_setup')
            
        elif request.FILES.get('faculty_file'):
            excel_file = request.FILES['faculty_file']
            parser = FacultyParser(excel_file, department)
            success, message = parser.parse_and_save()
            
            if success:
                messages.success(request, message)
            else:
                messages.error(request, f"Faculty Upload Failed: {message}")
                
            return redirect('faculty_setup')
        
    faculties = Faculty.objects.filter(department=department).order_by('name')
    subjects = Subject.objects.filter(department=department).order_by('semester', 'name')
    return render(request, 'timetable/faculty_setup.html', {'department': department, 'faculties': faculties, 'subjects': subjects})

def download_faculty_template(request):
    return download_faculty_template_excel(request)

@login_required(login_url='hod_login')
def session_setup(request):
    if not hasattr(request.user, 'hod_profile'):
        return redirect('home')
        
    department = request.user.hod_profile.department
    
    if request.method == 'POST':
        if 'update_session' in request.POST:
            session_val = request.POST.get('session_type')
            if session_val in ['ODD', 'EVEN']:
                department.current_session = session_val
                department.save()
                messages.success(request, f"Academic session updated to {dict(Department.SESSION_CHOICES).get(session_val)}")
            return redirect('session_setup')
            
        elif 'add_section' in request.POST:
            sem_str = request.POST.get('semester')
            sec_name = request.POST.get('section_name')
            if sem_str and sec_name:
                sem = int(sem_str)
                ClassSection.objects.get_or_create(
                    name=sec_name.strip(),
                    semester=sem,
                    department=department,
                    defaults={'year': (sem + 1) // 2}
                )
                messages.success(request, f"Added Section {sec_name} for Semester {sem}")
            return redirect('session_setup')
            
        elif 'delete_section' in request.POST:
            sec_id = request.POST.get('section_id')
            if sec_id:
                ClassSection.objects.filter(id=sec_id, department=department).delete()
                messages.success(request, "Section removed successfully.")
            return redirect('session_setup')
            
        elif 'toggle_semester' in request.POST:
            sem_val = request.POST.get('semester_val')
            if sem_val:
                excluded = [x for x in department.excluded_semesters.split(',') if x.strip().isdigit()]
                if sem_val in excluded:
                    excluded.remove(sem_val)
                    messages.success(request, f"Semester {sem_val} is now included in the timetable.")
                else:
                    excluded.append(sem_val)
                    # Also optionally delete all ClassSections for this semester? Keep them disabled is safer.
                    messages.warning(request, f"Semester {sem_val} is now excluded from the timetable.")
                department.excluded_semesters = ",".join(excluded)
                department.save()
            return redirect('session_setup')

    if department.current_session == 'ODD':
        valid_sems = [1, 3, 5, 7]
    else:
        valid_sems = [2, 4, 6, 8]
        
    excluded_list = [int(x) for x in department.excluded_semesters.split(',') if x.strip().isdigit()]
    sections = ClassSection.objects.filter(department=department, semester__in=valid_sems).order_by('semester', 'name')
    
    sem_data = []
    for s in valid_sems:
        secs = [sec for sec in sections if sec.semester == s]
        sem_data.append({
            'semester': s, 
            'sections': secs,
            'is_excluded': s in excluded_list
        })
        
    return render(request, 'timetable/session_setup.html', {
        'department': department,
        'sem_data': sem_data
    })

@login_required(login_url='hod_login')
def workload_allocation(request):
    try:
        department = request.user.hod_profile.department
    except AttributeError:
        messages.error(request, "Access Denied: You are not assigned to a department.")
        return redirect('timetable_dashboard')

    if department.current_session == 'ODD':
        valid_sems = [1, 3, 5, 7]
    else:
        valid_sems = [2, 4, 6, 8]
        
    excluded_list = [int(x) for x in department.excluded_semesters.split(',') if x.strip().isdigit()]
    active_sems = [s for s in valid_sems if s not in excluded_list]
    
    # We allow filtering by faculty and semester
    selected_fac_str = request.GET.get('faculty') or request.POST.get('faculty_filter')
    selected_sem_str = request.GET.get('semester') or request.POST.get('semester_filter')
    
    selected_fac = None
    selected_sem = None
    
    faculties = Faculty.objects.filter(department=department, is_active=True).order_by('name')

    if selected_fac_str and selected_fac_str.isdigit():
        try:
            selected_fac = faculties.get(id=int(selected_fac_str))
        except Faculty.DoesNotExist:
            pass

    if selected_sem_str and selected_sem_str.isdigit() and int(selected_sem_str) in active_sems:
        selected_sem = int(selected_sem_str)

    if request.method == 'POST':
        if 'delete_allocation' in request.POST:
            alloc_id = request.POST.get('delete_allocation')
            if alloc_id:
                try:
                    alloc = SubjectAllocation.objects.get(id=alloc_id, subject__department=department)
                    alloc.delete()
                    messages.success(request, "Workload assignment removed.")
                except SubjectAllocation.DoesNotExist:
                    pass
            fac_query = f"&faculty={selected_fac.id}" if selected_fac else ""
            sem_query = f"&semester={selected_sem}" if selected_sem else ""
            return redirect(f"/timetable/allocations/?{fac_query}{sem_query}")

        sub_id = request.POST.get('subject_id')
        sec_id = request.POST.get('section_id')
        l_hrs = int(request.POST.get('l_hours', 0))
        t_hrs = int(request.POST.get('t_hours', 0))
        p_hrs = int(request.POST.get('p_hours', 0))

        if sub_id and selected_fac and sec_id:
            try:
                sub = Subject.objects.get(id=sub_id, department=department)
                sec = ClassSection.objects.get(id=sec_id, department=department)

                # Check if this allocation already exists so we can update it
                alloc, created = SubjectAllocation.objects.get_or_create(
                    subject=sub,
                    faculty=selected_fac,
                    class_section=sec,
                    defaults={
                        'lectures_per_week': l_hrs,
                        'tutorial_hours': t_hrs,
                        'labs_per_week': p_hrs
                    }
                )

                if not created:
                    alloc.lectures_per_week += l_hrs
                    alloc.tutorial_hours += t_hrs
                    alloc.labs_per_week += p_hrs
                    alloc.save()

                messages.success(request, f"Assigned {l_hrs}L, {t_hrs}T, {p_hrs}P to {selected_fac.name} for {sec.name}")

                # Validate Faculty Max Load
                total_fac_load = sum([
                    a.lectures_per_week + a.tutorial_hours + a.labs_per_week 
                    for a in SubjectAllocation.objects.filter(faculty=selected_fac)
                ])
                if selected_fac.max_lectures_per_week and total_fac_load > selected_fac.max_lectures_per_week:
                    messages.warning(request, f"⚠️ Warning: {selected_fac.name} is now overloaded! Total assigned load ({total_fac_load} hrs) exceeds their maximum limit of {selected_fac.max_lectures_per_week} hrs/week.")

            except (Subject.DoesNotExist, ClassSection.DoesNotExist):
                messages.error(request, "Invalid assignment parameters.")

        fac_query = f"faculty={selected_fac.id}&" if selected_fac else ""
        sem_query = f"semester={selected_sem}" if selected_sem else ""
        return redirect(f"/timetable/allocations/?{fac_query}{sem_query}")

    allocation_data = []
    sections = []
    
    if selected_fac and selected_sem:
        sections = ClassSection.objects.filter(department=department, semester=selected_sem)
        num_sections = sections.count()
        subjects = Subject.objects.filter(department=department, semester=selected_sem)
        
        for sub in subjects:
            req_l = sub.lecture_hours_per_week * num_sections
            req_t = sub.tutorial_hours_per_week * num_sections
            req_p = sub.lab_hours_per_week * num_sections
            
            # Calculate total assigned to ANY faculty to find Remaining Load
            all_allocs_for_sub = SubjectAllocation.objects.filter(subject=sub, class_section__semester=selected_sem)
            assigned_l = sum(a.lectures_per_week for a in all_allocs_for_sub)
            assigned_t = sum(a.tutorial_hours for a in all_allocs_for_sub)
            assigned_p = sum(a.labs_per_week for a in all_allocs_for_sub)
            
            # The allocations specifically for THIS user
            fac_allocs = all_allocs_for_sub.filter(faculty=selected_fac)
    subjects = Subject.objects.filter(department=department).order_by('semester', 'name')
    return render(request, 'timetable/faculty_setup.html', {'department': department, 'faculties': faculties, 'subjects': subjects})

def download_faculty_template(request):
    return download_faculty_template_excel(request)

@login_required(login_url='hod_login')
def session_setup(request):
    if not hasattr(request.user, 'hod_profile'):
        return redirect('home')
        
    department = request.user.hod_profile.department
    
    if request.method == 'POST':
        if 'update_session' in request.POST:
            session_val = request.POST.get('session_type')
            if session_val in ['ODD', 'EVEN']:
                department.current_session = session_val
                department.save()
                messages.success(request, f"Academic session updated to {dict(Department.SESSION_CHOICES).get(session_val)}")
            return redirect('session_setup')
            
        elif 'add_section' in request.POST:
            sem_str = request.POST.get('semester')
            sec_name = request.POST.get('section_name')
            if sem_str and sec_name:
                sem = int(sem_str)
                ClassSection.objects.get_or_create(
                    name=sec_name.strip(),
                    semester=sem,
                    department=department,
                    defaults={'year': (sem + 1) // 2}
                )
                messages.success(request, f"Added Section {sec_name} for Semester {sem}")
            return redirect('session_setup')
            
        elif 'delete_section' in request.POST:
            sec_id = request.POST.get('section_id')
            if sec_id:
                ClassSection.objects.filter(id=sec_id, department=department).delete()
                messages.success(request, "Section removed successfully.")
            return redirect('session_setup')
            
        elif 'toggle_semester' in request.POST:
            sem_val = request.POST.get('semester_val')
            if sem_val:
                excluded = [x for x in department.excluded_semesters.split(',') if x.strip().isdigit()]
                if sem_val in excluded:
                    excluded.remove(sem_val)
                    messages.success(request, f"Semester {sem_val} is now included in the timetable.")
                else:
                    excluded.append(sem_val)
                    # Also optionally delete all ClassSections for this semester? Keep them disabled is safer.
                    messages.warning(request, f"Semester {sem_val} is now excluded from the timetable.")
                department.excluded_semesters = ",".join(excluded)
                department.save()
            return redirect('session_setup')

    if department.current_session == 'ODD':
        valid_sems = [1, 3, 5, 7]
    else:
        valid_sems = [2, 4, 6, 8]
        
    excluded_list = [int(x) for x in department.excluded_semesters.split(',') if x.strip().isdigit()]
    sections = ClassSection.objects.filter(department=department, semester__in=valid_sems).order_by('semester', 'name')
    
    sem_data = []
    for s in valid_sems:
        secs = [sec for sec in sections if sec.semester == s]
        sem_data.append({
            'semester': s, 
            'sections': secs,
            'is_excluded': s in excluded_list
        })
        
    return render(request, 'timetable/session_setup.html', {
        'department': department,
        'sem_data': sem_data
    })

@login_required(login_url='hod_login')
def workload_allocation(request):
    try:
        department = request.user.hod_profile.department
    except AttributeError:
        messages.error(request, "Access Denied: You are not assigned to a department.")
        return redirect('timetable_dashboard')

    if department.current_session == 'ODD':
        valid_sems = [1, 3, 5, 7]
    else:
        valid_sems = [2, 4, 6, 8]
        
    excluded_list = [int(x) for x in department.excluded_semesters.split(',') if x.strip().isdigit()]
    active_sems = [s for s in valid_sems if s not in excluded_list]
    
    if request.method == 'POST':
        delete_id = request.POST.get('delete_allocation')
        if delete_id:
            try:
                alloc = SubjectAllocation.objects.get(id=delete_id, subject__department=department)
                alloc.delete()
                messages.success(request, "Allocation removed successfully.")
            except SubjectAllocation.DoesNotExist:
                pass
            return redirect('workload_allocation')

        subject_id = request.POST.get('subject_id')
        faculty_id = request.POST.get('faculty_id')
        category = request.POST.get('category') # 'l_hrs', 't_hrs', or 'p_hrs'
        
        if subject_id and faculty_id and category:
            subject = get_object_or_404(Subject, id=subject_id, department=department)
            faculty = get_object_or_404(Faculty, id=faculty_id, department=department)
            
            # Form checkboxes like: name="l_hrs_{sec.id}"
            active_classes = ClassSection.objects.filter(department=department, semester=subject.semester)
            
            assigned_count = 0
            for c_sec in active_classes:
                checkbox_name = f"{category}_{c_sec.id}"
                if request.POST.get(checkbox_name) == 'on':
                    
                    l_to_assign = subject.lecture_hours_per_week if category == 'l_hrs' else 0
                    t_to_assign = subject.tutorial_hours_per_week if category == 't_hrs' else 0
                    p_to_assign = subject.lab_hours_per_week if category == 'p_hrs' else 0
                    
                    if l_to_assign > 0 or t_to_assign > 0 or p_to_assign > 0:
                        alloc, created = SubjectAllocation.objects.get_or_create(
                            faculty=faculty,
                            subject=subject,
                            class_section=c_sec,
                            defaults={
                                'lectures_per_week': l_to_assign,
                                'tutorial_hours': t_to_assign,
                                'labs_per_week': p_to_assign
                            }
                        )
                        
                        if not created:
                            # Add to existing instead of resetting
                            alloc.lectures_per_week += l_to_assign
                            alloc.tutorial_hours += t_to_assign
                            alloc.labs_per_week += p_to_assign
                            alloc.save()
                            
                        assigned_count += 1
            
            if assigned_count > 0:
                messages.success(request, f"Successfully assigned workload for {subject.name} to {assigned_count} section(s).")
            else:
                messages.warning(request, "No sections selected for assignment.")
                
            return redirect('workload_allocation')

    # Gather data for Vue/React/Vanilla JS Reactive UI
    faculties = Faculty.objects.filter(department=department, is_active=True).order_by('name')
    sections = ClassSection.objects.filter(department=department, semester__in=active_sems).order_by('semester', 'name')
    subjects = Subject.objects.filter(department=department, semester__in=active_sems).order_by('semester', 'code')
    allocations = SubjectAllocation.objects.filter(subject__department=department, class_section__semester__in=active_sems)

    # Build Faculty JSON
    faculties_data = []
    for f in faculties:
        fac_allocs = allocations.filter(faculty=f)
        current_load = sum(a.lectures_per_week + a.tutorial_hours + a.labs_per_week for a in fac_allocs)
        faculties_data.append({
            'id': f.id,
            'name': f.name,
            'designation': f.designation,
            'max_load': f.max_lectures_per_week,
            'current_load': current_load,
            'preferred_subjects': list(f.preferred_subjects.values_list('id', flat=True))
        })

    # Build Subject JSON
    subjects_data = []
    for sub in subjects:
        sub_allocs = allocations.filter(subject=sub)
        num_sections = sections.filter(semester=sub.semester).count()
        req_l = sub.lecture_hours_per_week * num_sections
        req_t = sub.tutorial_hours_per_week * num_sections
        req_p = sub.lab_hours_per_week * num_sections
        
        assigned_l = sum(a.lectures_per_week for a in sub_allocs)
        assigned_t = sum(a.tutorial_hours for a in sub_allocs)
        assigned_p = sum(a.labs_per_week for a in sub_allocs)
        
        subjects_data.append({
            'id': sub.id,
            'code': sub.code,
            'name': sub.name,
            'semester': sub.semester,
            'l_hrs': sub.lecture_hours_per_week,
            't_hrs': sub.tutorial_hours_per_week,
            'p_hrs': sub.lab_hours_per_week,
            'req_l': req_l, 'req_t': req_t, 'req_p': req_p,
            'assigned_l': assigned_l, 'assigned_t': assigned_t, 'assigned_p': assigned_p,
            'rem_l': req_l - assigned_l,
            'rem_t': req_t - assigned_t,
            'rem_p': req_p - assigned_p,
        })

    sections_data = [{'id': s.id, 'name': s.name, 'semester': s.semester} for s in sections]
    
    allocations_data = []
    for a in allocations:
        allocations_data.append({
            'id': a.id,
            'faculty_id': a.faculty.id,
            'subject_id': a.subject.id,
            'section_id': a.class_section.id,
            'l_hrs': a.lectures_per_week,
            't_hrs': a.tutorial_hours,
            'p_hrs': a.labs_per_week
        })

    import json
    context = {
        'department': department,
        'active_sems': active_sems,
        'faculties_json': json.dumps(faculties_data),
        'subjects_json': json.dumps(subjects_data),
        'sections_json': json.dumps(sections_data),
        'allocations_json': json.dumps(allocations_data),
    }

    return render(request, 'timetable/allocations.html', context)
