import time
import requests
import xml.etree.ElementTree as ET
from flask import Flask, render_template, jsonify, request

app = Flask(__name__)

# Cache configuration
FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
cache = {
    "data": None,
    "last_fetched": 0,
    "ttl": 300  # 5 minutes cache TTL
}

def parse_feed(xml_content):
    root = ET.fromstring(xml_content)
    namespaces = {'atom': 'http://www.w3.org/2005/Atom'}
    
    entries = root.findall('atom:entry', namespaces)
    if not entries:
        # Fallback if namespaces are stripped or different
        for el in root.iter():
            if '}' in el.tag:
                el.tag = el.tag.split('}', 1)[1]
        entries = root.findall('entry')
        
    parsed_entries = []
    
    for entry in entries:
        def get_val(el, tag):
            val = el.find(f'atom:{tag}', namespaces)
            if val is None:
                val = el.find(tag)
            return val.text if val is not None else ""
            
        def get_link(el):
            link_el = el.find('atom:link[@rel="alternate"]', namespaces)
            if link_el is None:
                link_el = el.find('atom:link', namespaces)
            if link_el is None:
                link_el = el.find('link')
            if link_el is not None:
                return link_el.attrib.get('href', '')
            return ""

        title = get_val(entry, 'title')
        updated = get_val(entry, 'updated')
        entry_id = get_val(entry, 'id')
        link = get_link(entry)
        content = get_val(entry, 'content')
        
        parsed_entries.append({
            "id": entry_id,
            "title": title,
            "updated": updated,
            "link": link,
            "content": content
        })
        
    return parsed_entries

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def get_release_notes():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    current_time = time.time()
    
    # Return cache if available and not expired, unless force refresh is requested
    if cache["data"] is not None and (current_time - cache["last_fetched"] < cache["ttl"]) and not force_refresh:
        return jsonify({
            "success": True,
            "data": cache["data"],
            "source": "cache",
            "last_fetched": cache["last_fetched"]
        })
        
    try:
        response = requests.get(FEED_URL, timeout=10)
        response.raise_for_status()
        
        parsed_data = parse_feed(response.content)
        
        cache["data"] = parsed_data
        cache["last_fetched"] = current_time
        
        return jsonify({
            "success": True,
            "data": parsed_data,
            "source": "live",
            "last_fetched": current_time
        })
    except Exception as e:
        # Fallback to cache if request fails
        if cache["data"] is not None:
            return jsonify({
                "success": True,
                "data": cache["data"],
                "source": "cache-fallback",
                "error": str(e),
                "last_fetched": cache["last_fetched"]
            })
        return jsonify({
            "success": False,
            "error": f"Failed to fetch release notes: {str(e)}"
        }), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
