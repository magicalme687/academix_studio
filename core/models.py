from django.db import models
from django.contrib.auth.models import User

class SubscriptionTier(models.Model):
    name = models.CharField(max_length=50, unique=True, help_text="e.g., Free, Premium, Enterprise")
    max_departments = models.IntegerField(default=1, help_text="Maximum departments allowed per institute")
    max_faculties = models.IntegerField(default=50, help_text="Maximum faculties allowed per institute")
    price_per_month = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    
    def __str__(self):
        return f"{self.name} (Max Dpt: {self.max_departments})"

class Institute(models.Model):
    name = models.CharField(max_length=200, help_text="e.g., IPS Academy, Institute of Engineering and Science")
    code = models.CharField(max_length=20, unique=True, help_text="e.g., IPSA")
    address = models.TextField(blank=True, null=True)
    logo = models.ImageField(upload_to='institute_logos/', blank=True, null=True)
    subscription_tier = models.ForeignKey(SubscriptionTier, on_delete=models.SET_NULL, null=True)
    is_active = models.BooleanField(default=True, help_text="Uncheck to suspend access for this institute")
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.code} - {self.name}"

class InstituteAdmin(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='institute_admin_profile')
    institute = models.ForeignKey(Institute, on_delete=models.CASCADE, related_name='admins')
    
    def __str__(self):
        return self.user.username
