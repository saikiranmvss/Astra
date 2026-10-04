"""Root solving for event boundaries (bracket, then Illinois regula falsi)."""


def wrap180(x):
    return (x + 180.0) % 360.0 - 180.0


def solve(f, a, b, fa=None, fb=None, tol_days=0.1 / 86400.0, max_iter=80):
    """Root of f in [a, b] where f(a) and f(b) have opposite signs."""
    fa = f(a) if fa is None else fa
    fb = f(b) if fb is None else fb
    if fa == 0.0:
        return a
    if fb == 0.0:
        return b
    side = 0
    c = a
    for _ in range(max_iter):
        c = (a * fb - b * fa) / (fb - fa)
        fc = f(c)
        if abs(b - a) < tol_days or fc == 0.0:
            return c
        if fc * fb > 0:
            b, fb = c, fc
            if side == -1:
                fa *= 0.5
            side = -1
        else:
            a, fa = c, fc
            if side == 1:
                fb *= 0.5
            side = 1
        if abs(b - a) < tol_days:
            return (a + b) / 2.0
    return c


def secant_crossing(angle_at, target, t_guess, rate, tol_days=0.05 / 86400.0, max_iter=30):
    """Root of wrap180(angle(t) - target) near t_guess (rate in deg/day).

    Returns None if the iteration does not converge, so callers can fall
    back to bracketing.
    """
    t0 = t_guess
    g0 = wrap180(angle_at(t0) - target)
    t1 = t0 - g0 / rate
    g1 = wrap180(angle_at(t1) - target)
    for _ in range(max_iter):
        if g1 == 0.0 or abs(t1 - t0) < tol_days:
            return t1
        if g1 == g0:
            return None
        t2 = t1 - g1 * (t1 - t0) / (g1 - g0)
        if abs(t2 - t_guess) > 0.4 * 360.0 / max(abs(rate), 1e-9):
            return None
        t0, g0 = t1, g1
        t1 = t2
        g1 = wrap180(angle_at(t1) - target)
    return None


def angle_crossing(angle_at, target, t0, step, direction=1, max_steps=200):
    """First time from t0 (forward if direction=1, else backward) at which a
    monotonically increasing angle function passes `target` degrees.
    """
    def g(t):
        return wrap180(angle_at(t) - target)

    t_prev = t0
    g_prev = g(t0)
    for _ in range(max_steps):
        t_next = t_prev + direction * step
        g_next = g(t_next)
        if direction == 1:
            crossed = g_prev < 0.0 <= g_next and (g_next - g_prev) < 90.0
        else:
            crossed = g_next < 0.0 <= g_prev and (g_prev - g_next) < 90.0
        if crossed:
            lo, hi = (t_prev, t_next) if direction == 1 else (t_next, t_prev)
            glo, ghi = (g_prev, g_next) if direction == 1 else (g_next, g_prev)
            return solve(g, lo, hi, glo, ghi)
        t_prev, g_prev = t_next, g_next
    return None
