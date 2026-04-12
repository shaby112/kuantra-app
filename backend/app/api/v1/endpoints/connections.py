from typing import Any, List, Optional, Dict
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Body, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, model_validator

from app.api import deps
from app.db.models import User, DbConnection, QueryHistory
from app.utils.crypto import crypto_service
from app.services.connection_service import connection_service
from app.core.logging import logger
from app.services.duckdb_manager import duckdb_manager
from app.utils.identifiers import connection_schema_name
import asyncpg
import time
from datetime import datetime
import os
import shutil
from app.services.file_query_service import FileQueryService, UPLOAD_DIR
from fastapi import File, UploadFile

router = APIRouter()

# --- Pydantic Schemas ---


class ConnectionCreate(BaseModel):
    name: str = Field(..., min_length=1, description="A friendly nickname for this connection")
    # Mode 1: Params
    host: Optional[str] = None
    port: Optional[int] = 5432
    database_name: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    
    # Mode 2: URI
    connection_uri: Optional[str] = None

    # SSH Tunneling
    use_ssh_tunnel: bool = False
    ssh_host: Optional[str] = None
    ssh_port: int = 22
    ssh_username: Optional[str] = None


class ConnectionUpdate(BaseModel):
    name: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    database_name: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    connection_uri: Optional[str] = None
    # SSH Tunneling
    use_ssh_tunnel: Optional[bool] = None
    ssh_host: Optional[str] = None
    ssh_port: Optional[int] = None
    ssh_username: Optional[str] = None


class ConnectionResponse(BaseModel):
    id: UUID
    name: str
    host: Optional[str]
    port: Optional[int]
    database_name: Optional[str]
    username: Optional[str]
    connection_uri: Optional[str]
    connection_type: str
    file_path: Optional[str]
    
    # SSH Tunneling
    use_ssh_tunnel: bool
    ssh_host: Optional[str]
    ssh_port: Optional[int]
    ssh_username: Optional[str]
    ssh_key_path: Optional[str]

    class Config:
        from_attributes = True

    @model_validator(mode='after')
    def mask_sensitive_fields(self):
        # Mask SSH details for security in the response
        if self.ssh_host:
            self.ssh_host = "****"
        if self.ssh_username:
            self.ssh_username = "****"
        if self.ssh_key_path:
            self.ssh_key_path = "provided" # Mask the exact path
        return self


class ConnectionSchemaResponse(BaseModel):
    table: str
    columns: List[Dict[str, Any]]


class ExecuteRequest(BaseModel):
    sql: str
    bypass_safety: bool = False


class ExecuteResponse(BaseModel):
    sql_executed: str
    row_count: int
    results: List[Dict[str, Any]]

class TestConnectionRequest(BaseModel):
    host: Optional[str] = None
    port: Optional[int] = 5432
    database_name: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    connection_uri: Optional[str] = None
    # SSH Tunneling
    use_ssh_tunnel: bool = False
    ssh_host: Optional[str] = None
    ssh_port: int = 22
    ssh_username: Optional[str] = None
    ssh_pkey: Optional[str] = None

class TestConnectionResponse(BaseModel):
    success: bool
    message: str

class QueryHistoryResponse(BaseModel):
    id: UUID
    sql_query: str
    row_count: int
    execution_time_ms: Optional[int]
    status: str
    error_message: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

# --- Endpoints ---


