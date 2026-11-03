"""Package only committed source and verified, explicitly untested Windows candidates."""
from pathlib import Path
import hashlib,json,subprocess,zipfile
root=Path(__file__).resolve().parents[1]
out=root/'release/delivery';out.mkdir(exist_ok=True,parents=True)
report=json.loads((root/'docs/reports/obsidian/F/artifacts.json').read_text())
assert report['passed'] and report['windowsRuntimeTested'] is False
for artifact in report['artifacts']:
 p=root/'release/obsidian'/artifact['name'];assert hashlib.sha256(p.read_bytes()).hexdigest()==artifact['sha256']
readme=(root/'README.md').read_text()
for kind in ['Setup','Portable']:
 exe=f'FOCUS_OS_PRO_0.3.0_{kind}_UNTESTED.exe'
 with zipfile.ZipFile(out/f'FOCUS_OS_PRO_0.3.0_{kind}_UNTESTED.zip','w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
  z.write(root/'release/obsidian'/exe,exe);z.writestr('README_RU.md',readme)
  z.write(root/'docs/reports/obsidian/F/artifacts.json','VERIFICATION.json')
  z.write(root/'docs/reports/obsidian/F/windows-status.json','WINDOWS_STATUS.json')
  if kind=='Portable':
   for name,demo in [('Open_App.cmd',False),('Open_Demo.cmd',True)]:
    body='@echo off\r\nsetlocal\r\nset FOCUS_DATA_DIR=\r\nset FOCUS_DEMO='+('1' if demo else '0')+'\r\nset FOCUS_HOME_CONCEPT='+('B' if demo else '')+'\r\nset FOCUS_DEMO_EMPTY=0\r\nstart "" "%~dp0'+exe+'"\r\nendlocal\r\n';z.writestr(name,body)
subprocess.run(['git','archive','--format=zip','--prefix=FOCUS_OS_PRO_0.3.0/','-o',str(out/'FOCUS_OS_PRO_0.3.0_Source.zip'),'HEAD'],cwd=root,check=True)
bundle=out/'repository.bundle'
subprocess.run(['git','bundle','create',str(bundle),'--all'],cwd=root,check=True)
subprocess.run(['git','bundle','verify',str(bundle)],cwd=root,check=True)
with zipfile.ZipFile(out/'FOCUS_OS_PRO_0.3.0_Repository_History.zip','w',zipfile.ZIP_STORED) as z:
 z.write(bundle,'repository.bundle');z.writestr('README.md','Полная git-история для проверки обновления.\n\n`git clone repository.bundle focus-os-pro`\n\nЗатем см. README и Windows workflow. Рабочие базы в архив не входят.\n')
with zipfile.ZipFile(out/'FOCUS_OS_PRO_0.3.0_Test_Reports.zip','w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p in (root/'docs/reports/obsidian').rglob('*'):
  if p.is_file():z.write(p,'reports/'+str(p.relative_to(root/'docs/reports/obsidian')))
 z.writestr('README_RU.md',readme);z.write(root/'IMPLEMENTATION_STATUS.md','IMPLEMENTATION_STATUS.md')
for p in out.glob('*.zip'):
 with zipfile.ZipFile(p) as z:assert z.testzip() is None,p
 assert p.stat().st_size<100*1024*1024,(p,'Upload limit exceeded')
commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
start=f'''# FOCUS OS PRO 0.3.0 — начать здесь

Утверждённый Obsidian Command Center B, 10 страниц, SQLite. Исходный учебный импорт: 9 предметов / 4 группы / 54 статуса.

- Source.zip — полные исходники, lockfile, документация, все этапы и скриншоты. Commit `{commit}`.
- Setup_UNTESTED.zip — настоящий NSIS установщик внутри. Распакуйте и запустите Setup.exe.
- Portable_UNTESTED.zip — настоящий Portable.exe и Open_App.cmd / Open_Demo.cmd. Сначала распакуйте весь архив. Demo использует отдельную БД.
- Screenshots_60.zip — реальные PNG всех десяти страниц: demo/empty × 1366/1920/2560. Откройте index.html для просмотра.
- Test_Reports.zip — результаты тестов, соответствие ТЗ, ограничения и инструкции.
- Repository_History.zip — полная git-история для Windows CI проверки обновления.
- SHA256SUMS.txt — контрольные суммы ZIP и EXE.

Проверено: 59 unit/integration, strict TS/lint/production build, реальные Electron сценарии Linux, 60 PNG, содержимое обоих готовых EXE (PE/ASAR/SQLite ABI 140).

**Windows runtime/установка/обновление/OS notifications/DPI не проверены. Нет доступной Windows-среды и реального результата CI. Бинарники unsigned и UNTESTED; успешная кросс-сборка не означает принятие Windows-релиза.** Не переносите это ограничение в статус «проверено». Workflow подготовлен в исходниках.

Перед обновлением существующего приложения сохраните ZIP-копию и весь каталог `%APPDATA%\\FOCUS OS PRO`; закройте приложение. Не удаляйте старую базу. Setup и Portable используют тот же пользовательский каталог. Подробные команды Windows и использование — README_RU.md внутри архивов.

Из исходников: Node 22+, pnpm 10.20; `pnpm install --frozen-lockfile`, `pnpm run rebuild`, `pnpm build`, `pnpm dev`.
'''
(out/'НАЧАТЬ_ЗДЕСЬ.md').write_text(start)
artifacts=[]
for p in sorted(out.iterdir()):
 if p.suffix=='.zip' or p.name=='НАЧАТЬ_ЗДЕСЬ.md':artifacts.append({'name':p.name,'size':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
for entry in report['artifacts']:artifacts.append({k:entry[k] for k in ['name','size','sha256']})
(out/'SHA256SUMS.txt').write_text(''.join(f"{a['sha256']}  {a['name']}\n" for a in artifacts))
(out/'ARTIFACTS.json').write_text(json.dumps({'version':'0.3.0','sourceCommit':commit,'windowsRuntimeTested':False,'artifacts':artifacts},ensure_ascii=False,indent=2))
print(json.dumps(artifacts,ensure_ascii=False,indent=2))
