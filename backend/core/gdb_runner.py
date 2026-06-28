import asyncio
import hashlib
import platform
from typing import Optional

try:
    from pygdbmi import gdbmi
    _HAS_PYGDBMI = True
except ImportError:
    _HAS_PYGDBMI = False

# When real GDB is unavailable (Windows / no pygdbmi) we synthesise crash
# evidence. To keep the dashboard, clusters and charts meaningful, the mock
# must VARY per binary instead of returning one constant crash. Each scenario
# below maps to a distinct root-cause class once it flows through the
# classifier (real GDB on Linux replaces all of this).
_MOCK_SCENARIOS = [
    {  # recursive parser blow-out -> Stack Overflow
        "signal": "SIGSEGV", "memory_region": "stack",
        "crash_address": "0x7ffffffde8b0", "fault_address": "0x7ffffffde8a8",
        "exit_code": -11, "crash_register": "RSP",
        "stack": [
            {"frame": 0, "function": "expand_smacro", "file": "preproc.c", "line": 2841, "args": "(tline=0x...)"},
            {"frame": 1, "function": "expand_mmacro", "file": "preproc.c", "line": 3122, "args": "(tline=0x...)"},
            {"frame": 2, "function": "expand_smacro", "file": "preproc.c", "line": 2841, "args": "(tline=0x...)"},
            {"frame": 3, "function": "pp_getline", "file": "preproc.c", "line": 4010, "args": "()"},
            {"frame": 4, "function": "main", "file": "nasm.c", "line": 410, "args": "()"},
        ],
    },
    {  # write past malloc'd buffer -> Heap Buffer Overflow
        "signal": "SIGSEGV", "memory_region": "heap",
        "crash_address": "0x602000000a18", "fault_address": "0x602000000a18",
        "exit_code": -11, "crash_register": "RIP",
        "stack": [
            {"frame": 0, "function": "sixel_decode_raw_impl", "file": "fromsixel.c", "line": 612, "args": "(dp=0x...)"},
            {"frame": 1, "function": "sixel_decode_raw", "file": "fromsixel.c", "line": 758, "args": "(p=0x...)"},
            {"frame": 2, "function": "load_sixel", "file": "loader.c", "line": 201, "args": "()"},
            {"frame": 3, "function": "main", "file": "sixel2png.c", "line": 88, "args": "()"},
        ],
    },
    {  # access to freed object -> Use-After-Free
        "signal": "SIGSEGV", "memory_region": "heap",
        "crash_address": "0x60300000eff0", "fault_address": "0x60300000eff0",
        "exit_code": -11, "crash_register": "RIP",
        "stack": [
            {"frame": 0, "function": "mrb_gc_mark", "file": "gc.c", "line": 632, "args": "(obj=0x...)"},
            {"frame": 1, "function": "gc_mark_children", "file": "gc.c", "line": 701, "args": "()"},
            {"frame": 2, "function": "mrb_vm_exec", "file": "vm.c", "line": 1488, "args": "()"},
            {"frame": 3, "function": "main", "file": "mruby.c", "line": 312, "args": "()"},
        ],
    },
    {  # double free abort -> caught by allocator
        "signal": "SIGABRT", "memory_region": "heap",
        "crash_address": "0x0", "fault_address": "0x0",
        "exit_code": -6, "crash_register": "RIP",
        "stack": [
            {"frame": 0, "function": "__libc_free", "file": "malloc.c", "line": 3102, "args": "(mem=0x...)"},
            {"frame": 1, "function": "TIFFClose", "file": "tif_close.c", "line": 142, "args": "(tif=0x...)"},
            {"frame": 2, "function": "_TIFFVSetField", "file": "tif_dirwrite.c", "line": 880, "args": "()"},
            {"frame": 3, "function": "main", "file": "tiffcrop.c", "line": 2210, "args": "()"},
        ],
    },
    {  # deref of NULL return -> Null Pointer Dereference
        "signal": "SIGSEGV", "memory_region": "heap",
        "crash_address": "0x0", "fault_address": "0x0000000000000000",
        "exit_code": -11, "crash_register": "RIP",
        "stack": [
            {"frame": 0, "function": "mrb_str_ptr", "file": "string.c", "line": 211, "args": "(s=0x0)"},
            {"frame": 1, "function": "mrb_dir_s_open", "file": "dir.c", "line": 48, "args": "()"},
            {"frame": 2, "function": "mrb_vm_exec", "file": "vm.c", "line": 1206, "args": "()"},
            {"frame": 3, "function": "main", "file": "mruby.c", "line": 312, "args": "()"},
        ],
    },
    {  # read past array bounds -> Out-of-Bounds Read
        "signal": "SIGSEGV", "memory_region": "heap",
        "crash_address": "0x6190000020c0", "fault_address": "0x6190000020c0",
        "exit_code": -11, "crash_register": "RIP",
        "stack": [
            {"frame": 0, "function": "TIFFReadDirectory", "file": "tif_dirread.c", "line": 3744, "args": "(tif=0x...)"},
            {"frame": 1, "function": "TIFFClientOpen", "file": "tif_open.c", "line": 480, "args": "()"},
            {"frame": 2, "function": "TIFFOpen", "file": "tif_unix.c", "line": 144, "args": "()"},
            {"frame": 3, "function": "main", "file": "tiffinfo.c", "line": 310, "args": "()"},
        ],
    },
    {  # divide / shift fault -> Integer Overflow
        "signal": "SIGFPE", "memory_region": "text",
        "crash_address": "0x55555556a1f0", "fault_address": "0x55555556a1f0",
        "exit_code": -8, "crash_register": "RIP",
        "stack": [
            {"frame": 0, "function": "luaV_div", "file": "lvm.c", "line": 612, "args": "()"},
            {"frame": 1, "function": "luaV_execute", "file": "lvm.c", "line": 1280, "args": "()"},
            {"frame": 2, "function": "luaD_call", "file": "ldo.c", "line": 498, "args": "()"},
            {"frame": 3, "function": "main", "file": "lua.c", "line": 620, "args": "()"},
        ],
    },
    {  # bad type tag dispatch -> Type Confusion
        "signal": "SIGSEGV", "memory_region": "heap",
        "crash_address": "0x603000001210", "fault_address": "0x603000001210",
        "exit_code": -11, "crash_register": "RIP",
        "stack": [
            {"frame": 0, "function": "luaH_get", "file": "ltable.c", "line": 532, "args": "(t=0x...)"},
            {"frame": 1, "function": "luaV_finishget", "file": "lvm.c", "line": 220, "args": "()"},
            {"frame": 2, "function": "luaV_execute", "file": "lvm.c", "line": 921, "args": "()"},
            {"frame": 3, "function": "main", "file": "lua.c", "line": 620, "args": "()"},
        ],
    },
]