@router.post("/test", response_model=TestConnectionResponse)
async def test_connection_params(
    request: TestConnectionRequest,
    current_user: User = Depends(deps.get_current_user),
):
    """
    Test a connection before creating it.
    """
    try:
        # Create a temporary dummy connection object (not saved to DB)
        # Note: We need a way to pass password to _get_pg_connection or duplicate logic
        # Easier to duplicate check logic here for clarity
        
        import tempfile
        from app.utils.ssh_tunnel import get_ssh_tunnel
        
        # Parse URI if provided
        host = request.host
        port = request.port
        database = request.database_name
        username = request.username
        password = request.password
        
        if request.connection_uri:
            from sqlalchemy.engine import make_url
            try:
                url = make_url(request.connection_uri)
                host = url.host or host
                port = url.port or port
                database = url.database or database
                username = url.username or username
                password = url.password or password
            except Exception as parse_e:
                logger.debug(f"Could not parse connection URI, using individual fields: {parse_e}")

        if request.use_ssh_tunnel:
            if not (request.ssh_host and request.ssh_username and request.ssh_pkey):
                raise ValueError("SSH host, username, and private key are required for SSH tunneling")
            
            # Temporary file for the key
            with tempfile.NamedTemporaryFile(mode='w', delete=True) as tmp_key:
                tmp_key.write(request.ssh_pkey)
                tmp_key.flush()
                
                with get_ssh_tunnel(
                    ssh_host=request.ssh_host,
                    ssh_username=request.ssh_username,
                    ssh_key_path=tmp_key.name,
                    remote_host=host,
                    remote_port=port or 5432,
                    ssh_port=request.ssh_port or 22
                ) as (local_host, local_port):
                    conn = await asyncpg.connect(
                        user=username,
                        password=password,
                        database=database,
                        host=local_host,
                        port=local_port,
                        statement_cache_size=0
                    )
                    await conn.close()
        else:
            if request.connection_uri:
                 conn = await asyncpg.connect(dsn=request.connection_uri, statement_cache_size=0)
                 await conn.close()
            else:
                if not (host and database and username and password):
                    raise ValueError("Missing parameters for connection test")
                    
                conn = await asyncpg.connect(
                    user=username,
                    password=password,
                    database=database,
                    host=host,
                    port=port or 5432,
                    statement_cache_size=0
                )
                await conn.close()
            
        return {"success": True, "message": "Connection successful!"}
    except Exception as e:
        logger.error(f"Connection test failed: {str(e)}", exc_info=True)
        return {"success": False, "message": f"Connection failed: {str(e)}"}


