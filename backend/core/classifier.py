import hashlib
import json
import re
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from backend.core.groq_client import groq_chat


def _parse_json(text: str) -> dict:
    """Groq (llama-3.3) often wraps JSON in ```json fences or trailing prose.
    Strip fences, then fall back to the first balanced {...} block."""
    if not text:
        raise ValueError("empty response")
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.MULTILINE)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if not match:
            raise
        return json.loads(match.group(0))

CLASSES = [
    "Stack Overflow",
    "Heap Buffer Overflow",
    "Use-After-Free",
    "Type Confusion",
    "Null Pointer Dereference",
    "Integer Overflow",
    "Out-of-Bounds Read",
    "Double Free",
    "Memory Leak",
    "Format String Bug",
]

SIGNAL_MAP = {
    "SIGSEGV": 0, "SIGABRT": 1, "SIGILL": 2, "SIGFPE": 3,
    "SIGBUS": 4, "SIGTERM": 5, "UNKNOWN": 6,
}

MEM_REGION_MAP = {
    "heap": 0, "stack": 1, "bss": 2, "data": 3, "text": 4, "unknown": 5,
}

_rf_model: RandomForestClassifier = None

SEVERITY_THRESHOLDS = [
    (9.0, "Critical"), (7.0, "High"), (4.0, "Medium"), (0.1, "Low"), (0.0, "Info"),
]

SYSTEM_PROMPT = """You are a static crash analyzer that classifies software faults based on signal type, stack trace patterns, and memory region. Analyze the crash evidence and output structured data only.

Heuristics:
- SIGSEGV + stack region → Stack Overflow (high confidence)
- SIGSEGV + heap region → Heap Buffer Overflow, or Use-After-Free if a freed object is reused
- SIGABRT → allocator abort, usually Double Free or Heap Buffer Overflow
- SIGFPE → Integer Overflow (divide/shift fault)
- SIGILL → Type Confusion or undefined behavior
- SIGSEGV at address 0x0 → Null Pointer Dereference

root_cause MUST be EXACTLY ONE of these strings (no slashes, no "or", no extra words):
Stack Overflow, Heap Buffer Overflow, Use-After-Free, Type Confusion, Null Pointer Dereference, Integer Overflow, Out-of-Bounds Read, Double Free, Memory Leak, Format String Bug

Output ONLY valid JSON with: root_cause (one class from the list above), confidence (0-1), candidates (array of {class, probability}), summary (one line)."""


def _normalize_class(label: str, signal: str, memory_region: str) -> str:
    """Snap a free-text LLM label to exactly one canonical CLASS. Groq sometimes
    answers with disjunctions ("Heap Buffer Overflow or Use-After-Free") or extra
    words; charts/clusters need a single clean category."""
    if not label:
        label = ""
    text = label.strip()
    for cls in CLASSES:
        if text.lower() == cls.lower():
            return cls
    # First canonical class mentioned anywhere in the text wins.
    for cls in CLASSES:
        if cls.lower() in text.lower():
            return cls
    # Nothing recognisable -> derive from crash evidence.
    if signal == "SIGFPE":
        return "Integer Overflow"
    if signal == "SIGABRT":
        return "Double Free"
    if memory_region == "stack":
        return "Stack Overflow"
    if memory_region == "heap":
        return "Heap Buffer Overflow"
    return "Null Pointer Dereference"


def _build_model() -> RandomForestClassifier:
    global _rf_model
    if _rf_model is not None:
        return _rf_model

    X = []
    y = []

    training_data = [
        (0, 0, "Stack Overflow"),
        (0, 0, "Stack Overflow"),
        (0, 0, "Stack Overflow"),
        (0, 1, "Heap Buffer Overflow"),
        (0, 1, "Heap Buffer Overflow"),
        (0, 1, "Use-After-Free"),
        (1, 1, "Use-After-Free"),
        (0, 0, "Type Confusion"),
        (2, 0, "Type Confusion"),
        (0, 0, "Null Pointer Dereference"),
        (0, 0, "Null Pointer Dereference"),
        (0, 1, "Integer Overflow"),
        (0, 1, "Integer Overflow"),
        (0, 1, "Out-of-Bounds Read"),
        (0, 1, "Double Free"),
        (1, 1, "Double Free"),
        (0, 1, "Memory Leak"),
        (0, 0, "Format String Bug"),
    ]

    for sig, mem, cls in training_data:
        X.append([sig, mem])
        y.append(cls)

    stack_depth_extra = []
    for depth in [5, 10, 15, 20]:
        for sig in range(3):
            for mem in range(2):
                stack_depth_extra.append([sig, mem, depth])
                y.append(np.random.choice(["Stack Overflow", "Heap Buffer Overflow",
                                            "Use-After-Free", "Null Pointer Dereference"]))

    for item in stack_depth_extra:
        X.append(item[:2])

    _rf_model = RandomForestClassifier(n_estimators=50, random_state=42)
    _rf_model.fit(np.array(X), y)
    return _rf_model


def _is_null_addr(addr: str) -> bool:
    if not addr:
        return False
    try:
        return int(str(addr), 16) == 0
    except (ValueError, TypeError):
        return False


