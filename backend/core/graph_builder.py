import networkx as nx


def build_crash_graph(analyses: list[dict]) -> dict:
    G = nx.DiGraph()

    for a in analyses:
        node_id = f"crash_{a.get('id')}"
        G.add_node(
            node_id,
            root_cause=a.get("root_cause", "Unknown"),
            severity=a.get("severity", "Info"),
            cvss=a.get("cvss_score", 0),
        )

        resolved = a.get("cve_id")
        if resolved:
            cve_node = f"cve_{resolved}"
            G.add_node(cve_node, type="cve", id=resolved)
            G.add_edge(node_id, cve_node, relation="resolves_to")

    return {
        "nodes": [{"id": n, **G.nodes[n]} for n in G.nodes()],
        "edges": [{"source": u, "target": v, **d} for u, v, d in G.edges(data=True)],
    }