@router.post("/upload", response_model=ConnectionResponse)
async def upload_file_dataset(
    *,
    db: Session = Depends(deps.get_db),
    file: UploadFile = File(...),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Upload a file (CSV, Excel) to be used as a data source.
    """
    ext = os.path.splitext(file.filename)[1].lower()
    if not (ext in [".csv", ".xlsx", ".xls", ".parquet"] or file.filename.endswith(".tar.gz")):
        raise HTTPException(status_code=400, detail="Unsupported file format")

    file_id = f"{int(time.time())}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, file_id)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    db_obj = DbConnection(
        user_id=current_user.id,
        name=file.filename,
        host="local",
        database_name=file.filename,
        connection_type="file",
        file_path=file_path
    )
    
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


from sqlalchemy.engine.url import make_url

@router.post("/", response_model=ConnectionResponse)
def create_connection(
    *,
    db: Session = Depends(deps.get_db),
    connection_in: ConnectionCreate,
    current_user: User = Depends(deps.get_current_user),
):
    """
    Create a new database connection.
    Passwords are encrypted before storage.
    If connection_uri is provided, it is parsed to extract host, port, etc.
    """
    host = connection_in.host
    port = connection_in.port
    database_name = connection_in.database_name
    username = connection_in.username
    password = connection_in.password
    connection_uri = connection_in.connection_uri

    if connection_uri:
        try:
            url = make_url(connection_uri)
            host = url.host or host
            port = url.port or port
            database_name = url.database or database_name
            username = url.username or username
            password = url.password or password
        except Exception as e:
            logger.error(f"Failed to parse connection URI: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Invalid connection URI: {str(e)}")

    encrypted_pw = None
    if password:
        encrypted_pw = crypto_service.encrypt(password)

    db_obj = DbConnection(
        user_id=current_user.id,
        name=connection_in.name,
        host=host if host else "",
        port=port if port else 5432,
        database_name=database_name,
        username=username,
        encrypted_password=encrypted_pw,
        connection_uri=connection_uri,
        use_ssh_tunnel=connection_in.use_ssh_tunnel,
        ssh_host=crypto_service.encrypt(connection_in.ssh_host) if connection_in.ssh_host else None,
        ssh_port=connection_in.ssh_port,
        ssh_username=crypto_service.encrypt(connection_in.ssh_username) if connection_in.ssh_username else None
    )
    
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


SSH_KEY_DIR = "data/ssh_keys"

@router.post("/{id}/ssh-key")
async def upload_ssh_key(
    id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Upload an SSH private key (PEM) for a connection.
    Stored securely in a dedicated directory.
    """
    conn = (
        db.query(DbConnection)
        .filter(DbConnection.id == id, DbConnection.user_id == current_user.id)
        .first()
    )
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")

    # Security check: filename
    file_ext = os.path.splitext(file.filename)[1].lower()
    
    # Generate a unique secure path
    key_filename = f"key_{conn.id}_{int(time.time())}.pem"
    key_path = os.path.join(SSH_KEY_DIR, key_filename)
    
    # Ensure directory exists
    os.makedirs(SSH_KEY_DIR, exist_ok=True)
    
    with open(key_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Set restrictive permissions
    os.chmod(key_path, 0o600)
    
    # Update connection
    # Delete old key if exists
    if conn.ssh_key_path and os.path.exists(conn.ssh_key_path):
        try:
            os.remove(conn.ssh_key_path)
        except Exception as e:
            logger.warning(f"Failed to remove old SSH key {conn.ssh_key_path}: {e}")

    conn.ssh_key_path = key_path
    db.commit()
    
    return {"message": "SSH key uploaded successfully", "path": key_path}


@router.get("/", response_model=List[ConnectionResponse])
def read_connections(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(deps.get_current_user),
):
    """
    Retrieve connections belonging to the current user.
    """
    connections = (
        db.query(DbConnection)
        .filter(DbConnection.user_id == current_user.id)
        .offset(skip)
        .limit(limit)
        .all()
    )
    return connections


@router.get("/{id}/schema")
async def get_connection_schema(
    id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Fetch the schema (tables and columns) for a specific connection.
    Connects to the external database in real-time.
    """
    logger.info(f"Fetching schema for connection {id}")
    print(f"\n[DEBUG] GET /connections/{id}/schema - User: {current_user.id}")
    conn = (
        db.query(DbConnection)
        .filter(DbConnection.id == id, DbConnection.user_id == current_user.id)
        .first()
    )
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")

    try:
        if conn.connection_type == "file":
             schema_raw = FileQueryService.get_file_schema(conn.file_path)
             return schema_raw
        
        schema = await connection_service.get_schema(conn)
        return schema
    except Exception as e:
        logger.warning(f"Live schema fetch failed for connection {id}: {str(e)}")

        # Fallback to cached DuckDB schema if this deployment has synced tables.
        try:
            cached_rows = duckdb_manager.execute(
                """
                SELECT table_name, column_name, data_type
                FROM information_schema.columns
                WHERE table_schema = ?
                AND table_name NOT LIKE '_dlt_%'
                ORDER BY table_name, ordinal_position
                """,
                (connection_schema_name(id),),
            )
            if cached_rows:
                grouped: Dict[str, List[Dict[str, Any]]] = {}
                for row in cached_rows:
                    grouped.setdefault(row["table_name"], []).append(
                        {"name": row["column_name"], "type": row["data_type"]}
                    )
                return [{"table": t, "columns": cols} for t, cols in grouped.items()]
        except Exception as cache_error:
            logger.warning(f"Cached schema fallback failed for connection {id}: {cache_error}")

        print(f"[DEBUG] ERROR in endpoint: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail=(
                "Failed to fetch live schema from source database. "
                "If this deployment has not synced this connection yet, run sync and try again."
            ),
        )


@router.post("/{id}/execute", response_model=ExecuteResponse)
async def execute_query(
    id: UUID,
    request: ExecuteRequest,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Execute a SQL query against a specific connection.
    Enforces safety checks (no DELETE/DROP) unless bypass_safety is True.
    """
    conn = (
        db.query(DbConnection)
        .filter(DbConnection.id == id, DbConnection.user_id == current_user.id)
        .first()
    )
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")

    start_time = time.time()
    status = "success"
    err_msg = None
    row_count = 0

    try:
        # Route through DuckDB cache for synced connections — the Explore
        # sidebar shows DuckDB table names so SQL must run against DuckDB.
        if conn.sync_config and conn.sync_config.last_sync_status == "success":
            schema_name = connection_schema_name(id)
            # Rewrite unqualified table names to schema-qualified ones
            sql = request.sql
            try:
                cached_tables = duckdb_manager.execute(
                    "SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_name NOT LIKE '_dlt_%'",
                    (schema_name,),
                )
                for t in cached_tables:
                    tname = t["table_name"]
                    # Replace "table" with "schema"."table" (case-insensitive, word boundary)
                    import re
                    sql = re.sub(
                        rf'(?<!["\w.])\b{re.escape(tname)}\b(?!["\w.])',
                        f'"{schema_name}"."{tname}"',
                        sql,
                        flags=re.IGNORECASE,
                    )
                    # Also handle quoted version: "table" -> "schema"."table"
                    sql = sql.replace(f'"{tname}"', f'"{schema_name}"."{tname}"')
            except Exception as rewrite_err:
                logger.warning(f"Table name rewrite failed: {rewrite_err}")

            results = duckdb_manager.execute(sql)
            row_count = len(results)
            return {
                "sql_executed": sql,
                "row_count": row_count,
                "results": results,
            }

        if conn.connection_type == "file":
             results = FileQueryService.query_file(conn.file_path, request.sql)
             row_count = len(results)
             return {
                 "sql_executed": request.sql,
                 "row_count": row_count,
                 "results": results
             }

        result = await connection_service.execute_external_query(
            conn, request.sql, request.bypass_safety
        )
        row_count = result["row_count"]
        return result
    except Exception as e:
        status = "failed"
        err_msg = str(e)
        if isinstance(e, ValueError):
            raise HTTPException(status_code=400, detail=str(e))
        raise HTTPException(status_code=500, detail=f"execution failed: {str(e)}")
    finally:
        execution_time = int((time.time() - start_time) * 1000)
        # Log to history
        history = QueryHistory(
            user_id=current_user.id,
            connection_id=id,
            sql_query=request.sql,
            row_count=row_count,
            execution_time_ms=execution_time,
            status=status,
            error_message=err_msg,
            created_at=datetime.utcnow()
        )
        db.add(history)
        db.commit()

@router.get("/{id}/history", response_model=List[QueryHistoryResponse])
def get_query_history(
    id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    limit: int = 50
):
    """
    Get the query history for a connection.
    """
    history = (
        db.query(QueryHistory)
        .filter(QueryHistory.connection_id == id, QueryHistory.user_id == current_user.id)
        .order_by(QueryHistory.created_at.desc())
        .limit(limit)
        .all()
    )
    return history

@router.get("/{id}/table/{table_name}", response_model=ExecuteResponse)
async def get_table_data(
    id: UUID,
    table_name: str,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Quickly fetch data from a specific table.
    Routes to DuckDB cache when sync data is available.
    """
    conn = (
        db.query(DbConnection)
        .filter(DbConnection.id == id, DbConnection.user_id == current_user.id)
        .first()
    )
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")

    try:
        # Try DuckDB cache first (handles both DB and file connections with synced data)
        if conn.sync_config and conn.sync_config.last_sync_status == "success":
            schema_name = connection_schema_name(id)
            duckdb_sql = f'SELECT * FROM "{schema_name}"."{table_name}" LIMIT 1000'
            try:
                results = duckdb_manager.execute(duckdb_sql)
                return {
                    "sql_executed": duckdb_sql,
                    "row_count": len(results),
                    "results": results,
                    "source": "duckdb_cache",
                }
            except Exception as cache_err:
                logger.warning(f"DuckDB cache query failed for {schema_name}.{table_name}: {cache_err}")

        # Fallback: file-based query
        if conn.connection_type == "file":
            sql = f"SELECT * FROM {table_name}"
            results = FileQueryService.query_file(conn.file_path, sql)
            return {
                "sql_executed": sql,
                "row_count": len(results),
                "results": results,
            }

        # Fallback: external database query
        sql = f"SELECT * FROM {table_name}"
        result = await connection_service.execute_external_query(conn, sql, bypass_safety=False)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{id}", response_model=Dict[str, str])
def delete_connection(
    id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Delete a connection.
    """
    conn = (
        db.query(DbConnection)
        .filter(DbConnection.id == id, DbConnection.user_id == current_user.id)
        .first()
    )
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
        
    # Physical file cleanup
    if conn.connection_type == "file" and conn.file_path:
        try:
            if os.path.exists(conn.file_path):
                os.remove(conn.file_path)
                logger.info(f"Deleted physical file: {conn.file_path}")
            
            # Also cleanup extracted folders if any
            extracted_path = conn.file_path + "_extracted"
            if os.path.exists(extracted_path):
                shutil.rmtree(extracted_path)
                logger.info(f"Deleted extracted folder: {extracted_path}")
        except Exception as e:
            logger.error(f"Failed to delete physical file {conn.file_path}: {str(e)}")

    db.delete(conn)
    db.commit()
    return {"message": "Connection deleted successfully"}


@router.put("/{id}", response_model=ConnectionResponse)
def update_connection(
    id: UUID,
    connection_in: ConnectionUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Update a connection.
    If connection_uri is updated, it also parses it to refresh other fields.
    """
    conn = (
        db.query(DbConnection)
        .filter(DbConnection.id == id, DbConnection.user_id == current_user.id)
        .first()
    )
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")

    # If URI is provided, parse it first to potentially override other fields
    if connection_in.connection_uri:
        try:
            url = make_url(connection_in.connection_uri)
            conn.connection_uri = connection_in.connection_uri
            if url.host: conn.host = url.host
            if url.port: conn.port = url.port
            if url.database: conn.database_name = url.database
            if url.username: conn.username = url.username
            if url.password:
                conn.encrypted_password = crypto_service.encrypt(url.password)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid connection URI: {str(e)}")

    # Specific field updates (if provided explicitly, they override URI parsing)
    if connection_in.name is not None:
        conn.name = connection_in.name
    if connection_in.host is not None:
        conn.host = connection_in.host
    if connection_in.port is not None:
        conn.port = connection_in.port
    if connection_in.database_name is not None:
        conn.database_name = connection_in.database_name
    if connection_in.username is not None:
        conn.username = connection_in.username
    if connection_in.password is not None:
        conn.encrypted_password = crypto_service.encrypt(connection_in.password)
    
    # SSH Tunneling updates
    if connection_in.use_ssh_tunnel is not None:
        conn.use_ssh_tunnel = connection_in.use_ssh_tunnel
    if connection_in.ssh_host is not None:
        conn.ssh_host = crypto_service.encrypt(connection_in.ssh_host)
    if connection_in.ssh_port is not None:
        conn.ssh_port = connection_in.ssh_port
    if connection_in.ssh_username is not None:
        conn.ssh_username = crypto_service.encrypt(connection_in.ssh_username)

    db.add(conn)
    db.commit()
    db.refresh(conn)
    return conn
