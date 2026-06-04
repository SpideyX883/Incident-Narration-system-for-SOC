"""
Project Sybil — Log Anonymizer
Provides capability to anonymize sensitive information (IPs, Usernames, Hostnames, Domains)
before sending to AI models, and restoring them back in responses.
"""

import re
import json
import copy
from typing import Dict, List, Set, Tuple

class LogAnonymizer:
    def __init__(self):
        # Maps: real value -> placeholder
        self.ip_map: Dict[str, str] = {}
        self.user_map: Dict[str, str] = {}
        self.host_map: Dict[str, str] = {}
        self.domain_map: Dict[str, str] = {}

        # Reverse map: placeholder -> real value
        self.reverse_map: Dict[str, str] = {}

        # Counters
        self.ip_counter = 1
        self.user_counter = 1
        self.host_counter = 1
        self.domain_counter = 1

        # Common standard accounts / values that should not be anonymized to preserve SOC context
        self.ignored_users = {
            "system", "local service", "network service", "anonymous logon",
            "administrator", "guest", "defaultaccount", "wdagutilityaccount",
            "nt authority", "nt authority\\system", "nt authority\\local service",
            "nt authority\\network service", "nt authority\\anonymous logon",
            "local_system", "interactive", "everyone"
        }
        self.ignored_hosts = {
            "localhost", "127.0.0.1", "0.0.0.0", "::1"
        }

    def _is_valid_ipv4(self, ip_str: str) -> bool:
        parts = ip_str.split(".")
        if len(parts) != 4:
            return False
        try:
            return all(0 <= int(part) <= 255 for part in parts)
        except ValueError:
            return False

    def _register_ip(self, ip: str):
        if not ip or ip.lower() in self.ignored_hosts:
            return
        if ip in ["255.255.255.255", "::", "::1"]:
            return
        if ip not in self.ip_map:
            placeholder = f"IP-{self.ip_counter}"
            self.ip_map[ip] = placeholder
            self.reverse_map[placeholder] = ip
            self.ip_counter += 1

    def _register_user(self, username: str):
        if not username or username.lower() in self.ignored_users:
            return
        # Skip very short names or plain numbers
        if len(username) < 3 or username.isdigit():
            return
        if username not in self.user_map:
            placeholder = f"User-{self.user_counter}"
            self.user_map[username] = placeholder
            self.reverse_map[placeholder] = username
            self.user_counter += 1

    def _register_domain(self, domain: str):
        if not domain or domain.lower() in self.ignored_users or domain.lower() in self.ignored_hosts:
            return
        if len(domain) < 3 or domain.isdigit():
            return
        if domain not in self.domain_map:
            placeholder = f"Domain-{self.domain_counter}"
            self.domain_map[domain] = placeholder
            self.reverse_map[placeholder] = domain
            self.domain_counter += 1

    def _register_host(self, host: str):
        if not host or host.lower() in self.ignored_hosts:
            return
        if len(host) < 3 or host.isdigit():
            return
        if host not in self.host_map:
            placeholder = f"Host-{self.host_counter}"
            self.host_map[host] = placeholder
            self.reverse_map[placeholder] = host
            self.host_counter += 1

    def _add_user_domain(self, user_str: str):
        if not user_str or not isinstance(user_str, str):
            return
        
        user_str_lower = user_str.lower()
        if user_str_lower in self.ignored_users:
            return

        # Check domain\user
        if "\\" in user_str:
            parts = user_str.split("\\")
            domain = parts[0]
            username = "\\".join(parts[1:])
            
            if domain.lower() not in self.ignored_users:
                self._register_domain(domain)
            if username.lower() not in self.ignored_users:
                self._register_user(username)
        # Check user@domain
        elif "@" in user_str:
            parts = user_str.split("@")
            username = parts[0]
            domain = "@".join(parts[1:])
            
            if domain.lower() not in self.ignored_users:
                self._register_domain(domain)
            if username.lower() not in self.ignored_users:
                self._register_user(username)
        else:
            self._register_user(user_str)

    def _add_host(self, host_str: str):
        if not host_str or not isinstance(host_str, str):
            return
        host_lower = host_str.lower()
        if host_lower in self.ignored_hosts:
            return
        
        # Check if FQDN
        if "." in host_str:
            parts = host_str.split(".", 1)
            hostname = parts[0]
            domain = parts[1]
            
            self._register_host(hostname)
            self._register_domain(domain)
        else:
            self._register_host(host_str)

    def analyze_and_build_maps(self, events: List[dict]):
        """Scan event fields and strings to discover items that need anonymization."""
        # 1. Structured scan
        for event in events:
            # User fields
            for field in ["User", "AccountName", "TargetUser", "src_user", "dest_user", "subject_user"]:
                if field in event and isinstance(event[field], str):
                    self._add_user_domain(event[field])
            
            # IP fields
            for field in ["DestinationIp", "SourceIp", "IpAddress", "IpAddressDestination", "IpAddressSource"]:
                if field in event and isinstance(event[field], str):
                    self._register_ip(event[field])
            
            # Host fields
            for field in ["Hostname", "Computer", "ComputerName", "dest_host", "src_host"]:
                if field in event and isinstance(event[field], str):
                    self._add_host(event[field])

        # 2. Regex-based scan of all values to catch embedded strings (e.g. in CommandLines)
        ip_ipv4_regex = re.compile(r"\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b")
        ip_ipv6_regex = re.compile(r"\b(?:[0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{1,4}\b")
        domain_host_regex = re.compile(r"\b[A-Za-z0-9-]+\.(?:local|lan|internal|cloudapp\.net)\b", re.IGNORECASE)

        for event in events:
            for k, v in event.items():
                if isinstance(v, str):
                    # IPv4
                    for ip in ip_ipv4_regex.findall(v):
                        if self._is_valid_ipv4(ip):
                            self._register_ip(ip)
                    # IPv6
                    for ip in ip_ipv6_regex.findall(v):
                        self._register_ip(ip)
                    # Domains/Hosts
                    for host in domain_host_regex.findall(v):
                        self._add_host(host)

    def get_replacement_dict(self) -> Dict[str, str]:
        """Combine all maps and sort by key length descending to prevent partial replacements."""
        merged = {}
        merged.update(self.domain_map)
        merged.update(self.host_map)
        merged.update(self.user_map)
        merged.update(self.ip_map)
        return merged

    def anonymize_text(self, text: str) -> str:
        """Replace all occurrences of real sensitive values in a text with placeholders."""
        if not text:
            return text
        
        replacements = self.get_replacement_dict()
        sorted_keys = sorted(replacements.keys(), key=len, reverse=True)

        for key in sorted_keys:
            val = replacements[key]
            # Use regex matching with word boundary when key is alphanumeric
            if key.isalnum():
                pattern = r"\b" + re.escape(key) + r"\b"
            else:
                # Handle IPs and domains with dots or backslashes
                pattern = ""
                if key[0].isalnum():
                    pattern += r"\b"
                pattern += re.escape(key)
                if key[-1].isalnum():
                    pattern += r"\b"
            
            # Case insensitive for usernames/hostnames, case sensitive for exact IP/domains if needed
            # We use case-insensitive replacement for everything except IPs (though it's fine for IPs too)
            text = re.sub(pattern, val, text, flags=re.IGNORECASE if key.isalnum() else 0)
        
        return text

    def deanonymize_text(self, text: str) -> str:
        """Replace placeholders in a text back to their original real values."""
        if not text:
            return text
        
        # Sort placeholders by length descending
        sorted_placeholders = sorted(self.reverse_map.keys(), key=len, reverse=True)
        for placeholder in sorted_placeholders:
            real_val = self.reverse_map[placeholder]
            pattern = r"\b" + re.escape(placeholder) + r"\b"
            text = re.sub(pattern, real_val, text)
        
        return text

    def anonymize_events(self, events: List[dict]) -> List[dict]:
        """Anonymize a list of event dictionaries by converting each to JSON, replacing, and returning."""
        anonymized_events = []
        for event in events:
            event_str = json.dumps(event)
            anon_str = self.anonymize_text(event_str)
            anon_event = json.loads(anon_str)
            anonymized_events.append(anon_event)
        return anonymized_events

    def deanonymize_events_map(self, events_map: Dict[str, dict]) -> Dict[str, dict]:
        """De-anonymize a map of LOG_ID -> event dict back to their real values."""
        de_anonymized = {}
        for lid, event in events_map.items():
            event_str = json.dumps(event)
            de_anon_str = self.deanonymize_text(event_str)
            de_anonymized[lid] = json.loads(de_anon_str)
        return de_anonymized
