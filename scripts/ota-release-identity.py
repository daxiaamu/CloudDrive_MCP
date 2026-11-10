import json, os, sys, zipfile
release=json.load(open(sys.argv[1],encoding='utf-8'))
version=release['tag_name'].removeprefix('v')
archive=os.path.join(sys.argv[2],f'CloudDriveMCP-{version}-Windows-x64-Portable.zip')
prefix=f'CloudDriveMCP-{version}-Windows-x64/'
with zipfile.ZipFile(archive) as z:
    expected=prefix+'resources/app/package.json'
    if expected not in z.namelist():
        print('Archive sample:',repr(z.namelist()[:5]),'package paths:',repr([x for x in z.namelist() if x.lower().endswith('package.json')][:8]))
        raise ValueError('release archive root or package path mismatch')
    package=json.loads(z.read(expected))
    bundle=json.loads(z.read(prefix+'bundle.json'))
    if package.get('name')!='cloud-drive-mcp' or package.get('version')!=version or bundle.get('version')!=version:
        raise ValueError('release tag and package identity do not match')