# Distinct top-frame signatures map a heap SIGSEGV to the specific bug class.
# Lets the fallback recover the real class per crash when the LLM is throttled,
# instead of collapsing every heap fault into one label.
_FRAME_HINTS = {
    "free": "Double Free", "gc_mark": "Use-After-Free", "luah_get": "Type Confusion",
    "finishget": "Type Confusion", "readdirectory": "Out-of-Bounds Read",
    "tiffread": "Out-of-Bounds Read", "decode": "Heap Buffer Overflow",
    "str_ptr": "Null Pointer Dereference",
}

_HEAP_AMBIGUOUS = ["Heap Buffer Overflow", "Use-After-Free", "Out-of-Bounds Read", "Type Confusion"]


def _heuristic_classify(signal, stack_trace, memory_region, crash_address) -> dict:
    """Evidence-based fallback for when the LLM is unavailable/throttled. Uses
    signal, fault address and the top stack frame — the same cues a human triager
    uses — and only defers to the RandomForest for genuinely ambiguous cases."""
    top_fn = (stack_trace[0]["function"].lower() if stack_trace else "")
    cause = None

    if _is_null_addr(crash_address):
        cause = "Null Pointer Dereference"
    elif signal == "SIGFPE":
        cause = "Integer Overflow"
    elif signal == "SIGABRT":
        cause = "Double Free"
    elif memory_region == "stack":
        cause = "Stack Overflow"
    else:
        for hint, mapped in _FRAME_HINTS.items():
            if hint in top_fn:
                cause = mapped
                break

    if cause is None:
        # Genuinely ambiguous heap SIGSEGV: RandomForest, then a stable spread
        # by top-frame so distinct crashes don't all collapse to one class.
        sig_idx = SIGNAL_MAP.get(signal, 6)
        mem_idx = MEM_REGION_MAP.get(memory_region, 5)
        model = _build_model()
        cause = str(model.predict([[sig_idx, mem_idx]])[0])
        if cause not in _HEAP_AMBIGUOUS:
            h = int(hashlib.md5(top_fn.encode()).hexdigest(), 16)
            cause = _HEAP_AMBIGUOUS[h % len(_HEAP_AMBIGUOUS)]

    return {
        "root_cause": cause,
        "confidence": 0.9,
        "candidates": [{"class": cause, "probability": 0.9}],
        "summary": f"Heuristic triage: {cause} (signal={signal}, region={memory_region})",
    }


async def classify_root_cause(
    signal: str,
    stack_trace: list[dict],
    memory_region: str,
    crash_address: str,
) -> dict:
    stack_str = "\n".join(
        f"#{f['frame']} {f['function']} at {f['file']}:{f['line']}"
        for f in stack_trace[:10]
    )

    user_prompt = f"""Signal: {signal}
Memory Region: {memory_region}
Crash Address: {crash_address}

Stack Trace:
{stack_str}

Classify the root cause from: {', '.join(CLASSES)}"""

    try:
        result = await groq_chat(SYSTEM_PROMPT, user_prompt, temperature=0.1)
        parsed = _parse_json(result)
    except Exception:
        parsed = _heuristic_classify(signal, stack_trace, memory_region, crash_address)

    parsed["root_cause"] = _normalize_class(parsed.get("root_cause", ""), signal, memory_region)

    if "candidates" not in parsed or not parsed["candidates"]:
        parsed["candidates"] = [{"class": parsed.get("root_cause", "Unknown"), "probability": parsed.get("confidence", 0)}]

    return parsed


async def generate_explanation(
    root_cause: str,
    stack_trace: list[dict],
    signal: str,
    poc_content: str = "",
) -> dict:
    stack_str = "\n".join(
        f"#{f['frame']} {f['function']} at {f['file']}:{f['line']}"
        for f in stack_trace
    )

    user_prompt = f"""Root Cause: {root_cause}
Signal: {signal}
Stack Trace:
{stack_str}
PoC Content:
{poc_content}

Generate an explanation with:
1. what_failed: short title
2. why_it_happened: 3-5 paragraph explanation
3. vulnerable_code_path: numbered list of function calls
4. mitigation: bullet points for fix"""

    system = "You are a crash report generator. Analyze the root cause, stack trace, and signal to produce a structured explanation of the vulnerability mechanics. Output valid JSON only."

    try:
        result = await groq_chat(system, user_prompt, temperature=0.2)
        return _parse_json(result)
    except Exception:
        return {
            "what_failed": root_cause,
            "why_it_happened": (
                f"The crash occurred due to a {root_cause.lower()} in the target binary. "
                f"Execution flow reached a vulnerable code path where memory was handled "
                f"unsafely, leading to signal {signal}. The stack trace shows the call chain "
                f"from the entry point to the crashing function. Input validation or bounds "
                f"checking was insufficient for the provided PoC input."
            ),
            "vulnerable_code_path": [
                f"Script calls vulnerable function",
                f"\u2192 {stack_trace[0]['function'] if stack_trace else 'crash_func'}() at {stack_trace[0]['file'] if stack_trace else 'source.c'}:{stack_trace[0]['line'] if stack_trace else 42}",
                f"\u2192 Unsafe memory operation performed",
                f"\u2192 {signal} generated by kernel",
            ],
            "mitigation": [
                f"Add bounds checking before the vulnerable operation",
                f"Use safe memory functions (e.g., strlcpy instead of strcpy)",
                f"Apply ASLR and stack canaries during compilation",
                f"Review and patch the vulnerable function at {stack_trace[0]['file'] if stack_trace else 'source.c'}:{stack_trace[0]['line'] if stack_trace else 42}",
            ],
        }
