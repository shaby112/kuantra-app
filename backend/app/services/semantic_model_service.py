from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml
from sqlalchemy.orm import Session

from app.core.logging import logger
from app.db.models import MDLVersion, SyncConfig
from app.services.mdl_generator import mdl_generator
from app.utils.identifiers import to_uuid


class SemanticModelService:
    """
    Single source-of-truth service for semantic model lifecycle.

    Responsibilities:
    - Load current model (DB -> file -> generator fallback)
    - Refresh model from DuckDB metadata
    - Persist model to DB version history and file cache
    """

    def __init__(self, mdl_path: str = "app/semantic/model.mdl"):
        self.mdl_path = Path(mdl_path)

    def _load_file(self) -> Optional[Dict[str, Any]]:
        try:
            if not self.mdl_path.exists():
                return None
            with self.mdl_path.open("r") as f:
                content = yaml.safe_load(f)
            return content if isinstance(content, dict) else None
        except Exception as e:
            logger.warning(f"Failed to load MDL file cache {self.mdl_path}: {e}")
            return None

    def _write_file(self, content: Dict[str, Any]) -> None:
        self.mdl_path.parent.mkdir(parents=True, exist_ok=True)
        with self.mdl_path.open("w") as f:
            yaml.dump(content, f, sort_keys=False)

    @staticmethod
    def _get_synced_connection_ids(db: Session) -> Optional[List[str]]:
        synced_rows = (
            db.query(SyncConfig.connection_id)
            .filter(SyncConfig.last_sync_status == "success")
            .all()
        )
        connection_ids = [str(row.connection_id) for row in synced_rows] if synced_rows else None
        return connection_ids

    @staticmethod
    def _apply_relationship_overrides(
        mdl_content: Dict[str, Any], user_overrides: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        if not user_overrides:
            return mdl_content
        if "relationships" not in user_overrides:
            return mdl_content

        relationships = mdl_content.setdefault("relationships", [])
        existing_names = {r.get("name") for r in relationships}
        for rel in user_overrides.get("relationships", []):
            rel_name = rel.get("name")
            if rel_name and rel_name not in existing_names:
                relationships.append(rel)
                existing_names.add(rel_name)
        return mdl_content

    def get_current(
        self,
        db: Optional[Session] = None,
        connection_ids: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Return the current semantic model.

        If connection_ids are provided, model is generated on-demand for that scope.
        Otherwise prefers latest persisted DB version, then file cache, then generator fallback.
        """
        if connection_ids:
            return mdl_generator.generate(connection_ids=connection_ids, override_models=None)

        if db is not None:
            current_mdl = db.query(MDLVersion).order_by(MDLVersion.version.desc()).first()
            if current_mdl and isinstance(current_mdl.content, dict):
                # Keep file cache aligned with persisted truth.
                try:
                    self._write_file(current_mdl.content)
                except Exception as e:
                    logger.warning(f"Failed writing MDL cache file from DB version: {e}")
                logger.info(
                    "semantic_model.get_current",
                    extra={"mdl_version": current_mdl.version, "source": "db"},
                )
                return current_mdl.content

            # One-time migration path for early adopters: bootstrap DB from legacy file.
            file_content = self._load_file()
            if file_content:
                logger.info("semantic_model.migrate_file_to_db")
                self.persist(
                    content=file_content,
                    db=db,
                    user_overrides=file_content.get("user_overrides", {}),
                    created_by=None,
                    change_summary="Initial migration from legacy model.mdl file",
                )
                return file_content

        file_content = self._load_file()
        if file_content:
            logger.info("semantic_model.get_current", extra={"source": "file"})
            return file_content

        logger.info("semantic_model.get_current", extra={"source": "generator"})
        return mdl_generator.generate(connection_ids=None, override_models=None)

    def persist(
        self,
        content: Dict[str, Any],
        db: Optional[Session] = None,
        user_overrides: Optional[Dict[str, Any]] = None,
        created_by: Optional[str] = None,
        change_summary: Optional[str] = None,
    ) -> Optional[MDLVersion]:
        """Persist MDL to file cache and optionally create a DB version."""
        self._write_file(content)

        if db is None:
            return None

        current_mdl = db.query(MDLVersion).order_by(MDLVersion.version.desc()).first()
        current_version_id = current_mdl.version if current_mdl else 0

        new_mdl = MDLVersion(
            version=current_version_id + 1,
            content=content,
            user_overrides=user_overrides or {},
            created_by=to_uuid(created_by) if created_by else None,
            change_summary=change_summary or "Semantic model persist",
            created_at=datetime.now(timezone.utc),
        )
        db.add(new_mdl)
        db.commit()
        logger.info(
            "semantic_model.persist",
            extra={"mdl_version": new_mdl.version, "change_summary": new_mdl.change_summary},
        )
        return new_mdl

    def refresh(
        self,
        db: Optional[Session] = None,
        connection_ids: Optional[List[str]] = None,
        created_by: Optional[str] = None,
        change_summary: str = "Automatic semantic model refresh",
    ) -> Dict[str, Any]:
        """
        Generate and persist the latest semantic model.
        """
        user_overrides: Dict[str, Any] = {}
        if db is not None:
            current_mdl = db.query(MDLVersion).order_by(MDLVersion.version.desc()).first()
            user_overrides = current_mdl.user_overrides if current_mdl else {}
            if connection_ids is None:
                connection_ids = self._get_synced_connection_ids(db)

        logger.info(f"Refreshing semantic model (connection_ids={connection_ids})")
        mdl_content = mdl_generator.generate(connection_ids=connection_ids, override_models=None)
        mdl_content = self._apply_relationship_overrides(mdl_content, user_overrides)

        self.persist(
            content=mdl_content,
            db=db,
            user_overrides=user_overrides,
            created_by=created_by,
            change_summary=change_summary,
        )
        logger.info(
            "semantic_model.refresh.complete",
            extra={
                "models": len(mdl_content.get("models", [])),
                "relationships": len(mdl_content.get("relationships", [])),
            },
        )
        return mdl_content


semantic_model_service = SemanticModelService()
