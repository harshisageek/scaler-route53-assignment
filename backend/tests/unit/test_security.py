from app.core.security import (
    hash_password,
    hash_session_token,
    new_session_token,
    verify_password,
)


def test_a_password_matches_only_its_own_hash() -> None:
    stored = hash_password("correct horse")

    assert verify_password(stored, "correct horse")
    assert not verify_password(stored, "Correct horse")


def test_the_same_password_hashes_differently_each_time() -> None:
    assert hash_password("same") != hash_password("same")


def test_an_unknown_user_never_verifies() -> None:
    assert not verify_password(None, "anything")


def test_a_corrupt_stored_hash_fails_closed() -> None:
    assert not verify_password("not-a-hash", "anything")


def test_session_tokens_are_unique_and_long() -> None:
    tokens = {new_session_token() for _ in range(50)}

    assert len(tokens) == 50
    assert all(len(token) >= 43 for token in tokens)


def test_a_token_always_hashes_to_the_same_value() -> None:
    assert hash_session_token("abc") == hash_session_token("abc")
    assert hash_session_token("abc") != hash_session_token("abd")
