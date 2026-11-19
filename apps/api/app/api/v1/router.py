from fastapi import APIRouter

from app.api.v1.routes import (
    annotations,
    auth,
    classrooms,
    courses,
    coursewares,
    health,
    shared_annotations,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(auth.me_router)
api_router.include_router(courses.router)
api_router.include_router(coursewares.router)
api_router.include_router(annotations.router)
api_router.include_router(classrooms.router)
api_router.include_router(shared_annotations.router)
