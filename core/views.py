from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login as auth_login, logout as auth_logout
from django.contrib import messages

def home(request):
    return render(request, 'core/home.html')

def hod_login(request):
    if request.user.is_authenticated:
        return redirect('timetable_dashboard')
        
    if request.method == 'POST':
        u = request.POST.get('username')
        p = request.POST.get('password')
        
        user = authenticate(request, username=u, password=p)
        if user is not None:
            # Check if this user has an HoD profile and their institute is active
            if hasattr(user, 'hod_profile'):
                if user.hod_profile.department.institute.is_active:
                    auth_login(request, user)
                    messages.success(request, f"Welcome back, {user.first_name}!")
                    return redirect('timetable_dashboard')
                else:
                    messages.error(request, "Your Institute's subscription is currently inactive. Please contact support.")
            elif hasattr(user, 'institute_admin_profile'):
                # Future: Route to Institute Admin dashboard
                auth_login(request, user)
                return redirect('home')
            elif user.is_superuser:
                 auth_login(request, user)
                 return redirect('/admin/')
            else:
                messages.error(request, "Access denied. You do not have the required permissions.")
        else:
            messages.error(request, "Invalid username or password.")
            
    return render(request, 'core/auth/login.html')

def hod_logout(request):
    auth_logout(request)
    messages.success(request, "You have been logged out securely.")
    return redirect('home')
