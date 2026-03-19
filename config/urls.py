from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('core.urls')),
    path('seat_manager/', include('seat_manager.urls')),
    path('timetable/', include('timetable.urls')),
    path('practical_exam/', include('practical_exam.urls')),
]
