import psycopg2
import psycopg2.extras
import os
from dotenv import load_dotenv

load_dotenv()

DB_SCHEMA = os.getenv("DB_SCHEMA", "public")

def get_connection():
    return psycopg2.connect(os.getenv("DATABASE_URL"), options=f"-c search_path={DB_SCHEMA}")
