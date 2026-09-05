import importlib.util,tempfile,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('guard',Path(__file__).resolve().parents[1]/'scripts/check-release-assets.py');guard=importlib.util.module_from_spec(spec);spec.loader.exec_module(guard)
class ReleaseAssets(unittest.TestCase):
 def fixture(self,files,remote):
  with tempfile.TemporaryDirectory() as d:
   for p,text in files.items():
    f=Path(d)/p;f.parent.mkdir(parents=True,exist_ok=True);f.write_text(text)
   def fetch(url):
    status,mime,body=remote.get(url,(404,'text/html','missing'))
    return {'url':url,'status':status,'type':mime,'_body':body.encode()}
   return guard.check(d,list(files),fetch)
 def test_local_file_not_in_release_does_not_satisfy_dependency(self):
  with tempfile.TemporaryDirectory() as d:
   (Path(d)/'css').mkdir();(Path(d)/'css/missing.css').write_text('body{}')
   (Path(d)/'index.html').write_text('<link rel="stylesheet" href="css/missing.css">')
   def fetch(url):return {'url':url,'status':404,'type':'text/html','_body':b'missing'}
   r=guard.check(d,['index.html'],fetch);self.assertEqual(r['status'],'fail')
 def test_new_stylesheet_in_release_satisfies_dependency(self):
  r=self.fixture({'index.html':'<link rel="stylesheet" href="css/new.css">','css/new.css':'body{}'},{});self.assertEqual(r['status'],'pass')
 def test_dynamic_template_dependency_detected(self):
  r=self.fixture({'js/components.js':'style.href = href(`css/missing.css?v=${version}`)'},{});self.assertEqual(r['status'],'fail');self.assertIn('/css/missing.css',r['failures'][0]['url'])
 def test_css_200_html_is_rejected(self):
  r=self.fixture({'index.html':'<link rel="stylesheet" href="/css/a.css">'},{guard.audit.ORIGIN+'/css/a.css':(200,'text/html','login')});self.assertEqual(r['status'],'fail')
 def test_css_relative_font_checked(self):
  r=self.fixture({'css/a.css':'@font-face{src:url(../assets/a.woff2)}'},{});self.assertEqual(r['status'],'fail')
if __name__=='__main__':unittest.main()
