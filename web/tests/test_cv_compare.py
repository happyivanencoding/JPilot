"""Verify the actual PDF overlay preserves geometry/text and ignores moved wording."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
import fitz
spec=importlib.util.spec_from_file_location('cv_compare',Path(__file__).parents[1]/'scripts'/'cv-compare.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class PdfComparisonTest(unittest.TestCase):
    def test_unchanged_and_moved_text_are_not_additions(self):
        words=lambda text:[(module.normalized(word),0,fitz.Rect(1,1,2,2)) for word in text.split()]
        self.assertEqual(module.changes(words('A Java project with API tests'),words('A Java project with API tests')), {})
        old=words('Built Java REST API with unit tests Developed Python dashboards for class projects')
        new=words('Developed Python dashboards for class projects Built Java REST API with unit tests')
        self.assertEqual(module.changes(old,new),{})

    def test_overlay_changes_only_visual_marks_not_pdf_content(self):
        with tempfile.TemporaryDirectory(prefix='jpilot-pdf-compare-') as directory:
            directory=Path(directory)
            for file,text in [('old.pdf','Built a Java API with tests.'),('new.pdf','Built a Java REST API with automated tests.\nAdded clear project documentation.')]:
                with fitz.open() as doc:
                    page=doc.new_page();page.insert_text((50,70),text,fontsize=12);doc.save(directory/file)
            result=module.compare(directory/'old.pdf',directory/'new.pdf',directory/'highlight.pdf')
            self.assertGreater(result['addedWords']+result['rewrittenWords'],0)
            with fitz.open(directory/'new.pdf') as original, fitz.open(directory/'highlight.pdf') as highlight:
                self.assertEqual(original[0].rect,highlight[0].rect)
                self.assertEqual(original[0].get_text(),highlight[0].get_text())
                self.assertEqual(original[0].get_text('words'),highlight[0].get_text('words'))
                self.assertNotEqual(original[0].get_pixmap().samples,highlight[0].get_pixmap().samples)

if __name__=='__main__':unittest.main()
