"""Tests for APSales runtime foundation (APSALES-001)."""

import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from apsales_runtime.config import ModelRouter, load_apsales_runtime_config
from apsales_runtime.events import (
    EVENT_INQUIRY_RECEIVED,
    ALL_EVENT_TYPES,
    EventBus,
)
from apsales_runtime.lifecycle import AgentLifecycle
from apsales_runtime.paths import reconfigure_paths
from apsales_runtime.scheduler import Scheduler
from apsales_runtime.task_queue import TaskQueue
from apsales_runtime.tools import ToolFramework


class APSalesRuntimeConfigTests(unittest.TestCase):
    def test_load_default_config(self) -> None:
        cfg = load_apsales_runtime_config()
        self.assertEqual(cfg["agent_id"], "apsales")
        self.assertIn("follow_up_24h", cfg["scheduler"]["rules"])

    def test_model_failover(self) -> None:
        router = ModelRouter({"models": {"primary": "a", "fallback": "b", "failover_on_errors": 2}})
        self.assertEqual(router.resolve(), "a")
        router.record_error()
        self.assertEqual(router.resolve(), "a")
        router.record_error()
        self.assertEqual(router.resolve(), "b")
        router.record_success()
        self.assertEqual(router.resolve(), "a")


class APSalesEventBusTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        reconfigure_paths(Path(self.tmp.name))
        self.bus = EventBus()
        self.received: list[str] = []
        self.bus.subscribe(EVENT_INQUIRY_RECEIVED, lambda e: self.received.append(e.event_type))

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_publish_persists_and_dispatches(self) -> None:
        event = self.bus.publish(EVENT_INQUIRY_RECEIVED, {"channel": "email"})
        self.assertEqual(self.received, [EVENT_INQUIRY_RECEIVED])
        replay = self.bus.replay(limit=1)
        self.assertEqual(replay[0].event_id, event.event_id)

    def test_all_event_types_defined(self) -> None:
        self.assertEqual(len(ALL_EVENT_TYPES), 11)


class APSalesTaskQueueTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        reconfigure_paths(Path(self.tmp.name))
        self.queue = TaskQueue(max_retries=2)

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_enqueue_and_complete(self) -> None:
        task = self.queue.enqueue("inquiry", {"text": "hello"})
        self.assertEqual(task["status"], "pending")
        claimed = self.queue.claim_next(batch_size=1)
        self.assertEqual(len(claimed), 1)
        done = self.queue.complete(task["task_id"])
        self.assertEqual(done["status"], "completed")

    def test_recover_processing(self) -> None:
        task = self.queue.enqueue("follow_up", {})
        path = Path(self.tmp.name) / "queue" / f"{task['task_id']}.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        data["status"] = "processing"
        path.write_text(json.dumps(data), encoding="utf-8")
        self.assertEqual(self.queue.recover_pending(), 1)


class APSalesSchedulerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        reconfigure_paths(Path(self.tmp.name))
        self.queue = TaskQueue()
        cfg = load_apsales_runtime_config()
        self.scheduler = Scheduler(cfg, self.queue)

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_tick_enqueues_due_items(self) -> None:
        past = datetime.now(timezone.utc) - timedelta(hours=25)
        record = self.scheduler.schedule("follow_up_24h", {"customer": "test"}, base_time=past)
        self.assertEqual(record["status"], "scheduled")
        enqueued = self.scheduler.tick()
        self.assertEqual(len(enqueued), 1)
        self.assertEqual(enqueued[0]["task_type"], "follow_up")


class APSalesToolFrameworkTests(unittest.TestCase):
    def test_stub_tools_registered(self) -> None:
        fw = ToolFramework(enabled=["email", "browser", "search", "pricing", "translation"])
        fw.bootstrap()
        health = fw.health()
        for name in ("email", "browser", "search"):
            self.assertTrue(health["tools"][name]["registered"])


class APSalesLifecycleTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        reconfigure_paths(Path(self.tmp.name))

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_startup_and_health(self) -> None:
        lifecycle = AgentLifecycle()
        health = lifecycle.startup()
        self.assertEqual(health.status, "running")
        monitored = lifecycle.monitor_health()
        self.assertIn("total", monitored.queue_summary)


if __name__ == "__main__":
    unittest.main()
