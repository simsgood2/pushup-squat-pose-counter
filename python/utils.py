import math


def angle_degrees(a, b, c) -> float:
    """Return the angle ABC in degrees."""
    ab = (a.x - b.x, a.y - b.y)
    cb = (c.x - b.x, c.y - b.y)

    ab_len = math.hypot(*ab)
    cb_len = math.hypot(*cb)
    if ab_len == 0 or cb_len == 0:
        return 0.0

    cosine = ((ab[0] * cb[0]) + (ab[1] * cb[1])) / (ab_len * cb_len)
    cosine = max(-1.0, min(1.0, cosine))
    return math.degrees(math.acos(cosine))


def average(values):
    values = [value for value in values if value is not None]
    if not values:
        return None
    return sum(values) / len(values)


def has_points(landmarks, indexes) -> bool:
    return all(index in landmarks for index in indexes)
