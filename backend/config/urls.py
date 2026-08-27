from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

from apps.accounts.views import TeacherAuthViewSet, StudentAuthViewSet
from apps.students.views import StudentViewSet
from apps.batches.views import BatchViewSet
from apps.payments.views import PaymentViewSet
from apps.exams.views import ExamViewSet, ExamResultViewSet
from apps.notices.views import NoticeViewSet
from apps.homework.views import HomeworkViewSet
from apps.attendance.views import AttendanceViewSet
from apps.core.views import StatsViewSet

router = DefaultRouter()
router.register(r'auth/teacher', TeacherAuthViewSet, basename='teacher-auth')
router.register(r'auth/student', StudentAuthViewSet, basename='student-auth')
router.register(r'students', StudentViewSet, basename='student')
router.register(r'batches', BatchViewSet, basename='batch')
router.register(r'payments', PaymentViewSet, basename='payment')
router.register(r'exams', ExamViewSet, basename='exam')
router.register(r'exam-results', ExamResultViewSet, basename='exam-result')
router.register(r'notices', NoticeViewSet, basename='notice')
router.register(r'homework', HomeworkViewSet, basename='homework')
router.register(r'attendance', AttendanceViewSet, basename='attendance')
router.register(r'stats', StatsViewSet, basename='stats')

urlpatterns = [
    path('api/', include(router.urls)),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]