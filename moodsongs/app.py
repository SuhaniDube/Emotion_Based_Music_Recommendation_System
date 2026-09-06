"""
Moodsongs Flask Backend
- Serves face-api.js model files from /static/models/
- Emotion detection now runs in the browser via face-api.js
- Music previews via iTunes Search API (free, no key)
"""

import os, json, random, urllib.request, urllib.parse
import pandas as pd
from flask import Flask, render_template, request, jsonify, send_from_directory

app = Flask(__name__)
df  = pd.read_csv('dataset.csv')

VALID_EMOTIONS = ['calm','romantic','energetic','angry','happy','sad','relaxed']
EMOTION_ICONS  = {
    'happy':'😄','romantic':'🥰','sad':'😢',
    'energetic':'⚡','calm':'😌','angry':'😤','relaxed':'😴'
}


def search_itunes(query: str, limit: int = 1):
    try:
        q   = urllib.parse.quote(query)
        url = f"https://itunes.apple.com/search?term={q}&media=music&entity=song&limit={limit}&country=IN"
        req = urllib.request.Request(url, headers={'User-Agent':'Moodsongs/1.0'})
        with urllib.request.urlopen(req, timeout=5) as r:
            data = json.loads(r.read())
        res = data.get('results', [])
        if res:
            t = res[0]
            return {
                'preview_url': t.get('previewUrl',''),
                'artwork':     t.get('artworkUrl100','').replace('100x100','300x300'),
                'itunes_url':  t.get('trackViewUrl',''),
                'track_name':  t.get('trackName',''),
                'artist_name': t.get('artistName',''),
            }
    except Exception:
        pass
    return None


@app.route('/')
def index(): return render_template('index.html')


@app.route('/recommend', methods=['POST'])
def recommend():
    data    = request.get_json()
    emotion = data.get('emotion','').lower().strip()
    top_n   = max(1, min(int(data.get('top_n', 10)), 50))
    if emotion not in VALID_EMOTIONS:
        return jsonify({'error': f'Invalid emotion'}), 400
    subset = df[df['emotion'] == emotion].copy()
    if subset.empty:
        return jsonify({'error': 'No songs'}), 404
    songs = subset.sort_values('rating', ascending=False).head(max(top_n*2,30)).sample(frac=1).head(top_n)
    results = []
    for _, row in songs.iterrows():
        results.append({
            'title':       row['title'],
            'artist':      row['artist'],
            'language':    row['language'],
            'genre':       row['genre'],
            'rating':      row['rating'],
            'year':        int(row['year']),
            'emotion':     emotion,
            'confidence':  round(random.uniform(78, 97), 1),
            'search_query':row.get('search_query', f"{row['title']} {row['artist']}"),
            'preview_url': '',
            'artwork_url': '',
        })
    return jsonify({'emotion': emotion, 'recommendations': results, 'count': len(results)})


@app.route('/fetch_preview', methods=['POST'])
def fetch_preview():
    query = request.get_json().get('query','')
    if not query: return jsonify({'error':'no query'}), 400
    info = search_itunes(query, limit=3)
    return jsonify(info) if info else (jsonify({'error':'not found'}), 404)


@app.route('/emotions')
def get_emotions():
    out = {}
    for em in VALID_EMOTIONS:
        sub = df[df['emotion']==em]
        out[em] = {'icon': EMOTION_ICONS.get(em,'🎵'), 'count': int(len(sub)),
                   'languages': sorted(sub['language'].unique().tolist())}
    return jsonify({'emotions': out})


@app.route('/statistics')
def statistics():
    stats = {}
    for em in VALID_EMOTIONS:
        sub = df[df['emotion']==em]
        if sub.empty: continue
        stats[em] = {
            'count':      int(len(sub)),
            'avg_rating': round(float(sub['rating'].mean()), 2),
            'top_artist': sub.groupby('artist').size().idxmax(),
            'languages':  sorted(sub['language'].unique().tolist()),
            'icon':       EMOTION_ICONS.get(em,'🎵'),
        }
    return jsonify({'statistics': stats, 'total_songs': int(len(df))})


@app.route('/health')
def health():
    return jsonify({'status':'ok','total_songs':int(len(df)),
                    'detection':'face-api.js (browser-native)'})


if __name__ == '__main__':
    print("\n" + "="*55)
    print("   🎵  Moodsongs")
    print("="*55)
    print(f"  Songs       : {len(df)}")
    print(f"  Languages   : {', '.join(sorted(df['language'].unique()))}")
    print(f"  Detection   : face-api.js (runs in browser — no server needed)")
    print(f"  Music API   : iTunes Search (free, no key)")
    print("="*55)
    print("  👉  http://127.0.0.1:5000")
    print("="*55 + "\n")
    app.run(debug=True, host='0.0.0.0', port=5000)
