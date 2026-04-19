"""Grant (or revoke) platform super-admin rights to a specific user.

A super-admin can reach the /admin dashboard in the frontend and every
/api/admin/* endpoint. Completely separate from org `role`.

Usage from the backend/ directory:

    # Grant:
    python -m scripts.grant_superuser waqas114@gmail.com

    # Revoke:
    python -m scripts.grant_superuser waqas114@gmail.com --revoke

On Railway you can run this with:

    railway run python -m scripts.grant_superuser waqas114@gmail.com

The script is idempotent — running it twice is safe.
"""

import argparse
import sys

# Allow running from anywhere inside the backend/ dir
try:
    from database import SessionLocal, User
except ImportError:  # pragma: no cover - for out-of-tree invocations
    import os
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from database import SessionLocal, User


def main() -> int:
    parser = argparse.ArgumentParser(description="Grant/revoke platform super-admin")
    parser.add_argument("email", help="Email address of the user to update")
    parser.add_argument("--revoke", action="store_true",
                        help="Revoke superuser instead of granting it")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == args.email.lower()).first()
        if not user:
            print(f"ERROR: no user with email {args.email!r}", file=sys.stderr)
            return 1

        target = not args.revoke
        prev = bool(getattr(user, "is_superuser", False))
        if prev == target:
            state = "already a superuser" if target else "already not a superuser"
            print(f"No change: {user.email} is {state}.")
            return 0

        user.is_superuser = target
        db.commit()
        verb = "granted" if target else "revoked"
        print(f"OK: {verb} superuser for {user.email}.")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
