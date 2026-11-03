"""Package committed RC source and verified unsigned Windows candidates without user databases."""
from pathlib import Path
import hashlib
import json
import subprocess
import zipfile
import html

root = Path(__file__).resolve().parents[1]
out = root / 'release/rc-delivery'
out.mkdir(exist_ok=True, parents=True)
version = json.loads((root / 'package.json').read_text())['version']
report = json.loads((root / 'docs/reports/1.0-rc/M5/artifacts.json').read_text())
gate = json.loads((root / 'docs/reports/1.0-rc/M5/acceptance-gate.json').read_text())
visual = json.loads((root / 'docs/reports/1.0-rc/final/visual.json').read_text())
assert report['passed'] and report['windowsRuntimeTested'] is False
assert gate['version'] == version and gate['stableAccepted'] is False
assert visual['passed']
for artifact in report['artifacts']:
    p = root / 'release/1.0-rc' / artifact['name']
    assert hashlib.sha256(p.read_bytes()).hexdigest() == artifact['sha256']

for kind in ['Setup', 'Portable']:
    exe = f'FOCUS_OS_PRO_{version}_{kind}_UNTESTED.exe'
    with zipfile.ZipFile(out / f'FOCUS_OS_PRO_{version}_{kind}_UNTESTED.zip', 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        z.write(root / 'release/1.0-rc' / exe, exe)
        z.write(root / 'docs/reports/1.0-rc/WINDOWS_INSTRUCTIONS.md', 'WINDOWS_INSTRUCTIONS.md')
        z.write(root / 'KNOWN_ISSUES.md', 'KNOWN_ISSUES.md')
        z.write(root / 'docs/reports/1.0-rc/M5/artifacts.json', 'STATIC_VERIFICATION.json')
        z.write(root / 'docs/reports/1.0-rc/M5/acceptance-gate.json', 'ACCEPTANCE_GATE.json')
        if kind == 'Portable':
            for name, demo in [('Open_App.cmd', False), ('Open_Demo.cmd', True)]:
                body = '@echo off\r\nsetlocal\r\nset FOCUS_DATA_DIR=\r\nset FOCUS_DEMO=' + ('1' if demo else '0') + '\r\nset FOCUS_HOME_CONCEPT=' + ('B' if demo else '') + '\r\nset FOCUS_DEMO_EMPTY=0\r\nstart "" "%~dp0' + exe + '"\r\nendlocal\r\n'
                z.writestr(name, body)

subprocess.run(['git', 'archive', '--format=zip', f'--prefix=FOCUS_OS_PRO_{version}/', '-o', str(out / f'FOCUS_OS_PRO_{version}_Source.zip'), 'HEAD'], cwd=root, check=True)
bundle = out / 'repository.bundle'
subprocess.run(['git', 'bundle', 'create', str(bundle), '--all'], cwd=root, check=True)
subprocess.run(['git', 'bundle', 'verify', str(bundle)], cwd=root, check=True)
with zipfile.ZipFile(out / f'FOCUS_OS_PRO_{version}_Repository_History.zip', 'w', zipfile.ZIP_STORED) as z:
    z.write(bundle, 'repository.bundle')
    z.writestr('README.md', 'Полная git-история для Windows update CI.\n\n`git clone repository.bundle focus-os-pro`\n\nЗатем см. README.md и .github/workflows/windows.yml. Пользовательские базы не входят.\n')
with zipfile.ZipFile(out / f'FOCUS_OS_PRO_{version}_Test_Reports.zip', 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for p in (root / 'docs/reports/1.0-rc').rglob('*'):
        if p.is_file():
            z.write(p, 'reports/' + str(p.relative_to(root / 'docs/reports/1.0-rc')))
    for name in ['README.md', 'IMPLEMENTATION_STATUS.md', 'RELEASE_NOTES.md', 'KNOWN_ISSUES.md']:
        z.write(root / name, name)

names = ['Главная', 'Планировщик', 'Задачи', 'Проекты', 'Учёба', 'Тренировки', 'Аналитика', 'Фокус', 'Заметки', 'Настройки']
shots = root / 'docs/screenshots/1.0-rc/final'
images = sorted(shots.glob('*.png'))
assert len(images) == 100, len(images)
gallery = '''<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>FOCUS OS PRO — RC actual Electron screenshots</title><style>body{background:#101613;color:#e6efe8;font:16px system-ui;margin:32px}a{color:#93dcb3}img{display:block;max-width:100%;height:auto;border:1px solid #355742;border-radius:10px}figure{margin:32px 0}details{margin:12px 0}summary{cursor:pointer;padding:10px;background:#1c2921}code{color:#b9cdbf}</style><h1>FOCUS OS PRO — Release Candidate</h1><p>100 настоящих снимков Electron/Linux. Demo и пустая пользовательская база изолированы; demo-показатели не являются личными данными.</p><p>1366×768,1920×1080,2560×1440: 60 снимков; 20 диалогов; 20 Electron zoom125/150%. Последние <strong>не являются Windows DPI</strong>.</p>'''
for i, name in enumerate(names, 1):
    gallery += '<details><summary>' + html.escape(name) + '</summary>'
    for mode in ['demo', 'empty']:
        for width in [1366, 1920, 2560]:
            file = f'{mode}-{i}-{width}.png'
            gallery += f'<figure><figcaption>{mode} · {width}px</figcaption><a href="{file}"><img loading="lazy" src="{file}" alt="{html.escape(name)} {mode} {width}px"></a></figure>'
        file = f'{mode}-{i}-dialog.png'
        gallery += f'<figure><figcaption>{mode} · диалог</figcaption><img loading="lazy" src="{file}"></figure>'
    for zoom in [1.25, 1.5]:
        file = f'electron-zoom-{zoom}-{i}.png'
        gallery += f'<figure><figcaption>Electron zoom {zoom} — не Windows DPI</figcaption><img loading="lazy" src="{file}"></figure>'
    gallery += '</details>'
with zipfile.ZipFile(out / f'FOCUS_OS_PRO_{version}_Visual_Tests_100.zip', 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for p in images:
        z.write(p, p.name)
    z.writestr('index.html', gallery)
    z.write(root / 'docs/reports/1.0-rc/final/visual.json', 'visual.json')
    z.write(root / 'docs/reports/1.0-rc/final/contrast.json', 'contrast.json')

commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
(out / 'НАЧАТЬ_ЗДЕСЬ.md').write_text(f'''# FOCUS OS PRO {version} — Release Candidate

Разработка продолжена на существующей кодовой базе, утверждённый Obsidian Command Center B / Forest Noir, все10 разделов. Исходный импорт9/4/54 сохранён. Commit `{commit}`, ветка release/1.0-rc-polish.

- Source.zip — полный исходный код, lockfile, документация, тесты и снимки.
- Setup_UNTESTED.zip — настоящий NSIS EXE; сначала распакуйте архив.
- Portable_UNTESTED.zip — настоящий Portable EXE и Open_App.cmd/Open_Demo.cmd, разные SQLite базы.
- Visual_Tests_100.zip — реальные PNG и index.html для просмотра всех10 страниц: 60 заполненных/пустых,20 диалогов,20 Electron zoom.
- Test_Reports.zip — 66 unit/integration,10 GUI suites, SQLite upgrade/crash/recovery, контраст, производительность и Windows NOT_RUN.
- Repository_History.zip — полная git-история, необходимая Windows CI для baseline0.2/0.3.
- 10 отдельных PNG1920×1080 — основные страницы. Отдельные отчёты и инструкции доступны рядом.
- SHA256SUMS.txt — ZIP, EXE внутри архивов, отчёты и основные снимки.

**Это RC, не Stable.** Windows installer/portable реально не запускались. Origin RRdimetro/planer настроен, но авторизация GitHub/Actions недоступна. Реального CI job/log нет. Кросс-сборка и проверка payload не заменяют Windows install/update/DPI/OS notifications. Бинарники unsigned и UNTESTED.

Перед обновлением сохраните ZIP-копию и весь `%APPDATA%\\FOCUS OS PRO` при закрытом приложении. Проверяйте кандидата сначала на копии. Инструкции WINDOWS_INSTRUCTIONS.md и KNOWN_ISSUES.md обязательны для оценки ограничений.

Исходники: Node22+, pnpm10.20; `pnpm install --frozen-lockfile`, `pnpm run rebuild`, `pnpm build`, `pnpm dev`. Проверки: `pnpm test`, `pnpm test:rc`; Stable gate не проходит без фактического Windows evidence.
''')
for name, relative in {
    'RELEASE_NOTES.md':'RELEASE_NOTES.md',
    'KNOWN_ISSUES.md':'KNOWN_ISSUES.md',
    'WINDOWS_INSTRUCTIONS.md':'docs/reports/1.0-rc/WINDOWS_INSTRUCTIONS.md',
    'WINDOWS_CI_NOT_RUN.md':'docs/reports/1.0-rc/WINDOWS_CI_NOT_RUN.md',
    'MIGRATIONS_REPORT.md':'docs/reports/1.0-rc/M4/RELIABILITY.md',
    'PERFORMANCE_REPORT.md':'docs/reports/1.0-rc/PERFORMANCE_REPORT.md',
    'TEST_RESULTS.md':'docs/reports/1.0-rc/M5/RESULTS.md',
}.items():
    (out / name).write_bytes((root / relative).read_bytes())
for i, name in enumerate(names, 1):
    (out / f'{i:02d}_{name}_1920x1080.png').write_bytes((shots / f'demo-{i}-1920.png').read_bytes())
artifacts = []
for p in sorted(out.iterdir()):
    if p.suffix not in ['.zip', '.md', '.png']:
        continue
    if p.suffix == '.zip':
        with zipfile.ZipFile(p) as z:
            assert z.testzip() is None, p
    assert p.stat().st_size < 100*1024*1024, (p, 'Upload limit exceeded')
    artifacts.append({'name':p.name, 'size':p.stat().st_size, 'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
for entry in report['artifacts']:
    artifacts.append({k:entry[k] for k in ['name', 'size', 'sha256']})
(out / 'SHA256SUMS.txt').write_text(''.join(f"{a['sha256']}  {a['name']}\n" for a in artifacts))
(out / 'ARTIFACTS.json').write_text(json.dumps({'version':version,'sourceCommit':commit,'windowsRuntimeTested':False,'artifacts':artifacts},ensure_ascii=False,indent=2))
print(json.dumps(artifacts,ensure_ascii=False,indent=2))
