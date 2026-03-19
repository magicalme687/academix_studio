import random
from collections import defaultdict
from timetable.models import (
    Department, Room, Faculty, Subject, 
    ClassSection, SubjectAllocation, TimeSlot, TimetableEntry
)

class TimetableGenerator:
    def __init__(self, department_id):
        self.department_id = department_id
        self.department = Department.objects.get(id=department_id)
        
        self.days = [d[0] for d in TimetableEntry.DAYS_OF_WEEK]
        self.slots = list(TimeSlot.objects.all().order_by('start_time'))
        self.classes = list(ClassSection.objects.filter(department_id=department_id))
        self.allocations = list(SubjectAllocation.objects.filter(class_section__department_id=department_id))
        self.rooms = list(Room.objects.filter(department_id=department_id))
        
        # Tracking structures
        # schedule[class_id][day][slot_id] = allocation
        self.schedule = defaultdict(lambda: defaultdict(dict))
        self.faculty_schedule = defaultdict(lambda: defaultdict(dict))
        self.room_schedule = defaultdict(lambda: defaultdict(dict))

    def generate(self):
        # Clear existing timetable for this department
        TimetableEntry.objects.filter(class_section__department=self.department).delete()

        # Phase 2: Block Fixed Slots
        self._block_fixed_slots()

        # Group allocations into tasks
        lab_tasks = []
        lecture_tasks = []

        for alloc in self.allocations:
            for _ in range(alloc.labs_per_week):
                lab_tasks.append(alloc)
            for _ in range(alloc.lectures_per_week):
                lecture_tasks.append(alloc)

        # Shuffle tasks for basic heuristic distribution
        random.shuffle(lab_tasks)
        random.shuffle(lecture_tasks)

        # Phase 3: Schedule Labs First (Requires 2 consecutive slots)
        for task in lab_tasks:
            self._schedule_lab(task)

        # Phase 4: Schedule Lectures
        for task in lecture_tasks:
            self._schedule_lecture(task)

        # Phase 7: Save to Database
        self._save_to_db()
        return True

    def _block_fixed_slots(self):
        fixed_slots = [s for s in self.slots if s.slot_type in ['BREAK', 'LUNCH']]
        for cls in self.classes:
            for day in self.days:
                for slot in fixed_slots:
                    self.schedule[cls.id][day][slot.id] = {'type': slot.slot_type}

    def _schedule_lab(self, task):
        # Needs 2 consecutive available slots
        for day in self.days:
            for i in range(len(self.slots) - 1):
                slot1 = self.slots[i]
                slot2 = self.slots[i + 1]
                
                # Check consecutive logic and validity
                if slot1.slot_type != 'LECTURE' or slot2.slot_type != 'LECTURE':
                    continue
                    
                if self._can_schedule(task, day, slot1) and self._can_schedule(task, day, slot2):
                    # Find a LAB room
                    lab_room = self._find_free_room(day, slot1, 'LAB')
                    if lab_room and self._is_room_free(lab_room, day, slot2):
                        # Schedule it!
                        self._assign(task, day, slot1, lab_room, session_type='LAB')
                        self._assign(task, day, slot2, lab_room, session_type='LAB')
                        return True
        print(f"Failed to schedule LAB for {task.subject.code} in {task.class_section.name}")
        return False

    def _schedule_lecture(self, task):
        for day in self.days:
            for slot in self.slots:
                if slot.slot_type != 'LECTURE':
                    continue
                
                if self._can_schedule(task, day, slot):
                    room = task.class_section.default_room
                    if room and self._is_room_free(room, day, slot):
                        self._assign(task, day, slot, room, session_type='LECTURE')
                        return True
                    
                    # If default room is not free or not assigned, find any classroom
                    free_room = self._find_free_room(day, slot, 'CLASSROOM')
                    if free_room:
                        self._assign(task, day, slot, free_room, session_type='LECTURE')
                        return True
        print(f"Failed to schedule LECTURE for {task.subject.code} in {task.class_section.name}")
        return False

    def _can_schedule(self, task, day, slot):
        # Is class free?
        if slot.id in self.schedule[task.class_section.id][day]:
            return False
            
        # Is faculty free?
        if slot.id in self.faculty_schedule[task.faculty.id][day]:
            return False
            
        return True

    def _is_room_free(self, room, day, slot):
        return slot.id not in self.room_schedule[room.id][day]

    def _find_free_room(self, day, slot, room_type):
        possible_rooms = [r for r in self.rooms if r.room_type == room_type]
        random.shuffle(possible_rooms)
        for r in possible_rooms:
            if self._is_room_free(r, day, slot):
                return r
        return None

    def _assign(self, task, day, slot, room, session_type):
        entry = {
            'task': task,
            'room': room,
            'session_type': session_type
        }
        self.schedule[task.class_section.id][day][slot.id] = entry
        self.faculty_schedule[task.faculty.id][day][slot.id] = entry
        self.room_schedule[room.id][day][slot.id] = entry

    def _save_to_db(self):
        entries = []
        for class_id, days in self.schedule.items():
            for day, slots in days.items():
                for slot_id, data in slots.items():
                    if 'task' in data: # It's a generated session
                        task = data['task']
                        entries.append(
                            TimetableEntry(
                                class_section_id=class_id,
                                day=day,
                                slot_id=slot_id,
                                subject=task.subject,
                                faculty=task.faculty,
                                room=data['room'],
                                session_type=data['session_type']
                            )
                        )
                    else: # It's a BREAK/LUNCH
                        # Note: We can either save blanks or BREAK entries. Let's save BREAK entries to render the grid cleanly
                        entries.append(
                            TimetableEntry(
                                class_section_id=class_id,
                                day=day,
                                slot_id=slot_id,
                                session_type=data['type']
                            )
                        )
        
        TimetableEntry.objects.bulk_create(entries)
