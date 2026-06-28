from drain3 import TemplateMiner
from drain3.template_miner_config import TemplateMinerConfig

_config = TemplateMinerConfig()
_config.profiling_enabled = False
_config.drain_sim_th = 0.5
_config.drain_depth = 4

_miner = None


def _get_miner():
    global _miner
    if _miner is None:
        _miner = TemplateMiner(config=_config)
    return _miner


def parse_stack_trace(stack_trace_lines: list[str]) -> dict:
    miner = _get_miner()
    clusters = {}

    for line in stack_trace_lines:
        if not line.strip():
            continue
        result = miner.add_log_message(line)
        if not isinstance(result, dict):
            continue
        template = result.get("template", line)
        cluster_id = result.get("cluster_id", 0)

        if cluster_id not in clusters:
            clusters[cluster_id] = {
                "template": template,
                "count": 0,
                "samples": [],
            }
        clusters[cluster_id]["count"] += 1
        if len(clusters[cluster_id]["samples"]) < 3:
            clusters[cluster_id]["samples"].append(line)

    return {
        "total_frames": len(stack_trace_lines),
        "unique_templates": len(clusters),
        "clusters": list(clusters.values()),
    }
