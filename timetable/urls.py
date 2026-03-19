from django.urls import path
from . import views

urlpatterns = [
    path('', views.dashboard, name='timetable_dashboard'),
    path('setup/', views.scheme_setup, name='scheme_setup'),
    path('setup/download-template/', views.download_template, name='download_scheme_template'),
    path('generate/', views.generate_timetable, name='generate_timetable'),
    path('matrix/<int:department_id>/', views.view_matrix, name='view_matrix'),
    path('faculty-setup/', views.faculty_setup, name='faculty_setup'),
    path('faculty-setup/download-template/', views.download_faculty_template, name='download_faculty_template'),
    path('session-setup/', views.session_setup, name='session_setup'),
    path('allocations/', views.workload_allocation, name='workload_allocation'),
]
