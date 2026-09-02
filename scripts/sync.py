#!/usr/bin/env python3
"""
Airtable Book Catalog Sync Script
Reads AIRTABLE_PAT and AIRTABLE_BASE_ID from .env file and syncs data to data/catalog.json
"""

import os
import sys
import json
import urllib.request
import urllib.error
from datetime import datetime

# Set stdout/stderr encoding to UTF-8 for cross-platform safety
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

def load_env():
    """Load .env file if present"""
    env_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
    if os.path.exists(env_file):
        with open(env_file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    os.environ.setdefault(k.strip(), v.strip())

def fetch_airtable_table(base_id, table_name, pat):
    """Fetch all records from an Airtable table with pagination"""
    headers = {
        'Authorization': f'Bearer {pat}',
        'Content-Type': 'application/json'
    }
    
    records = []
    offset = None
    
    while True:
        url = f'https://api.airtable.com/v0/{base_id}/{table_name}'
        if offset:
            url += f'?offset={offset}'
            
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode('utf-8'))
                    records.extend(data.get('records', []))
                    offset = data.get('offset')
                    if not offset:
                        break
                else:
                    raise RuntimeError(f"HTTP error {response.status}")
        except urllib.error.HTTPError as e:
            err_msg = e.read().decode('utf-8')
            raise RuntimeError(f"Airtable API HTTP Error {e.code}: {err_msg}")
            
    return records

def main():
    load_env()
    
    base_id = os.getenv('AIRTABLE_BASE_ID', 'appBwtlEQYmOvcyI4')
    pat = os.getenv('AIRTABLE_PAT')
    
    if not pat:
        print("[ERROR] AIRTABLE_PAT environment variable or .env file setting is missing.")
        return 1
        
    print(f"[INFO] Fetching live data from Airtable Base: {base_id}...")
    
    raw_books = fetch_airtable_table(base_id, 'Books', pat)
    raw_authors = fetch_airtable_table(base_id, 'Authors', pat)
    
    print(f"[INFO] Fetched {len(raw_books)} book records and {len(raw_authors)} author records.")
    
    author_map = {}
    for author in raw_authors:
        author_id = author.get('id')
        name = author.get('fields', {}).get('Name', 'Unknown Author')
        author_map[author_id] = name
        
    processed_books = []
    
    for book in raw_books:
        fields = book.get('fields', {})
        read_status = fields.get('Read Status') is True
        
        date_modified = fields.get('Read/Unread Last Modified')
        date_created = book.get('createdTime')
        effective_date = date_modified or date_created
        
        read_year = 2026
        if effective_date:
            try:
                read_year = int(effective_date[:4])
            except ValueError:
                read_year = 2026
                
        author_ids = fields.get('Author', [])
        author_names = [author_map.get(aid, 'Unknown Author') for aid in author_ids]
        author_str = ", ".join(author_names) if author_names else "Unknown Author"
        
        processed_books.append({
            'id': book.get('id'),
            'title': fields.get('Title', 'Untitled'),
            'author': author_str,
            'author_ids': author_ids,
            'category': fields.get('Category', 'Other'),
            'tags': fields.get('Tags', []),
            'language': fields.get('Language', 'Other'),
            'read_status': read_status,
            'bought': fields.get('Bought?') is True,
            'personal_notes': fields.get('Personal Notes', ''),
            'read_modified_date': date_modified,
            'created_date': date_created,
            'effective_date': effective_date,
            'read_year': read_year
        })
        
    processed_books.sort(key=lambda b: b.get('effective_date') or '', reverse=True)
    
    read_books = [b for b in processed_books if b['read_status']]
    years_set = set(b['read_year'] for b in read_books)
    years = sorted(list(years_set), reverse=True)
    
    years_breakdown = {}
    for yr in years:
        years_breakdown[str(yr)] = len([b for b in read_books if b['read_year'] == yr])
        
    catalog_data = {
        'last_synced': datetime.utcnow().isoformat() + 'Z',
        'total_books': len(processed_books),
        'total_read': len(read_books),
        'years': years,
        'years_breakdown': years_breakdown,
        'books': processed_books
    }
    
    root_dir = os.path.dirname(os.path.dirname(__file__))
    data_dir = os.path.join(root_dir, 'data')
    os.makedirs(data_dir, exist_ok=True)
    
    output_path = os.path.join(data_dir, 'catalog.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(catalog_data, f, ensure_ascii=False, indent=2)
        
    print(f"[SUCCESS] Sync complete! Data saved to {output_path}")
    print(f"[SUCCESS] Total books: {len(processed_books)} (Read: {len(read_books)})")
    return 0

if __name__ == '__main__':
    exit(main())
