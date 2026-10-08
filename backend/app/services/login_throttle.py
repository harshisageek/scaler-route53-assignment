"""A sliding-window limit on attempts per key.

Sign-in keys it on the email together with the client address, so failures
from one client cannot lock the owner out from another. The client address is
the one uvicorn resolves, which only honours X-Forwarded-For from proxies listed
in FORWARDED_ALLOW_IPS, so a client cannot forge it.

State is kept in memory, which is correct for the single API process this app
runs. Several processes would each keep their own count.
"""

import time
from collections import deque
from collections.abc import Callable
from threading import Lock


class LoginThrottle:
    def __init__(
        self,
        max_failures: int,
        window_seconds: int,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._max_failures = max_failures
        self._window = window_seconds
        self._clock = clock
        self._failures: dict[str, deque[float]] = {}
        self._lock = Lock()

    def retry_after(self, email: str) -> int:
        """Seconds until another attempt is allowed, or 0 if one is allowed now."""
        with self._lock:
            failures = self._recent_failures(email)
            if not failures:
                self._failures.pop(email, None)
            if len(failures) < self._max_failures:
                return 0
            return max(1, int(failures[0] + self._window - self._clock()) + 1)

    def record_failure(self, email: str) -> None:
        with self._lock:
            self._recent_failures(email).append(self._clock())

    def reset(self, email: str) -> None:
        with self._lock:
            self._failures.pop(email, None)

    def _recent_failures(self, email: str) -> deque[float]:
        failures = self._failures.setdefault(email, deque())
        cutoff = self._clock() - self._window
        while failures and failures[0] <= cutoff:
            failures.popleft()
        return failures
