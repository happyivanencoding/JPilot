"""Highlight textual CV changes on a copy of the real PDF, without reflow or OCR."""
import argparse
import difflib
import json
import os
import unicodedata
from pathlib import Path
import fitz


def normalized(text):
    return ''.join(c for c in unicodedata.normalize('NFKC', text).casefold() if c.isalnum())


def words(document):
    result = []
    for number, page in enumerate(document):
        for word in page.get_text('words', sort=True):
            token = normalized(word[4])
            if token:
                result.append((token, number, fitz.Rect(word[:4])))
    return result


def changes(before, after):
    a, b = [w[0] for w in before], [w[0] for w in after]
    changed = {}
    for tag, _, _, start, end in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if tag in ('insert', 'replace'):
            for i in range(start, end):
                changed[i] = 'added' if tag == 'insert' else 'rewritten'
            # Moving an existing paragraph is not adding new wording.
            for block in difflib.SequenceMatcher(None, a, b[start:end], autojunk=False).get_matching_blocks():
                if block.size >= 4:
                    for i in range(start + block.b, start + block.b + block.size):
                        changed.pop(i, None)
    return changed


def compare(original, draft, destination):
    with fitz.open(original) as old, fitz.open(draft) as new:
        before, after = words(old), words(new)
        if not before or not after:
            raise ValueError('Both CVs must contain readable text to compare.')
        highlighted = changes(before, after)
        palette = {'added': (0.35, 0.77, 0.70), 'rewritten': (1.0, 0.76, 0.30)}
        for i, kind in highlighted.items():
            _, number, box = after[i]
            # Actual page graphics work identically in Android PdfRenderer and pdf.js.
            new[number].draw_rect(box, color=None, fill=palette[kind], fill_opacity=0.28, overlay=True)
        target = Path(destination)
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = target.with_name(target.name + f'.{os.getpid()}.tmp')
        new.save(str(temporary), garbage=3, deflate=True)
        os.replace(temporary, target)
        return {'pages': len(new), 'addedWords': sum(k == 'added' for k in highlighted.values()),
                'rewrittenWords': sum(k == 'rewritten' for k in highlighted.values()), 'totalWords': len(after)}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('original'); parser.add_argument('draft'); parser.add_argument('destination')
    args = parser.parse_args()
    print(json.dumps(compare(args.original, args.draft, args.destination)))
