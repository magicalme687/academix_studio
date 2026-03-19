from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('login/', views.hod_login, name='hod_login'),
    path('logout/', views.hod_logout, name='hod_logout'),
]
