"""Import source references only. Videos stay local; no jobs, auth, or outputs are copied."""
import argparse
import json
import math
import os
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('--source', required=True, type=Path, help='MotionClone project directory')
args = parser.parse_args()
target = Path(__file__).resolve().parent.parent
media_root = target / '.local-media'
thumb_root = target / 'public' / 'references'
media_root.mkdir(exist_ok=True)
thumb_root.mkdir(exist_ok=True)
sources = []
for directory in sorted((args.source / 'data').iterdir()):
    if not directory.is_dir() or directory.name.startswith('.'):
        continue
    if (directory / 'source.mp4').exists():
        job = json.loads((directory / 'job.json').read_text(encoding='utf-8'))
        sources.append((directory.name, directory / 'source.mp4', job.get('name', 'Motion reference')))
    elif directory.name in ('nexa-references', 'troovy-reference'):
        for video in sorted(directory.glob('*.mp4')):
            info_file = video.with_suffix('.info.json')
            info = json.loads(info_file.read_text(encoding='utf-8')) if info_file.exists() else {}
            sources.append((directory.name + '-' + video.stem, video, info.get('title', video.stem)))
references = []
for identifier, video, title in sources:
    probe = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', str(video)], capture_output=True, text=True, check=True)
    details = json.loads(probe.stdout)
    duration = float(details['format']['duration'])
    destination = media_root / (identifier + '.mp4')
    if not destination.exists():
        # Same-volume hard links preserve the source without duplicating large videos.
        os.link(video, destination)
    count = max(1, math.floor(duration / 4))
    segments = []
    for index in range(count):
        start = round(index * duration / count, 3)
        end = duration if index == count - 1 else round((index + 1) * duration / count, 3)
        image = thumb_root / f'{identifier}-{index}.jpg'
        if not image.exists():
            subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-threads', '1', '-ss', str((start + end) / 2), '-i', str(video), '-frames:v', '1', '-vf', 'scale=480:-2', '-threads', '1', '-q:v', '4', str(image)], check=True, stdout=subprocess.DEVNULL)
        segments.append({'ref': identifier, 'in': start, 'out': round(end, 3), 'part': index + 1, 'poster': f'/references/{image.name}'})
    name = str(title).split(' - ', 1)[-1].split('   ')[0].strip()
    aliases = {
        '09a418cdd005': 'Leo · Ideas in motion', '09782d1f7c63': 'Claude × Milanote',
        'cf8c4707e634': 'HealthTech · Product reveal', '4d97811d6dae': 'Ask River · A better flow',
        '919ebec37a3b': 'Troovy · Meet your next idea', '5fbdf5e42405': 'System prompts',
        '3227c09daea3': 'Supahub · Product story', '0360df628fa3': 'Motion study 01',
        '227b019e7968': 'SaaS · Launch sequence', '5db95a3a7c73': 'Motion study 08',
        '5924a2f28506': 'Interface · Motion study'
    }
    references.append({'id': identifier, 'name': aliases.get(identifier, name[:85]), 'originalName': str(title)[:200],
        'duration': round(duration, 3), 'width': details['streams'][0]['width'], 'height': details['streams'][0]['height'],
        'src': f'/media/references/{identifier}.mp4', 'poster': segments[0]['poster'], 'segments': segments})
    print(f'Imported {identifier}: {len(segments)} segments', flush=True)
preferred = ['09a418cdd005', '09782d1f7c63', 'cf8c4707e634', '4d97811d6dae', '919ebec37a3b', '3227c09daea3']
references.sort(key=lambda item: preferred.index(item['id']) if item['id'] in preferred else len(preferred))
(thumb_root / 'catalog.json').write_text(json.dumps({'references': references}, indent=2, ensure_ascii=False), encoding='utf-8')
print(f'Ready: {len(references)} references, {sum(len(r["segments"]) for r in references)} selectable segments.')
