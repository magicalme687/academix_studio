from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='practical_index'),
    path('generate/', views.generate_practical_sheets, name='practical_generate')
]
