import re
import httpx
from backend.core.groq_client import groq_chat
from backend.core.cache import nvd_cache

NVD_BASE = "https://services.nvd.nist.gov/rest/json/cves/2.0"

_CVE_IN_TEXT = re.compile(r"cve[-_\s]?(\d{4})[-_\s]?(\d{4,7})", re.IGNORECASE)


def extract_cve_id(text: str) -> str | None:
    """Pull a CVE id out of free text (e.g. a dataset folder name like
    '20 libtiff cve-2017-7595'). The dataset encodes the ground-truth CVE in
    the folder, so this is far more accurate than keyword matching."""
    if not text:
        return None
    m = _CVE_IN_TEXT.search(text)
    if m:
        return f"CVE-{m.group(1)}-{m.group(2)}"
    return None


async def fetch_cve_details(cve_id: str) -> dict:
    cached = nvd_cache.get(cve_id)
    if cached:
        return cached
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            resp = await client.get(f"{NVD_BASE}?cveId={cve_id}")
            resp.raise_for_status()
            data = resp.json()

            vuln = data.get("vulnerabilities", [{}])[0].get("cve", {})
            descriptions = vuln.get("descriptions", [])
            description = next(
                (d["value"] for d in descriptions if d["lang"] == "en"),
                "No description available",
            )

            metrics = vuln.get("metrics", {})
            cvss_data = (
                metrics.get("cvssMetricV31", [{}])[0]
                .get("cvssData", {})
            )

            sev_raw = cvss_data.get("baseSeverity", "")
            sev = sev_raw.capitalize() if sev_raw else "Info"
            result = {
                "cve_id": cve_id,
                "description": description,
                "published": vuln.get("published"),
                "modified": vuln.get("lastModified"),
                "cvss_score": cvss_data.get("baseScore"),
                "cvss_vector": cvss_data.get("vectorString"),
                "severity": sev,
                "references": [
                    r.get("url") for r in vuln.get("references", [])
                ],
                "source": "nvd",
            }
            nvd_cache.set(cve_id, result)
            return result
        except Exception:
            result = {
                "cve_id": cve_id,
                "description": "Could not fetch from NVD API.",
                "source": "error",
            }
            nvd_cache.set(cve_id, result)
            return result


async def _nvd_keyword_search(keywords: str) -> str | None:
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            resp = await client.get(
                f"{NVD_BASE}?keywordSearch={keywords}&resultsPerPage=5"
            )
            resp.raise_for_status()
            data = resp.json()
            vulns = data.get("vulnerabilities", [])
            if vulns:
                return vulns[0].get("cve", {}).get("id")
        except Exception:
            pass
    return None


async def match_cve_from_description(description: str) -> str:
    if not description or description == "Classification failed":
        return ""

    try:
        keywords = description.split()[:5]
        keyword_str = "+".join(k for k in keywords if len(k) > 3)
        if keyword_str:
            result = await _nvd_keyword_search(keyword_str)
            if result:
                return result
    except Exception:
        pass

    try:
        prompt = (
            f"Given this crash description, identify the most likely CVE ID (e.g., CVE-2023-1234). "
            f"Return ONLY the CVE ID, or 'NONE' if no match exists.\n\nDescription: {description}"
        )
        result = await groq_chat(
            "You are a CVE matching assistant. Respond only with a CVE ID or NONE.",
            prompt,
            temperature=0.1,
            max_tokens=50,
        )
        result = result.strip()
        if result.startswith("CVE-") and result != "NONE":
            return result
    except Exception:
        pass

    return ""
