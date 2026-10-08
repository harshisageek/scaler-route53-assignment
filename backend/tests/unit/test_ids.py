import re

from app.services.ids import new_hosted_zone_id


def test_hosted_zone_ids_have_the_route53_shape() -> None:
    assert re.fullmatch(r"Z[A-Z0-9]{20}", new_hosted_zone_id())


def test_hosted_zone_ids_do_not_repeat() -> None:
    assert len({new_hosted_zone_id() for _ in range(1000)}) == 1000