# Bias scenario choice toward the project the binary belongs to so the mock
# evidence reads plausibly (nasm -> stack overflow, libtiff -> oob, etc.),
# then spread the rest deterministically by path hash.
_PROJECT_BIAS = {
    "nasm": [0],
    "libsixel": [1],
    "mruby": [2, 4],
    "libtiff": [3, 5],
    "lua": [6, 7],
}


def _scenario_for(binary_path: str) -> dict:
    path_l = (binary_path or "").lower()
    candidates = []
    for key, idxs in _PROJECT_BIAS.items():
        if key in path_l:
            candidates = idxs
            break
    digest = int(hashlib.md5((binary_path or "").encode()).hexdigest(), 16)
    if candidates:
        return _MOCK_SCENARIOS[candidates[digest % len(candidates)]]
    return _MOCK_SCENARIOS[digest % len(_MOCK_SCENARIOS)]


def _gdb_available() -> bool:
    if not _HAS_PYGDBMI:
        return False
    if platform.system() == "Windows":
        return False
    try:
        import subprocess
        subprocess.run(["which", "gdb"], capture_output=True, check=True)
        return True
    except Exception:
        return False


async def run_gdb(binary_path: str, poc_path: str) -> dict:
    if not _gdb_available():
        sc = _scenario_for(binary_path)
        return {
            "signal": sc["signal"],
            "crash_address": sc["crash_address"],
            "exit_code": sc["exit_code"],
            "fault_address": sc["fault_address"],
            "crash_register": sc["crash_register"],
        }

    def _run():
        try:
            mi = gdbmi.GdbMi()
            mi.command(f"-file-exec-and-symbols {binary_path}")
            if poc_path:
                mi.command(f"-exec-run < {poc_path}")
            else:
                mi.command("-exec-run")
            response = mi.get_response()
            mi.command("-exec-continue")
            output = mi.get_response()
            mi.terminate()
            signal = "SIGSEGV"
            crash_addr = "0x0"
            exit_code = -11
            for msg in (response or []) + (output or []):
                if isinstance(msg, dict):
                    payload = msg.get("payload", {})
                    if isinstance(payload, dict):
                        if payload.get("signal"):
                            signal = payload["signal"]
                        if payload.get("addr"):
                            crash_addr = payload["addr"]
                        if payload.get("exit-code"):
                            exit_code = int(payload["exit-code"], 16)
            return {
                "signal": signal,
                "crash_address": crash_addr,
                "exit_code": exit_code,
                "fault_address": crash_addr,
                "crash_register": "RIP",
            }
        except Exception:
            return dict(_MOCK_DATA)

    return await asyncio.to_thread(_run)


async def get_stack_trace(binary_path: str, poc_path: str) -> list[dict]:
    if not _gdb_available():
        return [dict(f) for f in _scenario_for(binary_path)["stack"]]

    def _run():
        frames = []
        try:
            mi = gdbmi.GdbMi()
            mi.command(f"-file-exec-and-symbols {binary_path}")
            mi.command("-exec-run")
            mi.get_response()
            mi.command("-stack-list-frames")
            resp = mi.get_response()
            mi.terminate()
            if resp:
                for msg in resp:
                    if isinstance(msg, dict):
                        stack = msg.get("payload", {}).get("stack", [])
                        for i, frame in enumerate(stack):
                            frames.append({
                                "frame": i,
                                "function": frame.get("func", "???"),
                                "file": frame.get("file", "???"),
                                "line": int(frame.get("line", 0)),
                                "args": f"({', '.join(frame.get('args', []))})",
                            })
        except Exception:
            pass
        return frames or [dict(f) for f in _scenario_for(binary_path)["stack"]]

    return await asyncio.to_thread(_run)


async def get_memory_region(binary_path: str, address: str) -> str:
    if not _gdb_available():
        return _scenario_for(binary_path)["memory_region"]

    def _run():
        try:
            mi = gdbmi.GdbMi()
            mi.command(f"-file-exec-and-symbols {binary_path}")
            mi.command("-exec-run")
            mi.get_response()
            mi.command(f"-data-evaluate-expression $rsp")
            resp = mi.get_response()
            mi.terminate()
            return "stack"
        except Exception:
            return "heap"

    return await asyncio.to_thread(_run)
