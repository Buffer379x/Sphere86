import logging
from typing import Optional, Any
from sqlalchemy.orm import Session
from ..models import SystemSetting
from ..config import get_settings

logger = logging.getLogger(__name__)

def get_db_setting(db: Session, key: str, default: Any = "") -> str:
    """Fetch a setting from the database, falling back to the provided default."""
    try:
        row = db.query(SystemSetting).filter(SystemSetting.key == key).first()
        return row.value if row else str(default)
    except Exception as e:
        logger.error("Error fetching system setting %s: %s", key, e)
        return str(default)

def get_db_bool(db: Session, key: str, default: bool) -> bool:
    val = get_db_setting(db, key, str(default).lower()).lower()
    return val == "true"

def get_db_int(db: Session, key: str, default: int) -> int:
    val = get_db_setting(db, key, str(default))
    try:
        return int(val)
    except (ValueError, TypeError):
        return default

class DynamicSettings:
    """Helper class to fetch all application settings from DB with fallback to env."""
    def __init__(self, db: Session):
        self.db = db
        self.env = get_settings()

    @property
    def user_management(self) -> bool:
        return get_db_bool(self.db, "user_management", self.env.user_management)

    @property
    def ldap_enabled(self) -> bool:
        return get_db_bool(self.db, "ldap_enabled", self.env.ldap_enabled)

    @property
    def ldap_server(self) -> str:
        return get_db_setting(self.db, "ldap_server", self.env.ldap_server)

    @property
    def ldap_port(self) -> int:
        return get_db_int(self.db, "ldap_port", self.env.ldap_port)

    @property
    def ldap_base_dn(self) -> str:
        return get_db_setting(self.db, "ldap_base_dn", self.env.ldap_base_dn)

    @property
    def ldap_bind_dn(self) -> str:
        return get_db_setting(self.db, "ldap_bind_dn", self.env.ldap_bind_dn)

    @property
    def ldap_bind_password(self) -> str:
        return get_db_setting(self.db, "ldap_bind_password", self.env.ldap_bind_password)

    @property
    def ldap_user_filter(self) -> str:
        return get_db_setting(self.db, "ldap_user_filter", self.env.ldap_user_filter)

    @property
    def ldap_group_dn(self) -> str:
        return get_db_setting(self.db, "ldap_group_dn", self.env.ldap_group_dn)

    @property
    def ldap_username_attr(self) -> str:
        return get_db_setting(self.db, "ldap_username_attr", self.env.ldap_username_attr)

    @property
    def ldap_email_attr(self) -> str:
        return get_db_setting(self.db, "ldap_email_attr", self.env.ldap_email_attr)

    @property
    def ldap_tls(self) -> bool:
        return get_db_bool(self.db, "ldap_tls", self.env.ldap_tls)

    # 86Box
    @property
    def box86_version(self) -> str:
        return get_db_setting(self.db, "box86_version", self.env.box86_version)

    @property
    def box86_arch(self) -> str:
        return get_db_setting(self.db, "box86_arch", self.env.box86_arch)

    # System Limits
    @property
    def enforce_quotas(self) -> bool:
        return get_db_bool(self.db, "enforce_quotas", self.env.enforce_quotas)

    @property
    def active_vm_limit(self) -> Optional[int]:
        val = get_db_setting(self.db, "active_vm_limit", str(self.env.active_vm_limit))
        if val.lower() in ("none", "null", ""):
            return None
        try:
            return int(val)
        except (ValueError, TypeError):
            return self.env.active_vm_limit

    @property
    def max_concurrent_vms(self) -> int:
        return get_db_int(self.db, "max_concurrent_vms", self.env.max_concurrent_vms)

    @property
    def base_vnc_port(self) -> int:
        return get_db_int(self.db, "base_vnc_port", self.env.base_vnc_port)

    @property
    def base_ws_port(self) -> int:
        return get_db_int(self.db, "base_ws_port", self.env.base_ws_port)

    # Defaults
    @property
    def default_max_vms(self) -> int:
        return get_db_int(self.db, "default_max_vms", self.env.default_max_vms)

    @property
    def default_max_storage_gb(self) -> int:
        return get_db_int(self.db, "default_max_storage_gb", self.env.default_max_storage_gb)

    # Maintenance & Logging
    @property
    def vm_auto_shutdown_minutes(self) -> int:
        return get_db_int(self.db, "vm_auto_shutdown_minutes", self.env.vm_auto_shutdown_minutes)

    @property
    def log_level(self) -> str:
        return get_db_setting(self.db, "log_level", self.env.log_level)

    @property
    def audio_buffer_secs(self) -> float:
        val = get_db_setting(self.db, "audio_buffer_secs", str(self.env.audio_buffer_secs))
        try:
            return float(val)
        except (ValueError, TypeError):
            return self.env.audio_buffer_secs
