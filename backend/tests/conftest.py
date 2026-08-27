import asyncio
from typing import AsyncGenerator, Dict
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import Base, get_db
from app.core.security import create_access_token, hash_password
from app.models.enums import UserRole
from app.models.user import User
from main import app

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False}
)

TestAsyncSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)


@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestAsyncSessionLocal() as session:
        yield session

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


async def _create_test_user(
    db: AsyncSession,
    email: str,
    role: UserRole,
    full_name: str,
    is_active: bool = True
) -> User:
    user = User(
        email=email,
        hashed_password=hash_password("Password123!"),
        full_name=full_name,
        role=role,
        is_active=is_active,
        is_verified=True
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest_asyncio.fixture(scope="function")
async def admin_user(db_session: AsyncSession) -> User:
    return await _create_test_user(
        db_session,
        "admin@test.com",
        UserRole.ADMIN,
        "Admin User"
    )


@pytest_asyncio.fixture(scope="function")
async def ops_user(db_session: AsyncSession) -> User:
    return await _create_test_user(
        db_session,
        "ops@test.com",
        UserRole.OPERATIONS_MANAGER,
        "Operations Manager"
    )


@pytest_asyncio.fixture(scope="function")
async def dispatcher_user(db_session: AsyncSession) -> User:
    return await _create_test_user(
        db_session,
        "dispatch@test.com",
        UserRole.DISPATCHER,
        "Dispatcher User"
    )


@pytest_asyncio.fixture(scope="function")
async def accountant_user(db_session: AsyncSession) -> User:
    return await _create_test_user(
        db_session,
        "accountant@test.com",
        UserRole.ACCOUNTANT,
        "Accountant User"
    )


@pytest_asyncio.fixture(scope="function")
async def driver_user(db_session: AsyncSession) -> User:
    return await _create_test_user(
        db_session,
        "driver@test.com",
        UserRole.DRIVER,
        "Driver User"
    )


@pytest_asyncio.fixture(scope="function")
async def customer_user(db_session: AsyncSession) -> User:
    return await _create_test_user(
        db_session,
        "customer@test.com",
        UserRole.CUSTOMER,
        "Customer User"
    )


@pytest_asyncio.fixture(scope="function")
async def inactive_user(db_session: AsyncSession) -> User:
    return await _create_test_user(
        db_session,
        "inactive@test.com",
        UserRole.CUSTOMER,
        "Inactive User",
        is_active=False
    )


def auth_header(user: User) -> Dict[str, str]:
    token = create_access_token(
        subject=user.id,
        role=user.role.value,
        email=user.email
    )
    return {"Authorization": f"Bearer {token}"}
