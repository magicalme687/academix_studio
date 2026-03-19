from django.contrib import admin
from .models import SubscriptionTier, Institute, InstituteAdmin

@admin.register(SubscriptionTier)
class SubscriptionTierAdmin(admin.ModelAdmin):
    list_display = ('name', 'max_departments', 'max_faculties', 'price_per_month')

@admin.register(Institute)
class InstituteModelAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'subscription_tier', 'is_active', 'created_at')
    list_filter = ('is_active', 'subscription_tier')
    search_fields = ('code', 'name')

@admin.register(InstituteAdmin)
class InstituteAdminProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'institute')
    search_fields = ('user__username', 'institute__name')
