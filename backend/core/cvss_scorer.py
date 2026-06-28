import math

SEVERITY_THRESHOLDS = [
    (9.0, "Critical"),
    (7.0, "High"),
    (4.0, "Medium"),
    (0.1, "Low"),
    (0.0, "Info"),
]

ROOT_CAUSE_SCORES = {
    "Stack Overflow": (7.5, "AV:L/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"),
    "Heap Buffer Overflow": (8.8, "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"),
    "Use-After-Free": (8.1, "AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:H"),
    "Type Confusion": (7.8, "AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:H"),
    "Null Pointer Dereference": (6.5, "AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"),
    "Integer Overflow": (7.3, "AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:H"),
    "Out-of-Bounds Read": (7.5, "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N"),
    "Double Free": (7.5, "AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:H"),
    "Memory Leak": (5.3, "AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L"),
    "Format String Bug": (7.5, "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"),
}


def calculate_cvss(root_cause: str, confidence: float) -> dict:
    base_score, vector = ROOT_CAUSE_SCORES.get(
        root_cause, (5.0, "AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L")
    )

    adjusted_score = round(base_score * (0.5 + confidence * 0.5), 1)

    severity = "Info"
    for threshold, label in SEVERITY_THRESHOLDS:
        if adjusted_score >= threshold:
            severity = label
            break

    return {
        "score": adjusted_score,
        "vector": vector,
        "severity": severity,
    }
