import pymssql
import os
from dotenv import load_dotenv

load_dotenv()

def get_connection():
    return pymssql.connect(
        server=os.getenv("DB_SERVER"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME"),
        tds_version="7.4",
        as_dict=False,
    )
