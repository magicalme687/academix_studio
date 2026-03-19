import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth.models import User
from core.models import Institute, SubscriptionTier
from timetable.models import Department, HoDProfile

def seed():
    # 1. Create Tier
    tier, _ = SubscriptionTier.objects.get_or_create(
        name="Enterprise Test",
        defaults={'max_departments': 10, 'max_faculties': 100}
    )
    
    # 2. Create Institute
    institute, _ = Institute.objects.get_or_create(
        code="IPSA",
        defaults={
            'name': "IPS Academy",
            'subscription_tier': tier,
            'is_active': True
        }
    )
    
    # 3. Create Department
    dept, _ = Department.objects.get_or_create(
        code="CSE",
        institute=institute,
        defaults={'name': "Computer Science and Engineering"}
    )
    
    # 4. Create HoD User
    username = "hod_cse"
    password = "password123"
    
    user, created = User.objects.get_or_create(username=username)
    if created:
        user.set_password(password)
        user.first_name = "Alan"
        user.last_name = "Turing"
        user.save()
        print(f"Created new user: {username}")
    else:
        user.set_password(password)
        user.save()
        print(f"Updated password for existing user: {username}")
        
    # 5. Link User to HoD Profile
    profile, p_created = HoDProfile.objects.get_or_create(
        user=user,
        defaults={'department': dept}
    )
    
    print("\n--- TEST CREDENTIALS READY ---")
    print(f"Username: {username}")
    print(f"Password: {password}")
    print(f"Institute: {institute.name}")
    print(f"Department: {dept.name}")
    print("------------------------------\n")

if __name__ == '__main__':
    seed()
