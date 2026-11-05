# bot/config.example.py
import os

BOT_TOKEN = os.getenv("BOT_TOKEN", "YOUR_BOT_TOKEN_HERE")
SERVER_IP = os.getenv("SERVER_IP", "127.0.0.1")
WEB_TARGET_PORT = int(os.getenv("APEX_PORT", 5000))
DASHBOARD_PORT = int(os.getenv("DASHBOARD_PORT", 8080))
ADMIN_IDS = [123456789]  # Telegram admin ID lari
REPORTS_DIR = os.getenv("REPORTS_DIR", "/var/ctf/reports")
