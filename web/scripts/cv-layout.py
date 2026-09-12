"""Read PDF typography/columns as layout, without OCR or rewriting any CV facts."""
import json
import re
import sys
from statistics import median
from pathlib import Path

HEADINGS = {
    "contact": r"contact|coordonnees|personal details",
    "profile": r"professional summary|profil|profile|summary|objective|about me",
    "education": r"formation|education|academic|etudes",
    "experience": r"professional experience|experience professionnelle|experience|experiences|employment|work history",
    "projects": r"ai projects?|projets?|projects?|engagement|volunteer|activities",
    "languages": r"langues|languages|language skills",
    "tools": r"outils|tools|software|technical skills",
    "skills": r"competences|skills|expertise",
    "interests": r"interets|interests|hobbies",
}

def plain(text):
    import unicodedata
    return ''.join(c for c in unicodedata.normalize('NFKD', text) if not unicodedata.combining(c)).lower().strip()

def heading(text):
    value = plain(text)
    if len(value) > 75:
        return None
    return next((key for key, pattern in HEADINGS.items() if re.match(r'^(?:' + pattern + r')(?:\b|\s)', value)), None)

def pdf_layout(filename):
    import fitz
    doc = fitz.open(filename)
    if doc.needs_pass or len(doc) > 50:
        raise ValueError('Unreadable CV PDF')
    sections = []
    name = ''
    headline = ''
    footer = []
    contact = []
    max_columns = 1
    column_fractions = None
    first_page_width = float(doc[0].rect.width) if len(doc) else 595.0
    first_page_height = float(doc[0].rect.height) if len(doc) else 842.0
    for page_number, page in enumerate(doc):
        rows = []
        for block in page.get_text('dict')['blocks']:
            for line in block.get('lines', []):
                spans = [s for s in line['spans'] if s.get('text', '').strip()]
                if not spans:
                    continue
                text = ''.join(s['text'] for s in line['spans']).strip()
                x0, y0, x1, y1 = line['bbox']
                rows.append(dict(text=text, x=x0, y=y0, right=x1, bottom=y1,
                                 size=max(s['size'] for s in spans), bold=any(s.get('flags', 0) & 16 for s in spans),
                                 mostly_bold=sum(len(s['text']) for s in spans if s.get('flags', 0) & 16) >= .85 * sum(len(s['text']) for s in spans)))
        if not rows:
            continue
        body = [r for r in rows if r['y'] < page.rect.height * .94]
        first_section = min((r['y'] for r in body if heading(r['text']) and heading(r['text']) != 'contact'), default=page.rect.height * .18)
        for row in body:
            text = row['text']
            phone = re.search(r'(?:\+|00|\(\+)\s*\d[\d\s().-]{6,}\d', text)
            valid_phone = phone and len(re.sub(r'\D', '', phone.group())) >= 8 and '%' not in text
            if row['y'] < first_section and (re.search(r'@|linkedin', text, re.I) or valid_phone) and text not in contact:
                contact.append(text)
        footer.extend(r['text'] for r in rows if r not in body)
        if page_number == 0 and body:
            top = [r for r in body if r['y'] < page.rect.height * .25 and not heading(r['text'])]
            largest = max(top, key=lambda r:r['size']) if top else body[0]
            name = largest['text']; body.remove(largest)
            following = [r for r in body if abs(r['x']-largest['x']) < 14 and 0 < r['y']-largest['bottom'] < 22 and not heading(r['text'])]
            if following:
                line = min(following, key=lambda r:r['y'])
                if not re.search(r'@|https?://|\b\d{4}\b', line['text']):
                    headline=line['text'];body.remove(line)
        # A large gap between repeated left margins identifies independent columns.
        starts = sorted(set(round(r['x']/10)*10 for r in body))
        possible = [(b-a, (a+b)/2) for a,b in zip(starts,starts[1:]) if b-a > page.rect.width*.18]
        split = None
        for _, mid in sorted(possible, reverse=True):
            left = [r for r in body if r['x'] < mid]
            right = [r for r in body if r['x'] >= mid]
            if len(left) >= 6 and len(right) >= 6:
                right_edge = min(r['x'] for r in right)
                crossing = [r for r in left if r['right'] > right_edge - 8 and not heading(r['text'])]
                metadata = lambda r: len(r['text']) < 85 and (bool(re.search(r'\b(?:19|20)\d{2}\b', r['text'])) or (',' in r['text'] and len(r['text'].split()) <= 6))
                # Right-aligned dates/locations are entry metadata, not a sidebar.
                if len(crossing) < 2 and not all(metadata(r) for r in right):
                    split=mid;break
        if split is None:
            # Join same-baseline metadata before reading down the page. This keeps
            # a date attached to its entry rather than collecting dates at the end.
            joined = []
            for row in sorted(body, key=lambda r: (round(r['y']/3), r['x'])):
                peer = next((r for r in reversed(joined) if abs(r['y']-row['y']) <= 3 and r['right'] + (1 if re.match(r'^[-•▪*]$', r['text']) else 8) < row['x']), None)
                bullet_peer = peer is not None and bool(re.match(r'^[-•▪*]$', peer['text']))
                if peer is not None and (bullet_peer or (row['x'] > page.rect.width * .5 and len(row['text']) < 85)):
                    peer['text'] += (' ' if bullet_peer else ' — ') + row['text']
                    peer['right'] = row['right']
                else:
                    joined.append(dict(row))
            body = joined
        columns = [[r for r in body if r['x']<split], [r for r in body if r['x']>=split]] if split else [body]
        max_columns = max(max_columns, len(columns))
        if len(columns) > 1:
            widths = [max(r['right'] for r in column) - min(r['x'] for r in column) for column in columns if column]
            total = sum(widths)
            if len(widths) == len(columns) and total > 0:
                column_fractions = [round(width / total, 4) for width in widths]
        for column_index, column in enumerate(columns):
            ordered=sorted(column,key=lambda r:(round(r['y']/3),r['x']))
            size=median([r['size'] for r in ordered]) if ordered else 10
            section=None
            previous=None
            pending_bullet=False
            for row in ordered:
                kind=heading(row['text'])
                # Only heading-shaped lines, not a sentence mentioning experience.
                is_heading=kind and (len(row['text'])<45 or row['text'].isupper()) and (row['bold'] or row['text'].isupper() or row['size']>size+.5)
                if is_heading:
                    section=dict(kind=kind,title=row['text'],blocks=[],column=column_index);sections.append(section);previous=None;pending_bullet=False;continue
                if section is None:
                    section=dict(kind='contact' if len(row['text'])<85 and (re.search(r'@|linkedin|\d',row['text']) or row['x']<page.rect.width*.25) else 'profile',title='',blocks=[],column=column_index)
                    sections.append(section)
                text=row['text']
                if re.match(r'^[-•▪*]$', text):
                    pending_bullet=True
                    continue
                is_bullet=pending_bullet or bool(re.match(r'^[-•▪*]\s*',text))
                pending_bullet=False
                block_kind='bullet' if is_bullet else 'entry' if row.get('mostly_bold') and len(text)<160 and section['kind'] in ('education','experience','projects') else 'text'
                if previous and section['blocks'] and block_kind=='text' and previous['kind'] in ('text','bullet') and abs(row['size']-previous['row']['size'])<.3 and 0<=row['y']-previous['row']['bottom']<6 and not re.match(r'^\d{4}',text) and section['kind'] in ('profile','experience','projects','education'):
                    section['blocks'][-1]['text'] += ' '+text
                    previous['row']=row
                else:
                    section['blocks'].append(dict(kind=block_kind,text=re.sub(r'^[-•▪*]\s*','',text) if is_bullet else text))
                    previous=dict(kind=block_kind,row=row)
    return dict(name=name,headline=headline,contact=contact,sections=sections,footer=footer,columnCount=max_columns,columnFractions=column_fractions,pageCount=len(doc),pageWidth=first_page_width,pageHeight=first_page_height)

if __name__=='__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
    try:
        print(json.dumps(pdf_layout(Path(sys.argv[1])),ensure_ascii=False))
    except Exception as error:
        print(str(error),file=sys.stderr);sys.exit(1)
