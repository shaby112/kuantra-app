"""
Sync Service - Orchestrates data synchronization operations.

Handles:
- Manual and scheduled syncs
- Progress tracking and status updates
- Error handling and retries
- Concurrent sync management
"""

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, AsyncGenerator
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import logger
from app.db.models import DbConnection, SyncConfig, SyncHistory, MDLVersion
from app.etl.pipeline import ETLPipeline
from app.etl.bridge import bridge
from app.utils.identifiers import connection_schema_name, to_uuid


class SyncJob:
    """Represents a running sync job."""
    
    def __init__(self, job_id: str, connection_id: str):
        self.job_id = job_id
        self.connection_id = connection_id
        self.status = "pending"
        self.progress = 0
        self.rows_synced = 0
        self.tables_completed: List[str] = []
        self.tables_pending: List[str] = []
        self.error: Optional[str] = None
        self.started_at = datetime.now(timezone.utc)
        self.completed_at: Optional[datetime] = None


class SyncService:
    """
    Service for managing data synchronization operations.
    
    Features:
    - Concurrent sync management with limits
    - Progress tracking and cancellation
    - Automatic retry on failure
    """
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self._jobs: Dict[str, SyncJob] = {}
        self._running_syncs: Dict[str, str] = {}  # connection_id -> job_id
        self._executor = ThreadPoolExecutor(
            max_workers=settings.ETL_MAX_CONCURRENT_SYNCS
        )
        self._initialized = True
        
        logger.info("SyncService initialized")

    def _normalize_table_key(self, schema: str, table: str) -> str:
        return table if schema == "public" else f"{schema}.{table}"

    def _build_model_name_map(self, models: List[Dict[str, Any]]) -> Dict[str, str]:
        name_map: Dict[str, str] = {}
        for m in models:
            full_name = m.get("name")
            if not full_name:
                continue
            short = full_name.split(".")[-1]
            name_map.setdefault(short, full_name)
            # Keep a direct identity mapping as well
            name_map.setdefault(full_name, full_name)
        return name_map

    def _extract_postgres_fk_relationships(self, shared_source, discovered_tables: List[str]) -> List[Dict[str, str]]:
        """Read FK metadata from source Postgres and return normalized relationships."""
        discovered_set = set(discovered_tables)
        query = """
            SELECT
                kcu.table_schema AS fk_schema,
                kcu.table_name AS fk_table,
                kcu.column_name AS fk_column,
                ccu.table_schema AS pk_schema,
                ccu.table_name AS pk_table,
                ccu.column_name AS pk_column
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
             AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage ccu
              ON ccu.constraint_name = tc.constraint_name
             AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
            ORDER BY kcu.table_schema, kcu.table_name
        """

        async def _fetch_fks():
            async with shared_source._get_connection() as conn:
                return await conn.fetch(query)

        rows = bridge.run_async(_fetch_fks())
        rels: List[Dict[str, str]] = []
        for r in rows:
            fk_table_key = self._normalize_table_key(r["fk_schema"], r["fk_table"])
            pk_table_key = self._normalize_table_key(r["pk_schema"], r["pk_table"])
            if fk_table_key not in discovered_set or pk_table_key not in discovered_set:
                continue
            rels.append({
                "fk_table": fk_table_key,
                "fk_column": r["fk_column"],
                "pk_table": pk_table_key,
                "pk_column": r["pk_column"],
            })
        return rels

    def _apply_source_fk_relationships_to_mdl(
        self,
        db: Session,
        source_fk_relationships: List[Dict[str, str]],
        change_summary: str,
    ) -> int:
        """Append source FK relationships into latest MDL as a new version."""
        if not source_fk_relationships:
            return 0

        current_mdl = db.query(MDLVersion).order_by(MDLVersion.version.desc()).first()
        if not current_mdl or not isinstance(current_mdl.content, dict):
            return 0

        content = dict(current_mdl.content)
        relationships = list(content.get("relationships", []))
        models = list(content.get("models", []))
        model_name_map = self._build_model_name_map(models)

        existing_keys = {
            (r.get("from"), r.get("from_column"), r.get("to"), r.get("to_column"))
            for r in relationships
        }

        appended = 0
        for rel in source_fk_relationships:
            pk_model = model_name_map.get(rel["pk_table"].split(".")[-1])
            fk_model = model_name_map.get(rel["fk_table"].split(".")[-1])
            if not pk_model or not fk_model:
                continue

            key = (pk_model, rel["pk_column"], fk_model, rel["fk_column"])
            if key in existing_keys:
                continue

            relationships.append({
                "name": f"{fk_model}_{rel['fk_column']}__{pk_model}_{rel['pk_column']}_srcfk",
                "from": pk_model,
                "from_column": rel["pk_column"],
                "to": fk_model,
                "to_column": rel["fk_column"],
                "join_type": "one_to_many",
                "condition": f"{pk_model}.{rel['pk_column']} = {fk_model}.{rel['fk_column']}",
                "confidence": 1.0,
                "method": "source_constraint",
            })
            existing_keys.add(key)
            appended += 1

        if appended == 0:
            return 0

        content["relationships"] = relationships
        new_mdl = MDLVersion(
            version=current_mdl.version + 1,
            content=content,
            user_overrides=current_mdl.user_overrides or {},
            created_by=None,
            change_summary=change_summary,
        )
        db.add(new_mdl)
        db.commit()
        return appended
    
    def get_job(self, job_id: str) -> Optional[SyncJob]:
        """Get a sync job by ID."""
        return self._jobs.get(job_id)
    
    def get_connection_job(self, connection_id: str) -> Optional[SyncJob]:
        """Get the current job for a connection."""
        job_id = self._running_syncs.get(connection_id)
        if job_id:
            return self._jobs.get(job_id)
        return None
    
    def is_syncing(self, connection_id: str) -> bool:
        """Check if a connection is currently syncing."""
        return connection_id in self._running_syncs
    
    async def start_sync(
        self,
        db: Session,
        connection: DbConnection,
        incremental: bool = True
    ) -> SyncJob:
        """
        Start a sync job for a connection.
        
        Args:
            db: Database session
            connection: The database connection to sync
            incremental: Whether to do incremental sync
            
        Returns:
            SyncJob instance for tracking progress
        """
        # Check if already syncing
        if self.is_syncing(str(connection.id)):
            existing_job = self.get_connection_job(str(connection.id))
            if existing_job:
                return existing_job
        
        # Create new job
        job_id = str(uuid.uuid4())
        job = SyncJob(job_id, connection.id)
        self._jobs[job_id] = job
        self._running_syncs[str(connection.id)] = job_id
        
        # Update sync config status
        sync_config = self._get_or_create_sync_config(db, connection.id)
        sync_config.last_sync_status = "running"
        db.commit()
        
        # Create sync history record
        history = SyncHistory(
            sync_config_id=sync_config.id,
            connection_id=connection.id,
            started_at=datetime.now(timezone.utc),
            status="running",
            is_incremental=incremental
        )
        db.add(history)
        db.commit()
        db.refresh(history)

        # Retrieve IDs to pass to background task
        history_id = history.id
        connection_id = str(connection.id)
        
        # Run sync in background
        # Note: We do NOT pass 'db' session as it will be closed.
        asyncio.create_task(
            self._run_sync_async(connection_id, job, history_id, incremental)
        )
        
        return job
    
    async def _run_sync_async(
        self,
        connection_id: str,
        job: SyncJob,
        history_id: str,
        incremental: bool
    ):
        """Run sync operation asynchronously with its own session."""
        from app.db.session import SessionLocal

        # Create a new session for this background task
        db = SessionLocal()
        try:
            # Re-fetch objects within this session
            history = db.query(SyncHistory).filter(SyncHistory.id == to_uuid(history_id)).first()
            connection = db.query(DbConnection).filter(DbConnection.id == to_uuid(connection_id)).first()
            
            if not history or not connection:
                logger.error("Sync background task failed: History or Connection not found")
                return

            job.status = "running"
            
            # 1. Initialize Pipeline
            pipeline = ETLPipeline(connection.id, connection.name)
            
            # CRITICAL: Full reset to avoid DuckDB constraint conflicts
            # DuckDB cannot add columns with NOT NULL/UNIQUE to existing tables,
            # so we must start fresh each sync to avoid accumulated schema drift
            try:
                logger.info("Performing full pipeline reset to avoid schema conflicts...")
                # Drop the dlt pipeline state completely
                pipeline._pipeline.drop()
                
                # Also drop the DuckDB schema for this connection to start fresh
                from app.services.duckdb_manager import DuckDBManager
                duckdb_manager = DuckDBManager()
                schema_name = connection_schema_name(connection.id)
                duckdb_manager.drop_schema(schema_name)
                logger.info(f"Pipeline and DuckDB schema '{schema_name}' reset successfully")
            except Exception as e:
                logger.warning(f"Reset warning (proceeding anyway): {e}")
            
            # Reinitialize the pipeline after reset
            pipeline = ETLPipeline(connection.id, connection.name)
            
            # 2. Get Source and Discover Tables
            from app.etl.sources.postgres import PostgresSource
            from app.etl.sources.mysql import MySQLSource
            
            if connection.connection_type == "postgres":
                shared_source = PostgresSource(connection)
            elif connection.connection_type == "mysql":
                shared_source = MySQLSource(connection)
            elif connection.connection_type == "file":
                await self._sync_file_connection(connection, job, db, history)
                return
            else:
                raise ValueError(f"Unsupported connection type: {connection.connection_type}")

            # 2. Discover Tables via bridge
            tables = bridge.run_async(shared_source.get_tables())
            logger.info(f"Discovered {len(tables)} tables for connection {connection.id}: {tables}")
            job.tables_pending = list(tables)

            source_fk_relationships: List[Dict[str, str]] = []
            if connection.connection_type == "postgres":
                try:
                    source_fk_relationships = self._extract_postgres_fk_relationships(shared_source, tables)
                    logger.info(
                        f"Detected {len(source_fk_relationships)} source FK constraints for connection {connection.id}"
                    )
                except Exception as fk_err:
                    logger.warning(f"Could not extract source FK constraints: {fk_err}")
            
            # 3. Bulk Discovery of PKs and Incremental Columns
            logger.info(f"Gathering metadata for {len(tables)} tables...")
            # Fetch all primary keys at once
            pk_query = """
                SELECT 
                    n.nspname as schema_name,
                    c.relname as table_name,
                    a.attname as pk_col
                FROM pg_index i
                JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
                JOIN pg_class c ON c.oid = i.indrelid
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE i.indisprimary
            """
            
            # Fetch all column info for incremental keys at once
            col_query = """
                SELECT table_schema, table_name, column_name
                FROM information_schema.columns
                WHERE column_name IN ('updated_at', 'modified_at', 'last_modified', 'created_at')
            """
            
            pks = {}
            inc_cols = {}

            if connection.connection_type == "postgres":
                def fetch_metadata():
                    async def _fetch():
                        async with shared_source._get_connection() as conn:
                            pk_rows = await conn.fetch(pk_query)
                            col_rows = await conn.fetch(col_query)
                            return pk_rows, col_rows
                    return bridge.run_async(_fetch())

                pk_rows, col_rows = fetch_metadata()
                for r in pk_rows:
                    full_name = r['table_name'] if r['schema_name'] == 'public' else f"{r['schema_name']}.{r['table_name']}"
                    pks[full_name] = r['pk_col']
                
                for r in col_rows:
                    full_name = r['table_name'] if r['table_schema'] == 'public' else f"{r['table_schema']}.{r['table_name']}"
                    if full_name not in inc_cols:
                        inc_cols[full_name] = r['column_name']

            # 4. Pre-compute row counts for large table detection
            logger.info(f"Pre-computing row counts for {len(tables)} tables...")
            table_row_counts = {}
            for table in tables:
                try:
                    count = bridge.run_async(shared_source.get_row_count(table))
                    table_row_counts[table] = count
                except Exception:
                    table_row_counts[table] = 0
            
            # Sort tables: small tables first, large tables last (better progress feedback)
            large_threshold = getattr(settings, 'ETL_LARGE_TABLE_THRESHOLD', 100000)
            small_tables = [t for t in tables if table_row_counts.get(t, 0) <= large_threshold]
            large_tables = [t for t in tables if table_row_counts.get(t, 0) > large_threshold]
            
            if large_tables:
                logger.info(f"Detected {len(large_tables)} large tables (>100K rows): {large_tables}")
            
            # Helper to create a wrapper generator for a table
            def make_wrapper_gen(t_name, src, row_count, inc_col):
                def sync_gen():
                    try:
                        aiterable = src.stream_table(t_name, incremental, cursor_column=inc_col, row_count=row_count)
                        while True:
                            try:
                                record = bridge.run_async(aiterable.__anext__())
                                yield record
                            except StopAsyncIteration:
                                break
                            except Exception as e:
                                logger.error(f"Error streaming table {t_name} via bridge: {e}")
                                raise
                    except Exception as e:
                        logger.error(f"Failed to initialize stream for {t_name}: {e}")
                        raise
                return sync_gen
            
            # 5. Batched Processing
            import functools
            main_loop = asyncio.get_event_loop()
            batch_size = getattr(settings, 'ETL_TABLES_PER_BATCH', 5)
            
            total_rows = 0
            completed_tables = []
            failed_tables = []
            
            # Helper to chunk tables into batches
            def chunked(lst, n):
                for i in range(0, len(lst), n):
                    yield lst[i:i + n]
            
            # Process small tables in batches
            small_batches = list(chunked(small_tables, batch_size))
            total_batches = len(small_batches) + len(large_tables)  # Large tables run individually
            batch_num = 0
            
            for batch in small_batches:
                batch_num += 1
                logger.info(f"Processing batch {batch_num}/{total_batches}: {len(batch)} tables ({batch})")
                
                try:
                    resources = []
                    for table in batch:
                        pk = pks.get(table)
                        incremental_col = inc_cols.get(table)
                        row_count = table_row_counts.get(table, 0)
                        
                        res = pipeline.create_resource(
                            table_name=table,
                            data_generator=make_wrapper_gen(table, shared_source, row_count, incremental_col)(),
                            primary_key=pk,
                            incremental_key=incremental_col if incremental else None
                        )
                        resources.append(res)
                    
                    load_info = await main_loop.run_in_executor(
                        None, functools.partial(pipeline._pipeline.run, resources)
                    )
                    completed_tables.extend(batch)
                    
                    # Update progress
                    job.tables_completed = completed_tables.copy()
                    job.tables_pending = [t for t in tables if t not in completed_tables and t not in failed_tables]
                    job.progress = int((len(completed_tables) / len(tables)) * 100)
                    
                    logger.info(f"Batch {batch_num} completed: {len(batch)} tables")
                    
                except Exception as e:
                    error_str = str(e)
                    recoverable_errors = [
                        "Adding columns with constraints not yet supported",
                        "ConstraintException", "CatalogException", "BinderException"
                    ]
                    
                    if any(err in error_str for err in recoverable_errors):
                        logger.warning(f"Batch {batch_num} hit DuckDB conflict, dropping pending packages...")
                        try:
                            pipeline._pipeline.drop_pending_packages()
                        except: pass
                        
                        # Retry once after cleanup
                        try:
                            resources = []
                            for table in batch:
                                pk = pks.get(table)
                                incremental_col = inc_cols.get(table)
                                row_count = table_row_counts.get(table, 0)
                                res = pipeline.create_resource(
                                    table_name=table,
                                    data_generator=make_wrapper_gen(table, shared_source, row_count, incremental_col)(),
                                    primary_key=pk,
                                    incremental_key=incremental_col if incremental else None
                                )
                                resources.append(res)
                            
                            load_info = await main_loop.run_in_executor(
                                None, functools.partial(pipeline._pipeline.run, resources)
                            )
                            completed_tables.extend(batch)
                            logger.info(f"Batch {batch_num} succeeded after retry")
                        except Exception as retry_e:
                            logger.error(f"Batch {batch_num} failed after retry: {retry_e}")
                            failed_tables.extend(batch)
                    else:
                        logger.error(f"Batch {batch_num} failed: {e}")
                        failed_tables.extend(batch)
            
            # Process large tables individually (more memory-safe)
            for table in large_tables:
                batch_num += 1
                row_count = table_row_counts.get(table, 0)
                logger.info(f"Processing large table {batch_num}/{total_batches}: {table} ({row_count:,} rows)")
                
                try:
                    pk = pks.get(table)
                    incremental_col = inc_cols.get(table)
                    
                    res = pipeline.create_resource(
                        table_name=table,
                        data_generator=make_wrapper_gen(table, shared_source, row_count, incremental_col)(),
                        primary_key=pk,
                        incremental_key=incremental_col if incremental else None
                    )
                    
                    load_info = await main_loop.run_in_executor(
                        None, functools.partial(pipeline._pipeline.run, [res])
                    )
                    completed_tables.append(table)
                    total_rows += row_count
                    
                    # Update progress
                    job.tables_completed = completed_tables.copy()
                    job.tables_pending = [t for t in tables if t not in completed_tables and t not in failed_tables]
                    job.progress = int((len(completed_tables) / len(tables)) * 100)
                    
                    logger.info(f"Large table {table} completed: {row_count:,} rows")
                    
                except Exception as e:
                    error_str = str(e)
                    recoverable_errors = [
                        "Adding columns with constraints not yet supported",
                        "ConstraintException", "CatalogException", "BinderException"
                    ]
                    
                    if any(err in error_str for err in recoverable_errors):
                        logger.warning(f"Large table {table} hit DuckDB conflict, dropping pending packages...")
                        try:
                            pipeline._pipeline.drop_pending_packages()
                        except: pass
                        
                        try:
                            res = pipeline.create_resource(
                                table_name=table,
                                data_generator=make_wrapper_gen(table, shared_source, row_count, incremental_col)(),
                                primary_key=pk,
                                incremental_key=incremental_col if incremental else None
                            )
                            load_info = await main_loop.run_in_executor(
                                None, functools.partial(pipeline._pipeline.run, [res])
                            )
                            completed_tables.append(table)
                            total_rows += row_count
                            logger.info(f"Large table {table} succeeded after retry")
                        except Exception as retry_e:
                            logger.error(f"Large table {table} failed after retry: {retry_e}")
                            failed_tables.append(table)
                    else:
                        logger.error(f"Large table {table} failed: {e}")
                        failed_tables.append(table)
            
            # Close the shared source
            try:
                bridge.run_async(shared_source.close())
            except:
                pass
            
            # Final stats
            job.rows_synced = sum(table_row_counts.get(t, 0) for t in completed_tables)
            job.tables_completed = completed_tables
            job.tables_pending = []
            job.progress = 100
            
            if failed_tables:
                logger.warning(f"Sync completed with {len(failed_tables)} failed tables: {failed_tables}")
            
            logger.info(
                f"Sync completed for connection {connection_id}: "
                f"{job.rows_synced:,} rows, {len(completed_tables)}/{len(tables)} tables"
            )
            
            # 5. Silver Layer & MDL Refresh
            from app.etl.silver_layer import silver_manager
            logger.info(f"Materializing Silver layer for connection {connection_id}")
            silver_result = silver_manager.materialize_connection(connection_id)
            
            from app.services.schema_service import schema_service
            logger.info(f"Triggering MDL refresh after sync for connection {connection_id}")
            schema_service.refresh_mdl(db)

            if source_fk_relationships:
                appended = self._apply_source_fk_relationships_to_mdl(
                    db,
                    source_fk_relationships,
                    change_summary=f"Import source FK constraints for connection {connection_id}",
                )
                logger.info(f"Applied {appended} source FK relationships to MDL for connection {connection_id}")

            # 6. Status Update
            job.status = "success"
            job.completed_at = datetime.now(timezone.utc)
            
            sync_config = db.query(SyncConfig).filter(SyncConfig.connection_id == connection.id).first()
            if sync_config:
                sync_config.last_sync_status = "success"
                sync_config.last_sync_at = datetime.now(timezone.utc)
                sync_config.rows_cached = job.rows_synced
                sync_config.tables_cached = job.tables_completed
                sync_config.last_error = None

            history.status = "success"
            history.completed_at = datetime.now(timezone.utc)
            history.rows_synced = job.rows_synced
            history.tables_synced = job.tables_completed

            # Duration calculation
            start_time = history.started_at
            if start_time and start_time.tzinfo is None:
                start_time = start_time.replace(tzinfo=timezone.utc)
            history.duration_seconds = (history.completed_at - start_time).total_seconds() if start_time else 0

            db.commit()

        except Exception as e:
            logger.error(f"Sync failed for connection {connection_id}: {e}", exc_info=True)
            job.status = "failed"
            job.error = str(e)
            job.completed_at = datetime.now(timezone.utc)
            
            # Update DB with failure
            try:
                db.rollback()
                sync_config = db.query(SyncConfig).filter(SyncConfig.connection_id == to_uuid(connection_id)).first()
                if sync_config:
                    sync_config.last_sync_status = "failed"
                    sync_config.last_error = str(e)
                history = db.query(SyncHistory).filter(SyncHistory.id == to_uuid(history_id)).first()
                if history:
                    history.status = "failed"
                    history.completed_at = datetime.now(timezone.utc)
                    history.error_message = str(e)
                    
                    # Duration calculation
                    start_time = history.started_at
                    if start_time and start_time.tzinfo is None:
                        start_time = start_time.replace(tzinfo=timezone.utc)
                    history.duration_seconds = (history.completed_at - start_time).total_seconds() if start_time else 0
                db.commit()
            except: pass
        finally:
            db.close()
            if connection_id in self._running_syncs:
                del self._running_syncs[connection_id]
    
    async def _sync_file_connection(self, connection: DbConnection, job: SyncJob, db, history):
        """Sync a file-based connection with proper status updates."""
        from app.etl.sources.files import FileSource
        from app.etl.silver_layer import silver_manager
        from app.services.schema_service import schema_service

        connection_id = str(connection.id)

        source = FileSource(connection.file_path)
        tables_data = source.extract()

        job.tables_pending = list(tables_data.keys())

        pipeline = ETLPipeline(connection.id, connection.name)
        result = pipeline.run_sync(tables_data, incremental=False)

        if result["status"] == "success":
            job.tables_completed = result["tables_synced"]
            job.rows_synced = result["rows_synced"]
            job.progress = 100
        else:
            raise Exception(result.get("error", "Unknown error"))

        # Silver layer
        try:
            silver_manager.materialize_connection(connection_id)
        except Exception as e:
            logger.warning(f"Silver layer materialization warning: {e}")

        # Status update — must happen BEFORE MDL refresh so this connection
        # is included in _get_synced_connection_ids() query
        job.status = "success"
        job.completed_at = datetime.now(timezone.utc)

        sync_config = db.query(SyncConfig).filter(SyncConfig.connection_id == connection.id).first()
        if sync_config:
            sync_config.last_sync_status = "success"
            sync_config.last_sync_at = datetime.now(timezone.utc)
            sync_config.rows_cached = job.rows_synced
            sync_config.tables_cached = job.tables_completed
            sync_config.last_error = None

        history.status = "success"
        history.completed_at = datetime.now(timezone.utc)
        history.rows_synced = job.rows_synced
        history.tables_synced = job.tables_completed

        start_time = history.started_at
        if start_time and start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=timezone.utc)
        history.duration_seconds = (history.completed_at - start_time).total_seconds() if start_time else 0

        db.commit()

        # MDL refresh — runs after status commit so all synced connections are visible
        try:
            schema_service.refresh_mdl(db)
        except Exception as e:
            logger.warning(f"MDL refresh warning: {e}")

        logger.info(
            f"File sync completed for connection {connection_id}: "
            f"{job.rows_synced} rows, {len(job.tables_completed)} tables"
        )
    
    async def _sync_database_connection(
        self,
        connection: DbConnection,
        job: SyncJob,
        incremental: bool
    ):
        """Sync a database connection (postgres/mysql)."""
        from app.etl.sources.postgres import PostgresSource
        from app.etl.sources.mysql import MySQLSource
        
        if connection.connection_type == "postgres":
            source = PostgresSource(connection)
        else:
            source = MySQLSource(connection)
        
        # Get all tables
        tables = await source.get_tables()
        logger.info(f"Discovered {len(tables)} tables for connection {connection.id}: {tables}")
        job.tables_pending = tables
        
        pipeline = ETLPipeline(connection.id, connection.name)
        
        all_data = {}
        primary_keys = {}
        
        for i, table in enumerate(tables):
            # Check cancellation
            if job.status == "cancelled":
                return

            try:
                data, pk = await source.extract_table(table, incremental)
                all_data[table] = data
                if pk:
                    primary_keys[table] = pk
                
                job.tables_completed.append(table)
                job.tables_pending.remove(table)
                job.progress = int((i + 1) / len(tables) * 100)
                
            except Exception as e:
                logger.warning(f"Failed to extract table {table}: {e}")
        
        # Run pipeline
        result = pipeline.run_sync(all_data, primary_keys, incremental)
        
        # Check cancellation after pipeline run
        if job.status == "cancelled":
             return

        if result["status"] == "success":
            job.rows_synced = result["rows_synced"]
            job.progress = 100
        else:
            raise Exception(result.get("error", "Unknown error"))
    
    async def _sync_mongodb_connection(
        self,
        connection: DbConnection,
        job: SyncJob,
        incremental: bool
    ):
        """Sync a MongoDB connection."""
        from app.etl.sources.mongodb import MongoDBSource
        
        source = MongoDBSource(connection)
        collections = await source.get_collections()
        
        job.tables_pending = collections
        
        pipeline = ETLPipeline(connection.id, connection.name)
        
        all_data = {}
        for i, collection in enumerate(collections):
            # Check cancellation
            if job.status == "cancelled":
                return

            try:
                data = await source.extract_collection(collection, incremental)
                all_data[collection] = data
                
                job.tables_completed.append(collection)
                job.tables_pending.remove(collection)
                job.progress = int((i + 1) / len(collections) * 100)
                
            except Exception as e:
                logger.warning(f"Failed to extract collection {collection}: {e}")
        
        # Check cancellation before load
        if job.status == "cancelled":
             return

        result = pipeline.run_sync(all_data, incremental=incremental)
        
        # Check cancellation after load
        if job.status == "cancelled":
             return
             
        if result["status"] == "success":
            job.rows_synced = result["rows_synced"]
            job.progress = 100
        else:
            raise Exception(result.get("error", "Unknown error"))
    
    def cancel_sync(self, connection_id: str) -> bool:
        """Cancel a running sync."""
        connection_key = str(connection_id)
        if connection_key not in self._running_syncs:
            return False
        
        job_id = self._running_syncs[connection_key]
        job = self._jobs.get(job_id)
        
        if job and job.status == "running":
            job.status = "cancelled"
            job.completed_at = datetime.now(timezone.utc)
            del self._running_syncs[connection_key]
            return True
        
        return False
    
    def _get_or_create_sync_config(self, db: Session, connection_id: str) -> SyncConfig:
        """Get or create sync config for a connection."""
        connection_uuid = to_uuid(connection_id)
        sync_config = db.query(SyncConfig).filter(
            SyncConfig.connection_id == connection_uuid
        ).first()
        
        if not sync_config:
            sync_config = SyncConfig(
                connection_id=connection_uuid,
                sync_interval_minutes=settings.DEFAULT_SYNC_INTERVAL_MINUTES
            )
            db.add(sync_config)
            db.commit()
            db.refresh(sync_config)
        
        return sync_config


# Global singleton instance
sync_service = SyncService()
