from app.services.login_throttle import LoginThrottle


class FakeClock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


def throttle(clock: FakeClock) -> LoginThrottle:
    return LoginThrottle(max_failures=3, window_seconds=60, clock=clock)


def test_attempts_are_allowed_until_the_limit_is_reached() -> None:
    limiter = throttle(FakeClock())
    for _ in range(2):
        limiter.record_failure("a@example.com")

    assert limiter.retry_after("a@example.com") == 0


def test_attempts_are_blocked_at_the_limit_until_the_oldest_failure_ages_out() -> None:
    clock = FakeClock()
    limiter = throttle(clock)
    for _ in range(3):
        limiter.record_failure("a@example.com")
        clock.now += 10

    assert 0 < limiter.retry_after("a@example.com") <= 60
    clock.now += limiter.retry_after("a@example.com")
    assert limiter.retry_after("a@example.com") == 0


def test_each_email_has_its_own_count() -> None:
    limiter = throttle(FakeClock())
    for _ in range(3):
        limiter.record_failure("a@example.com")

    assert limiter.retry_after("b@example.com") == 0


def test_a_successful_sign_in_clears_the_count() -> None:
    limiter = throttle(FakeClock())
    for _ in range(3):
        limiter.record_failure("a@example.com")

    limiter.reset("a@example.com")

    assert limiter.retry_after("a@example.com") == 0


def test_checking_unknown_emails_does_not_grow_memory() -> None:
    limiter = throttle(FakeClock())
    for index in range(100):
        limiter.retry_after(f"user{index}@example.com")

    assert limiter._failures == {}
