from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.contrib.auth.models import User
from core.models import Institute

# 2.1 Department
class Department(models.Model):
    SESSION_CHOICES = [
        ('ODD', 'Odd (Jul-Dec)'),
        ('EVEN', 'Even (Jan-Jun)')
    ]
    institute = models.ForeignKey(Institute, on_delete=models.CASCADE, related_name='departments', null=True)
    name = models.CharField(max_length=100, help_text="e.g., Computer Science & IT")
    code = models.CharField(max_length=20, help_text="e.g., CSIT")
    current_session = models.CharField(max_length=10, choices=SESSION_CHOICES, default='ODD')
    excluded_semesters = models.CharField(max_length=50, blank=True, default='', help_text="Comma separated list of semester numbers to ignore")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('institute', 'code')

    def __str__(self):
        return f"{self.institute.code if self.institute else ''} - {self.code} - {self.name}"

# HoD Profile (SaaS Access)
class HoDProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='hod_profile')
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='hods')
    
    def __str__(self):
        return f"HoD: {self.user.username} ({self.department.code})"

# 2.5 Rooms
class Room(models.Model):
    ROOM_TYPES = [
        ('CLASSROOM', 'Classroom'),
        ('LAB', 'Laboratory'),
        ('SEMINAR_HALL', 'Seminar Hall'),
    ]
    name = models.CharField(max_length=50, help_text="e.g., N203, Computer Lab 1")
    room_type = models.CharField(max_length=20, choices=ROOM_TYPES, default='CLASSROOM')
    capacity = models.IntegerField(default=60)
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='rooms')

    def __str__(self):
        return f"{self.name} ({self.get_room_type_display()})"

# 2.2 Faculty
class Faculty(models.Model):
    name = models.CharField(max_length=100)
    short_code = models.CharField(max_length=10, unique=True, help_text="e.g., YP")
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='faculty')
    designation = models.CharField(max_length=100, default='Asst. Prof.')
    max_lectures_per_day = models.IntegerField(default=4)
    max_lectures_per_week = models.IntegerField(default=20)
    preferred_subjects = models.ManyToManyField('Subject', blank=True, related_name='preferred_by_faculty')
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} ({self.short_code})"

# 2.3 Subjects
class Subject(models.Model):
    code = models.CharField(max_length=20, help_text="e.g., CI02")
    name = models.CharField(max_length=150, help_text="e.g., Data Structure Algorithm")
    semester = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(8)])
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='subjects')
    lecture_hours_per_week = models.IntegerField(default=3)
    tutorial_hours_per_week = models.IntegerField(default=0)
    lab_hours_per_week = models.IntegerField(default=2)
    is_lab_subject = models.BooleanField(default=True)
    is_elective = models.BooleanField(default=False)

    class Meta:
        unique_together = ('code', 'department')

    def __str__(self):
        return f"{self.code} - {self.name}"

# 2.4 Classes (Sections)
class ClassSection(models.Model):
    name = models.CharField(max_length=50, help_text="e.g., CIS-1, CIT-2")
    program = models.CharField(max_length=50, default='B.Tech')
    year = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(4)])
    semester = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(8)])
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='classes')
    default_room = models.ForeignKey(Room, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_classes')

    def __str__(self):
        return self.name

# Subject Allocation (From Step 6)
class SubjectAllocation(models.Model):
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE)
    faculty = models.ForeignKey(Faculty, on_delete=models.CASCADE)
    class_section = models.ForeignKey(ClassSection, on_delete=models.CASCADE)
    lectures_per_week = models.IntegerField(default=0)
    tutorial_hours = models.IntegerField(default=0)
    labs_per_week = models.IntegerField(default=0)

    # Removed unique_together = ('subject', 'class_section') to allow multiple teachers to share the same section (e.g. Lab batches)

    def __str__(self):
        return f"{self.subject.code} -> {self.faculty.short_code} ({self.class_section.name})"

# 2.6 Time Slots
class TimeSlot(models.Model):
    SLOT_TYPES = [
        ('LECTURE', 'Lecture'),
        ('LAB', 'Laboratory'),
        ('BREAK', 'Break'),
        ('LUNCH', 'Lunch'),
    ]
    start_time = models.TimeField()
    end_time = models.TimeField()
    slot_type = models.CharField(max_length=20, choices=SLOT_TYPES, default='LECTURE')
    
    # Optional ordering if required
    order = models.IntegerField(default=0, help_text="Ordering index (e.g., Slot 1, Slot 2)")

    def __str__(self):
        return f"{self.start_time.strftime('%H:%M')} - {self.end_time.strftime('%H:%M')} ({self.slot_type})"

# 2.7 Timetable Entry
class TimetableEntry(models.Model):
    SESSION_TYPES = [
        ('LECTURE', 'Lecture'),
        ('LAB', 'Laboratory'),
        ('SEMINAR', 'Seminar'),
        ('EXPERT_LECTURE', 'Expert Lecture'),
        ('BREAK', 'Break'),
        ('FREE', 'Free'),
    ]
    
    DAYS_OF_WEEK = [
        ('MONDAY', 'Monday'),
        ('TUESDAY', 'Tuesday'),
        ('WEDNESDAY', 'Wednesday'),
        ('THURSDAY', 'Thursday'),
        ('FRIDAY', 'Friday'),
        ('SATURDAY', 'Saturday'),
    ]

    class_section = models.ForeignKey(ClassSection, on_delete=models.CASCADE, related_name='timetable_entries')
    day = models.CharField(max_length=15, choices=DAYS_OF_WEEK)
    slot = models.ForeignKey(TimeSlot, on_delete=models.CASCADE)
    subject = models.ForeignKey(Subject, on_delete=models.SET_NULL, null=True, blank=True)
    faculty = models.ForeignKey(Faculty, on_delete=models.SET_NULL, null=True, blank=True)
    room = models.ForeignKey(Room, on_delete=models.SET_NULL, null=True, blank=True)
    session_type = models.CharField(max_length=20, choices=SESSION_TYPES, default='LECTURE')
    notes = models.CharField(max_length=255, blank=True, null=True)

    def __str__(self):
        return f"{self.class_section.name} - {self.day} {self.slot.start_time.strftime('%H:%M')} - {self.subject.code if self.subject else 'FREE'}"
