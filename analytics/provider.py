"""Compose analytics metric bundles for consumers (APSALES-110+)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from analytics.metrics import opportunity as opportunity_metrics
from analytics.metrics import traffic_source as traffic_metrics


def get_sales_pipeline_metrics() -> dict[str, Any]:
    data = opportunity_metrics.compute_sales_pipeline_metrics()
    data["generated_at"] = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    return data


def get_traffic_metrics() -> dict[str, Any]:
    data = traffic_metrics.compute_traffic_metrics()
    data["generated_at"] = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    return data


def get_dashboard_bundle() -> dict[str, Any]:
    return {
        "sales_pipeline": get_sales_pipeline_metrics(),
        "traffic": get_traffic_metrics(),
    }
