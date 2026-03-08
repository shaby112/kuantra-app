import os
import paramiko
# SSH Tunneling compatibility fix for Paramiko 3.0+ and sshtunnel 0.4.0
if not hasattr(paramiko, 'DSSKey'):
    paramiko.DSSKey = paramiko.RSAKey

from sshtunnel import SSHTunnelForwarder
from contextlib import contextmanager
from app.core.logging import logger
from app.utils.crypto import crypto_service
from typing import Optional, Tuple

@contextmanager
def get_ssh_tunnel(
    ssh_host: str,
    ssh_username: str,
    ssh_key_path: str,
    remote_host: str,
    remote_port: int,
    ssh_port: int = 22
):
    """
    Creates an SSH tunnel to a remote host via a bastion host.
    
    Args:
        ssh_host: The bastion/SSH host address
        ssh_username: SSH username
        ssh_key_path: Path to the private key (PEM)
        remote_host: The target database host (as seen from bastion)
        remote_port: The target database port
        ssh_port: Bastion SSH port (default 22)
        
    Yields:
        (local_host, local_port) - The address to connect to locally
    """
    if not os.path.exists(ssh_key_path):
        raise FileNotFoundError(f"SSH key not found at {ssh_key_path}")

    logger.info(f"Opening SSH tunnel to {remote_host}:{remote_port} via {ssh_host}")
    
    # We use '127.0.0.1' for the local binding
    with SSHTunnelForwarder(
        (ssh_host, ssh_port),
        ssh_username=ssh_username,
        ssh_pkey=ssh_key_path,
        remote_bind_address=(remote_host, remote_port),
        local_bind_address=('127.0.0.1', 0), # Bind to a random free port
        allow_agent=False # Prevent paramiko DSSKey attribute error
    ) as tunnel:
        logger.info(f"SSH tunnel established at 127.0.0.1:{tunnel.local_bind_port}")
        yield '127.0.0.1', tunnel.local_bind_port

class SSHTunnelManager:
    """Helper to manage SSH tunnels for database connections."""
    
    def __init__(self, conn_model):
        self.conn_model = conn_model
        self.tunnel = None

    def start(self):
        """Starts the SSH tunnel."""
        if not self.conn_model.use_ssh_tunnel:
            return None, self.conn_model.host, self.conn_model.port

        if not self.conn_model.ssh_key_path:
            raise ValueError("SSH key is required for SSH tunneling")

        logger.info(f"Starting SSH tunnel for connection {self.conn_model.id}")
        
        ssh_host = crypto_service.decrypt(self.conn_model.ssh_host)
        ssh_username = crypto_service.decrypt(self.conn_model.ssh_username)
        
        self.tunnel = SSHTunnelForwarder(
            (ssh_host, self.conn_model.ssh_port or 22),
            ssh_username=ssh_username,
            ssh_pkey=self.conn_model.ssh_key_path,
            remote_bind_address=(self.conn_model.host, self.conn_model.port or 5432),
            local_bind_address=('127.0.0.1', 0),
            allow_agent=False
        )
        self.tunnel.start()
        logger.info(f"SSH tunnel started at 127.0.0.1:{self.tunnel.local_bind_port}")
        return self.tunnel, '127.0.0.1', self.tunnel.local_bind_port

    def stop(self):
        """Stops the SSH tunnel."""
        if self.tunnel:
            logger.info(f"Stopping SSH tunnel for connection {self.conn_model.id}")
            self.tunnel.stop()
            self.tunnel = None
