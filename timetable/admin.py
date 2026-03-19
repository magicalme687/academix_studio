from django.contrib import admin
from .models import (
    Department, Room, Faculty, Subject, 
    ClassSection, SubjectAllocation, TimeSlot, TimetableEntry
)

@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'created_at')
    search_fields = ('code', 'name')

@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ('name', 'room_type', 'capacity', 'department')
    list_filter = ('room_type', 'department')
    search_fields = ('name',)

@admin.register(Faculty)
class FacultyAdmin(admin.ModelAdmin):
    list_display = ('name', 'short_code', 'department', 'designation', 'is_active')
    list_filter = ('department', 'is_active')
    search_fields = ('name', 'short_code')

@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'semester', 'department', 'lecture_hours_per_week', 'lab_hours_per_week')
    list_filter = ('semester', 'department', 'is_lab_subject', 'is_elective')
    search_fields = ('code', 'name')

@admin.register(ClassSection)
class ClassSectionAdmin(admin.ModelAdmin):
    list_display = ('name', 'program', 'year', 'semester', 'department', 'default_room')
    list_filter = ('year', 'semester', 'department', 'program')
    search_fields = ('name',)

@admin.register(SubjectAllocation)
class SubjectAllocationAdmin(admin.ModelAdmin):
    list_display = ('subject', 'faculty', 'class_section', 'lectures_per_week', 'labs_per_week')
    list_filter = ('class_section__department', 'class_section__semester')
    search_fields = ('subject__name', 'faculty__name', 'class_section__name')

@admin.register(TimeSlot)
class TimeSlotAdmin(admin.ModelAdmin):
    list_display = ('start_time', 'end_time', 'slot_type', 'order')
    list_filter = ('slot_type',)
    ordering = ('start_time',)

@admin.register(TimetableEntry)
class TimetableEntryAdmin(admin.ModelAdmin):
    list_display = ('class_section', 'day', 'slot', 'subject', 'faculty', 'room', 'session_type')
    list_filter = ('day', 'session_type', 'class_section', 'faculty')
    search_fields = ('class_section__name', 'subject__name', 'faculty__name')
