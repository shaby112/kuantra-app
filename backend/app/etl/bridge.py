import asyncio
import threading
from typing import Coroutine, Any, TypeVar
import concurrent.futures

T = TypeVar("T")

class AsyncBridge:
    """
    Manages a dedicated background thread with its own asyncio event loop.
    This allows synchronous DLT resources to safely call asynchronous 
    database drivers (asyncpg) without event loop conflicts.
    """
    _instance = None
    _lock = threading.Lock()

    def __init__(self):
        self.loop = asyncio.new_event_loop()
        self.thread = threading.Thread(target=self._run_loop, daemon=True)
        self.thread.start()

    def _run_loop(self):
        asyncio.set_event_loop(self.loop)
        self.loop.run_forever()

    @classmethod
    def get_instance(cls) -> "AsyncBridge":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    def run_async(self, coro: Coroutine[Any, Any, T]) -> T:
        """Run a coroutine in the background loop and wait for the result."""
        future = asyncio.run_coroutine_threadsafe(coro, self.loop)
        return future.result()

    async def run_in_executor(self, func, *args):
        """Helper to run synchronous code within the bridge loop (if needed)."""
        return await self.loop.run_in_executor(None, func, *args)

# Global bridge instance
bridge = AsyncBridge.get_instance()
