"""
MongoDB Source Connector.

Features:
- Async connection using pymongo (motor-like patterns with sync wrapper)
- Collection discovery
- Incremental extraction using _id or timestamp fields
"""

from typing import Dict, Any, List, Optional
from datetime import datetime
import asyncio
import uuid
from bson import ObjectId

from app.db.models import DbConnection
from app.utils.crypto import crypto_service
from app.core.logging import logger


class MongoDBSource:
    """MongoDB data source connector."""
    
    def __init__(self, connection: DbConnection):
        self.connection = connection
        self._client = None
        self._db = None
        from app.utils.ssh_tunnel import SSHTunnelManager
        self._tunnel_mgr = SSHTunnelManager(connection)
        self._tunnel = None
    
    def _get_client(self):
        """Get MongoDB client."""
        from pymongo import MongoClient
        
        if self._client:
            return self._client, self._db
        
        host = self.connection.host
        port = self.connection.port or 27017
        
        if self.connection.use_ssh_tunnel:
            self._tunnel, host, port = self._tunnel_mgr.start()

        # Build connection string
        if self.connection.connection_uri:
            uri = self.connection.connection_uri
            if self.connection.use_ssh_tunnel:
                 # Potentially complex to rewrite arbitrary URI, 
                 # but for mongodb:// simple replacement usually works
                 from urllib.parse import urlparse, urlunparse
                 parsed = urlparse(uri)
                 # Reconstruct with tunnel host:port
                 uri = urlunparse(parsed._replace(netloc=f"{parsed.username}:{parsed.password}@{host}:{port}"))
        else:
            password = None
            if self.connection.encrypted_password:
                password = crypto_service.decrypt(self.connection.encrypted_password)
            
            if password:
                uri = f"mongodb://{self.connection.username}:{password}@{host}:{port}"
            else:
                uri = f"mongodb://{host}:{port}"
        
        self._client = MongoClient(uri)
        self._db = self._client[self.connection.database_name]
        
        return self._client, self._db
    
    async def get_collections(self) -> List[str]:
        """Get list of collections."""
        def _get():
            _, db = self._get_client()
            return db.list_collection_names()
        
        return await asyncio.to_thread(_get)
    
    async def extract_collection(
        self,
        collection_name: str,
        incremental: bool = False,
        last_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Extract data from a collection.
        
        Args:
            collection_name: Name of the collection
            incremental: Whether to do incremental extraction
            last_id: Last _id value for incremental
            
        Returns:
            List of documents
        """
        def _extract():
            _, db = self._get_client()
            collection = db[collection_name]
            
            # Build query
            query = {}
            if incremental and last_id:
                try:
                    query["_id"] = {"$gt": ObjectId(last_id)}
                except Exception:
                    pass
            
            # Fetch documents
            cursor = collection.find(query).sort("_id", 1)
            
            documents = []
            for doc in cursor:
                # Convert ObjectId and datetime to strings
                record = {}
                for key, value in doc.items():
                    if isinstance(value, ObjectId):
                        record[key] = str(value)
                    elif isinstance(value, datetime):
                        record[key] = value.isoformat()
                    elif isinstance(value, uuid.UUID):
                        record[key] = str(value)
                    elif isinstance(value, dict):
                        # Recursively handle nested dicts
                        record[key] = _serialize_dict(value)
                    elif isinstance(value, list):
                        record[key] = _serialize_list(value)
                    else:
                        record[key] = value
                documents.append(record)
            
            return documents
        
        def _serialize_dict(d: dict) -> dict:
            result = {}
            for k, v in d.items():
                if isinstance(v, ObjectId):
                    result[k] = str(v)
                elif isinstance(v, datetime):
                    result[k] = v.isoformat()
                elif isinstance(v, uuid.UUID):
                    result[k] = str(v)
                elif isinstance(v, dict):
                    result[k] = _serialize_dict(v)
                elif isinstance(v, list):
                    result[k] = _serialize_list(v)
                else:
                    result[k] = v
            return result
        
        def _serialize_list(lst: list) -> list:
            result = []
            for item in lst:
                if isinstance(item, ObjectId):
                    result.append(str(item))
                elif isinstance(item, datetime):
                    result.append(item.isoformat())
                elif isinstance(item, uuid.UUID):
                    result.append(str(item))
                elif isinstance(item, dict):
                    result.append(_serialize_dict(item))
                elif isinstance(item, list):
                    result.append(_serialize_list(item))
                else:
                    result.append(item)
            return result
        
        result = await asyncio.to_thread(_extract)
        logger.info(f"Extracted {len(result)} documents from MongoDB collection {collection_name}")
        return result
    
    def close(self):
        """Close the connection and tunnel."""
        if self._client:
            self._client.close()
            self._client = None
            self._db = None
            
        if self._tunnel_mgr:
            self._tunnel_mgr.stop()
