#!/bin/sh

set -e

echo "=================================================="
echo " Pre-deployment Verification"
echo "=================================================="

# Environment validation using existing Pydantic settings
echo "[Pre-deployment] Validating environment configuration..."
python -c "
import os
import sys

# Optional: Load .env if present (for local development fallback)
try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

errors = []

# Validate required variables by name
# 1. JWT_SECRET
jwt_secret = os.getenv('JWT_SECRET')
if not jwt_secret or not jwt_secret.strip():
    errors.append('Missing required environment variable: JWT_SECRET')
elif len(jwt_secret.strip()) < 32:
    errors.append(f'Invalid JWT_SECRET: Minimum 32 characters required (current length: {len(jwt_secret.strip())})')

# 2. Database configuration
db_url = os.getenv('DATABASE_URL')
if db_url and db_url.strip():
    valid_db_schemes = ('postgresql://', 'postgres://', 'postgresql+asyncpg://', 'sqlite://')
    if not any(db_url.strip().startswith(s) for s in valid_db_schemes):
        errors.append('Invalid DATABASE_URL scheme: Must start with postgresql://, postgres://, or postgresql+asyncpg://')
else:
    for var in ['POSTGRES_SERVER', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB']:
        if not os.getenv(var) or not os.getenv(var).strip():
            errors.append(f'Missing required environment variable: {var} (or provide full DATABASE_URL)')

# 3. Redis configuration
redis_url = os.getenv('REDIS_URL')
if redis_url and redis_url.strip():
    if not any(redis_url.strip().startswith(s) for s in ('redis://', 'rediss://')):
        errors.append('Invalid REDIS_URL scheme: Must start with redis:// or rediss://')
else:
    if not os.getenv('REDIS_HOST') or not os.getenv('REDIS_HOST').strip():
        errors.append('Missing required environment variable: REDIS_HOST (or provide full REDIS_URL)')

# 4. Port numbers validation if provided
for port_var in ['POSTGRES_PORT', 'REDIS_PORT', 'PORT']:
    val = os.getenv(port_var)
    if val and val.strip():
        try:
            p = int(val.strip())
            if p < 1 or p > 65535:
                errors.append(f'Invalid {port_var}: Port must be between 1 and 65535')
        except ValueError:
            errors.append(f'Invalid {port_var}: Port must be a valid integer')

# 5. ENVIRONMENT validation if provided
env = os.getenv('ENVIRONMENT')
if env and env not in ('development', 'staging', 'production', 'testing'):
    errors.append(f'Invalid ENVIRONMENT: Must be one of development, staging, production, testing (got: {env})')

if errors:
    print('ERROR: Environment validation failed with the following errors:', file=sys.stderr)
    for err in errors:
        print(f'  - {err}', file=sys.stderr)
    sys.exit(1)

# Validate settings via Pydantic model (without exposing sensitive values or passwords)
try:
    from pydantic import ValidationError
    from app.core.config import settings
    print(f'Configuration validated successfully (App: {settings.APP_NAME}, Env: {settings.ENVIRONMENT})')
except ValidationError as exc:
    print('ERROR: Pydantic configuration validation failed for field(s):', file=sys.stderr)
    for err in exc.errors():
        field_name = '.'.join(str(loc) for loc in err.get('loc', []))
        print(f'  - {field_name}: invalid configuration format or constraint', file=sys.stderr)
    sys.exit(1)
except Exception:
    print('ERROR: Configuration validation failed. Please check your environment settings.', file=sys.stderr)
    sys.exit(1)
"

echo "Pre-deployment verification completed successfully."
exit 0
