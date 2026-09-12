"""Synthetic PDF regression fixtures; never use Candidate CV content."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
import fitz

spec = importlib.util.spec_from_file_location('cv_layout', Path(__file__).parents[1] / 'scripts' / 'cv-layout.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class CvLayoutTest(unittest.TestCase):
    def test_percent_metrics_are_not_contact_and_detached_bullets_are_attached(self):
        with tempfile.TemporaryDirectory(prefix='onward-layout-') as folder:
            filename = Path(folder) / 'fixture.pdf'
            doc = fitz.open()
            page = doc.new_page()
            page.insert_text((40, 40), 'Synthetic Candidate', fontsize=18)
            page.insert_text((40, 60), 'person@example.test (+33) 6 12 34 56 78', fontsize=9)
            page.insert_text((40, 95), 'PROFESSIONAL EXPERIENCE', fontname='hebo', fontsize=11)
            page.insert_text((40, 120), 'Researcher at Example', fontname='hebo', fontsize=10)
            page.insert_text((40, 145), '*', fontsize=10)
            page.insert_text((55, 145), '+6.7% performance from documented research.', fontname='hebo', fontsize=10)
            page.insert_text((40, 165), '*', fontsize=10)
            page.insert_text((55, 165), 'Another factual achievement.', fontsize=10)
            doc.save(filename)
            doc.close()
            result = module.pdf_layout(filename)
            self.assertEqual(len(result['contact']), 1)
            self.assertNotIn('%', result['contact'][0])
            bullets = [b['text'] for s in result['sections'] for b in s['blocks'] if b['kind']=='bullet']
            self.assertEqual(bullets, ['+6.7% performance from documented research.', 'Another factual achievement.'])

    def test_right_aligned_dates_and_locations_stay_with_entries(self):
        with tempfile.TemporaryDirectory(prefix='onward-layout-') as folder:
            filename = Path(folder) / 'fixture.pdf'
            doc = fitz.open()
            page = doc.new_page()
            page.insert_text((40, 40), 'Synthetic Candidate', fontsize=18)
            page.insert_text((40, 95), 'PROFESSIONAL EXPERIENCE', fontname='hebo', fontsize=11)
            for index in range(4):
                y = 120 + index * 100
                page.insert_text((40, y), f'Employer {index}', fontname='hebo', fontsize=10)
                page.insert_text((450, y), 'Paris, France', fontsize=10)
                page.insert_text((40, y + 16), f'Role {index}', fontsize=10)
                page.insert_text((450, y + 16), f'202{index} - 202{index+1}', fontsize=10)
                page.insert_text((40, y + 32), 'Delivered research outputs across several independent teams.', fontsize=10)
            doc.save(filename)
            doc.close()
            result = module.pdf_layout(filename)
            self.assertEqual(result['columnCount'], 1)
            blocks = [block['text'] for section in result['sections'] for block in section['blocks']]
            for index in range(4):
                self.assertIn(f'Employer {index} — Paris, France', blocks)
                self.assertTrue(any(f'Role {index} — 202{index} - 202{index+1}' in block for block in blocks))

    def test_genuine_side_section_is_extracted_without_losing_content(self):
        with tempfile.TemporaryDirectory(prefix='onward-layout-') as folder:
            filename = Path(folder) / 'fixture.pdf'
            doc = fitz.open()
            page = doc.new_page()
            page.insert_text((40, 40), 'Synthetic Candidate', fontsize=18)
            for x, title, label in [(40, 'EXPERIENCE', 'Work'), (400, 'SKILLS', 'Skill')]:
                page.insert_text((x, 100), title, fontname='hebo', fontsize=11)
                for index in range(7):
                    page.insert_text((x, 120 + 20 * index), f'{label} fact {index}', fontsize=10)
            doc.save(filename)
            doc.close()
            result = module.pdf_layout(filename)
            self.assertEqual(result['columnCount'], 2)
            text = ' '.join(block['text'] for section in result['sections'] for block in section['blocks'])
            for label in ['Work', 'Skill']:
                for index in range(7):
                    self.assertIn(f'{label} fact {index}', text)


if __name__ == '__main__':
    unittest.main()
